// ============================================================
// ACTION ECONOMY CONTROLLER
// ALTERNATE ATTACKS — GRAPPLE (rewrite)
//
// Foundry VTT 13
// D&D 5e 5.3.3
//
// FLOW:
//   1. Player uses the "Grapple" Item (an Activity whose name
//      or parent item name contains "grapple").
//   2. Attacker rolls Athletics. Target picks Athletics or
//      Acrobatics and rolls to resist.
//   3. If the attacker's total is HIGHER than the target's
//      total, the target is given the "Grappled" condition
//      (Foundry's built-in Grappled status already sets the
//      target's speed to 0, so we don't touch movement here).
//   4. Later, whenever the grappled target tries to use an
//      Action, we intercept it and ask: escape, or use the
//      Action normally?
//        - "Escape" consumes the Action, both sides roll
//          again (target's chosen skill vs grappler's
//          Athletics), and the target must roll STRICTLY
//          HIGHER to break free. A tie favors the grappler.
//        - "Use Action" re-fires the original Action.
//   5. Whenever the grappler moves on their turn, the target
//      is dragged along automatically, and the grappler is
//      charged DOUBLE movement cost for that move.
//
// IMPORTANT:
// This file must load BEFORE action-economy.js (see module.json)
// AND must register its preUseActivity hook immediately (not on
// "ready") so it always runs before Action Economy's own
// preUseActivity listener, which also registers immediately.
// If that ordering ever breaks, the Escape Grapple prompt will
// fail because Action Economy will have already reserved the
// Action before we get a chance to intercept it.
// ============================================================

console.log(
    "%c[ALTERNATE ATTACKS] MODULE LOADING",
    "color: cyan; font-size: 16px; font-weight: bold;"
);


if (globalThis.alternateAttacks) {

    console.warn("[ALTERNATE ATTACKS] Already initialized.");

} else {

    const CONDITION_ID = "grappled";

    globalThis.alternateAttacks = {

        // ========================================================
        // STATE
        // ========================================================

        grapplers: new Map(),    // grapplerActorId -> targetActorId
        grappledBy: new Map(),   // targetActorId -> grapplerActorId

        // Tracks the pre-move position of a grappler's token so we
        // can compute how far it moved and drag the target the
        // same distance.
        _pendingTokenMove: new Map(), // tokenId -> { x, y }


        // ========================================================
        // INIT
        // ========================================================

        init() {

            if (globalThis.__aecAlternateAttacksInitialized) {
                console.warn("[ALTERNATE ATTACKS] Already initialized.");
                return;
            }

            globalThis.__aecAlternateAttacksInitialized = true;

            // Escape-grapple interception. MUST register before
            // Action Economy's own preUseActivity listener.
            Hooks.on("dnd5e.preUseActivity", (activity, usageConfig) =>
                this.handlePreUseActivity(activity, usageConfig)
            );

            // Grapple initiation.
            Hooks.on("dnd5e.postUseActivity", (activity, usageConfig, results) =>
                this.handlePostUseActivity(activity, usageConfig, results)
            );

            // Drag-along movement: capture the grappler's position
            // just before it changes...
            Hooks.on("preUpdateToken", (tokenDoc, changes) =>
                this.handlePreUpdateToken(tokenDoc, changes)
            );

            // ...then move the target the same amount once the
            // grappler's new position is committed.
            Hooks.on("updateToken", (tokenDoc, changes) =>
                this.handleUpdateToken(tokenDoc, changes)
            );

            // Double the grappler's own movement cost while
            // dragging someone. Uses the same movement.passed
            // data movement-tracker.js already relies on.
            Hooks.on("moveToken", (tokenDoc, movement) =>
                this.handleMoveTokenCost(tokenDoc, movement)
            );

            console.log(
                "%c[ALTERNATE ATTACKS] Grapple handlers installed.",
                "color: lime; font-weight: bold;"
            );

        },


        // ========================================================
        // DETECT GRAPPLE ACTIVITY
        // ========================================================

        isGrappleActivity(activity) {

            if (!activity) return false;

            const activityName = String(activity.name ?? "").trim().toLowerCase();
            const itemName = String(activity.item?.name ?? "").trim().toLowerCase();

            return (
                activityName.includes("grapple") ||
                itemName.includes("grapple")
            );

        },


        // ========================================================
        // INITIATE GRAPPLE
        // ========================================================

        async handlePostUseActivity(activity, usageConfig, results) {

            if (!this.isGrappleActivity(activity)) return;

            const actor = activity.actor;
            if (!actor) {
                console.warn("[ALTERNATE ATTACKS] Grapple has no actor.");
                return;
            }

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE DETECTED",
                "color: orange; font-weight: bold;",
                actor.name
            );

            const target = this.getTarget(usageConfig, results, activity);
            if (!target) {
                ui.notifications.warn("Grapple requires a target.");
                return;
            }

            const targetActor = target.actor;
            if (!targetActor) {
                console.warn("[ALTERNATE ATTACKS] Grapple target has no actor.");
                return;
            }

            if (!this.canGrappleTarget(actor, targetActor)) {
                ui.notifications.warn(`${target.name} is too large to grapple.`);
                return;
            }

            const attackerRoll = await this.rollSkill(actor, "ath", "Grapple — Athletics");
            if (!attackerRoll) return;

            const targetSkill = await this.chooseSkill(targetActor, {
                title: "Grapple Defense",
                prompt: "must choose a skill to resist the grapple."
            });
            if (!targetSkill) return;

            const targetRoll = await this.rollSkill(
                targetActor,
                targetSkill,
                `Grapple — ${targetSkill === "ath" ? "Athletics" : "Acrobatics"}`
            );
            if (!targetRoll) return;

            const attackerTotal = Number(attackerRoll.total ?? 0);
            const targetTotal = Number(targetRoll.total ?? 0);

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE CONTEST",
                "color: gold; font-weight: bold;",
                { attacker: attackerTotal, target: targetTotal }
            );

            if (attackerTotal > targetTotal) {

                await this.applyGrappled(targetActor);
                this.addGrappleRelationship(actor, targetActor);

                ui.notifications.info(`${actor.name} successfully grappled ${target.name}.`);

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLE SUCCESS",
                    "color: lime; font-weight: bold;",
                    actor.name, "→", target.name
                );

            } else {

                ui.notifications.info(`${actor.name} failed to grapple ${target.name}.`);

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLE FAILED",
                    "color: red; font-weight: bold;",
                    actor.name, "→", target.name
                );

            }

        },


        // ========================================================
        // GET TARGET
        // ========================================================

        getTarget(usageConfig, results, activity) {

            const workflow = results?.workflow ?? usageConfig?.workflow;

            if (workflow?.targets?.size) {
                return workflow.targets.values().next().value;
            }

            if (usageConfig?.targets?.size) {
                return usageConfig.targets.values().next().value;
            }

            if (usageConfig?.targets instanceof Set) {
                return usageConfig.targets.values().next().value;
            }

            const activityTargets = activity?.targets;
            if (activityTargets?.size) {
                return activityTargets.values().next().value;
            }

            const controlledTargets = Array.from(game.user?.targets ?? []);
            if (controlledTargets.length === 1) {
                return controlledTargets[0];
            }

            return null;

        },


        // ========================================================
        // SIZE CHECK
        // ========================================================

        canGrappleTarget(actor, targetActor) {

            const attackerSize = this.getSizeIndex(actor);
            const targetSize = this.getSizeIndex(targetActor);

            if (attackerSize === null || targetSize === null) {
                console.warn("[ALTERNATE ATTACKS] Could not determine creature size; allowing grapple.");
                return true;
            }

            return targetSize <= attackerSize + 1;

        },


        getSizeIndex(actor) {

            const size = actor?.system?.traits?.size;
            if (!size) return null;

            const sizes = ["tiny", "sm", "med", "lg", "huge", "grg"];
            const normalized = String(size).trim().toLowerCase();
            const index = sizes.indexOf(normalized);

            return index >= 0 ? index : null;

        },


        // ========================================================
        // ESCAPE INTERCEPTION
        //
        // If a Grappled creature tries to use an Action, cancel it
        // and show the Escape Grapple prompt instead.
        // ========================================================

        handlePreUseActivity(activity, usageConfig) {

            if (!activity) return true;

            const actor = activity.actor;
            if (!actor) return true;

            // Ignore our own re-fired Action (from "No — Use Action").
            if (usageConfig?.__aecSkipGrappleEscape) return true;

            const resource = globalThis.actionEconomy?.getResource?.(activity);
            if (resource !== "action") return true;

            const grappler = this.getGrappler(actor);
            if (!grappler) return true;

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED ACTION INTERCEPTED",
                "color: orange; font-weight: bold;",
                { actor: actor.name, action: activity.name, grappler: grappler.name }
            );

            // Temporarily hide this Action from Action Economy so it
            // doesn't reserve the resource for a use we're about to
            // cancel. Restored immediately after this hook chain runs.
            const originalActivationType = activity.activation?.type;

            if (activity.activation) {
                activity.activation.type = "none";
            }

            setTimeout(() => {
                if (activity.activation) {
                    activity.activation.type = originalActivationType;
                }
            }, 0);

            setTimeout(() => {
                this.showEscapePrompt(actor, grappler, activity, usageConfig);
            }, 0);

            return false;

        },


        async showEscapePrompt(actor, grappler, activity, usageConfig) {

            if (!actor || !grappler || !activity) return;

            const choice = await this.chooseEscapeAction(actor, grappler);

            if (choice === "cancel") {
                console.log("[ALTERNATE ATTACKS] Escape prompt cancelled.");
                return;
            }

            if (choice === "action") {

                console.log(
                    "%c[ALTERNATE ATTACKS] Player chose normal Action.",
                    "color: cyan; font-weight: bold;",
                    actor.name, activity.name
                );

                try {
                    await activity.use({ ...usageConfig, __aecSkipGrappleEscape: true });
                } catch (error) {
                    console.error("[ALTERNATE ATTACKS] Failed to re-fire original Action:", error);
                }

                return;

            }

            if (choice === "escape") {

                console.log(
                    "%c[ALTERNATE ATTACKS] Player chose Escape Grapple.",
                    "color: gold; font-weight: bold;",
                    actor.name
                );

                await this.handleEscapeGrapple(actor, grappler);

            }

        },


        async chooseEscapeAction(actor, grappler) {

            return new Promise(resolve => {

                let resolved = false;
                const finish = value => {
                    if (resolved) return;
                    resolved = true;
                    resolve(value);
                };

                new Dialog({

                    title: "Grappled",

                    content: `
                        <p><strong>${actor.name}</strong> is currently grappled by
                        <strong>${grappler.name}</strong>.</p>
                        <p>Would you like to attempt to escape the grapple?</p>
                    `,

                    buttons: {
                        yes: { label: "Yes — Escape Grapple", callback: () => finish("escape") },
                        no: { label: "No — Use Action", callback: () => finish("action") },
                        cancel: { label: "Cancel", callback: () => finish("cancel") }
                    },

                    default: "yes",
                    close: () => finish("cancel")

                }).render(true);

            });

        },


        async handleEscapeGrapple(actor, grappler) {

            if (!actor || !grappler) return;

            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE ATTEMPT",
                "color: gold; font-weight: bold;",
                actor.name, "→", grappler.name
            );

            const state = globalThis.actionEconomy?.getState?.(actor);

            if (state?.action) {
                ui.notifications.warn(`${actor.name} has already used their Action.`);
                console.warn("[ALTERNATE ATTACKS] Escape blocked — Action already used.");
                return;
            }

            const actionUsed = globalThis.actionEconomy?.use?.(actor, "action");

            if (actionUsed === false) {
                ui.notifications.warn(`${actor.name} cannot use an Action right now.`);
                return;
            }

            const escapeSkill = await this.chooseSkill(actor, {
                title: "Escape Grapple",
                prompt: "must choose a skill to escape the grapple."
            });

            if (!escapeSkill) {
                console.log("[ALTERNATE ATTACKS] Escape skill selection cancelled.");
                return;
            }

            const escapeRoll = await this.rollSkill(
                actor,
                escapeSkill,
                `Escape Grapple — ${escapeSkill === "ath" ? "Athletics" : "Acrobatics"}`
            );
            if (!escapeRoll) return;

            const grapplerRoll = await this.rollSkill(grappler, "ath", "Escape Grapple — Grappler Athletics");
            if (!grapplerRoll) return;

            const escapeTotal = Number(escapeRoll.total ?? 0);
            const grapplerTotal = Number(grapplerRoll.total ?? 0);

            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE CONTEST",
                "color: gold; font-weight: bold;",
                { escaping: actor.name, escapeSkill, escapeTotal, grappler: grappler.name, grapplerTotal }
            );

            if (escapeTotal > grapplerTotal) {

                await this.removeGrappled(actor);
                this.removeGrappleRelationship(grappler, actor);

                ui.notifications.info(`${actor.name} escaped ${grappler.name}'s grapple.`);

                console.log(
                    "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE SUCCESS",
                    "color: lime; font-weight: bold;",
                    actor.name, "escaped from", grappler.name
                );

            } else {

                ui.notifications.info(`${actor.name} failed to escape ${grappler.name}'s grapple.`);

                console.log(
                    "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE FAILED",
                    "color: red; font-weight: bold;",
                    actor.name, "vs", grappler.name
                );

            }

        },


        // ========================================================
        // SHARED SKILL-CHOICE DIALOG
        // (used for both grapple defense and escape attempts)
        // ========================================================

        async chooseSkill(actor, { title, prompt }) {

            return new Promise(resolve => {

                let resolved = false;
                const finish = value => {
                    if (resolved) return;
                    resolved = true;
                    resolve(value);
                };

                new Dialog({

                    title,

                    content: `
                        <p><strong>${actor.name}</strong> ${prompt}</p>
                        <p>Choose Athletics or Acrobatics.</p>
                    `,

                    buttons: {
                        athletics: { label: "Athletics", callback: () => finish("ath") },
                        acrobatics: { label: "Acrobatics", callback: () => finish("acr") }
                    },

                    default: "athletics",
                    close: () => finish(null)

                }).render(true);

            });

        },


        // ========================================================
        // ROLL SKILL
        // ========================================================

        async rollSkill(actor, skillId, flavor) {

            const skill = actor.system?.skills?.[skillId];

            if (!skill) {
                ui.notifications.error(
                    `${actor.name} does not have ${skillId === "ath" ? "Athletics" : "Acrobatics"}.`
                );
                return null;
            }

            const bonus = Number(skill.total ?? skill.bonus ?? 0);

            const roll = await new Roll(`1d20 + ${bonus}`).evaluate();

            await roll.toMessage({
                speaker: ChatMessage.getSpeaker({ actor }),
                flavor: `<strong>${actor.name}</strong> — ${flavor}`
            });

            console.log(
                "%c[ALTERNATE ATTACKS] SKILL ROLL COMPLETE",
                "color: cyan; font-weight: bold;",
                actor.name, skillId, roll.total
            );

            return roll;

        },


        // ========================================================
        // GRAPPLED CONDITION
        // ========================================================

        async applyGrappled(actor) {

            if (!actor) return;

            const alreadyGrappled = this._hasCondition(actor);
            if (alreadyGrappled) {
                console.log("[ALTERNATE ATTACKS] Target already Grappled.");
                return;
            }

            if (typeof actor.toggleStatusEffect === "function") {
                await actor.toggleStatusEffect(CONDITION_ID, { active: true });
                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION APPLIED",
                    "color: lime; font-weight: bold;", actor.name
                );
                return;
            }

            await actor.createEmbeddedDocuments("ActiveEffect", [{
                name: "Grappled",
                statuses: [CONDITION_ID],
                flags: { core: { statusId: CONDITION_ID } }
            }]);

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION APPLIED VIA FALLBACK",
                "color: lime; font-weight: bold;", actor.name
            );

        },


        async removeGrappled(actor) {

            if (!actor) return;

            if (typeof actor.toggleStatusEffect === "function") {

                if (this._hasCondition(actor)) {
                    await actor.toggleStatusEffect(CONDITION_ID, { active: false });
                }

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION REMOVED",
                    "color: lime; font-weight: bold;", actor.name
                );
                return;

            }

            const grappleEffects = actor.effects?.filter(effect => this._isConditionEffect(effect)) ?? [];

            for (const effect of grappleEffects) {
                await effect.delete();
            }

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION REMOVED VIA FALLBACK",
                "color: lime; font-weight: bold;", actor.name
            );

        },


        _isConditionEffect(effect) {
            return (
                effect.statuses?.has?.(CONDITION_ID) ||
                effect.flags?.core?.statusId === CONDITION_ID
            );
        },


        _hasCondition(actor) {
            return actor.effects?.some(effect => this._isConditionEffect(effect)) ?? false;
        },


        // ========================================================
        // RELATIONSHIP TRACKING
        // ========================================================

        addGrappleRelationship(grappler, target) {

            if (!grappler || !target) return;

            this.grapplers.set(grappler.id, target.id);
            this.grappledBy.set(target.id, grappler.id);

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE RELATIONSHIP CREATED",
                "color: lime; font-weight: bold;",
                { grappler: grappler.name, target: target.name }
            );

        },


        getGrappler(actor) {

            if (!actor) return null;

            const grapplerId = this.grappledBy.get(actor.id);
            if (!grapplerId) return null;

            return game.actors?.get(grapplerId) ?? null;

        },


        getGrappledTarget(actor) {

            if (!actor) return null;

            const targetId = this.grapplers.get(actor.id);
            if (!targetId) return null;

            return game.actors?.get(targetId) ?? null;

        },


        removeGrappleRelationship(grappler, target) {

            if (!grappler || !target) return;

            if (this.grapplers.get(grappler.id) === target.id) {
                this.grapplers.delete(grappler.id);
            }

            if (this.grappledBy.get(target.id) === grappler.id) {
                this.grappledBy.delete(target.id);
            }

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE RELATIONSHIP REMOVED",
                "color: cyan; font-weight: bold;",
                { grappler: grappler.name, target: target.name }
            );

        },


        // ========================================================
        // DRAG-ALONG MOVEMENT
        //
        // preUpdateToken fires before a token's x/y actually change,
        // so it's the only reliable place to capture the "old"
        // position. updateToken fires right after, once the new
        // position is committed — that's where we move the target
        // by the same delta.
        // ========================================================

        handlePreUpdateToken(tokenDoc, changes) {

            if (!("x" in changes) && !("y" in changes)) return;

            const actor = tokenDoc.actor;
            if (!actor) return;

            if (!this.grapplers.has(actor.id)) return;

            this._pendingTokenMove.set(tokenDoc.id, { x: tokenDoc.x, y: tokenDoc.y });

        },


        handleUpdateToken(tokenDoc, changes) {

            if (!("x" in changes) && !("y" in changes)) return;

            const actor = tokenDoc.actor;
            if (!actor) return;

            const targetActorId = this.grapplers.get(actor.id);

            if (!targetActorId) {
                this._pendingTokenMove.delete(tokenDoc.id);
                return;
            }

            const oldPos = this._pendingTokenMove.get(tokenDoc.id);
            this._pendingTokenMove.delete(tokenDoc.id);

            if (!oldPos) return;

            const deltaX = tokenDoc.x - oldPos.x;
            const deltaY = tokenDoc.y - oldPos.y;

            if (deltaX === 0 && deltaY === 0) return;

            const targetActor = game.actors?.get(targetActorId);
            if (!targetActor) return;

            const targetTokens = targetActor.getActiveTokens(false, true);
            const targetToken = targetTokens[0];

            if (!targetToken) {
                console.warn(
                    "[ALTERNATE ATTACKS] Grappled target has no active token on this scene; could not drag."
                );
                return;
            }

            targetToken.update({
                x: targetToken.x + deltaX,
                y: targetToken.y + deltaY
            }).catch(error => {
                console.error("[ALTERNATE ATTACKS] Failed to drag grapple target:", error);
            });

            console.log(
                "%c[ALTERNATE ATTACKS] DRAGGED TARGET",
                "color: gold; font-weight: bold;",
                { grappler: actor.name, target: targetActor.name, deltaX, deltaY }
            );

        },


        // ========================================================
        // DOUBLE MOVEMENT COST WHILE DRAGGING
        //
        // movement-tracker.js already records the grappler's normal
        // movement cost from this same "moveToken" event. We simply
        // record it a second time to double the total deduction.
        //
        // KNOWN LIMITATION: movement-tracker's pre-move path limiter
        // only knows about the base (non-doubled) cost when deciding
        // how far a move is allowed to go, so a grappler who spends
        // their *entire* remaining movement in one move while
        // dragging can end up "overdrawn" (clamped to 0) rather than
        // being stopped early. In practice this just means they
        // can't move again that turn — nothing breaks — but it's not
        // a perfectly accurate cap.
        // ========================================================

        handleMoveTokenCost(tokenDoc, movement) {

            const actor = tokenDoc.actor;
            if (!actor) return;

            if (!this.grapplers.has(actor.id)) return;

            const cost = Number(movement?.passed?.cost ?? 0);
            const distance = Number(movement?.passed?.distance ?? 0);

            if (cost <= 0) return;

            globalThis.movementTracker?.recordMovement?.(actor, cost, distance);

            console.log(
                "%c[ALTERNATE ATTACKS] DOUBLED MOVEMENT COST (dragging grapple target)",
                "color: orange; font-weight: bold;",
                actor.name, `+${cost} ft`
            );

        }

    };

    // Register immediately — see the ordering note at the top of
    // this file for why this can't wait for Hooks.once("ready").
    globalThis.alternateAttacks.init();

    console.log(
        "%c[ALTERNATE ATTACKS] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
