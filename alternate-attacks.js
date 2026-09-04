// ============================================================
// ACTION ECONOMY CONTROLLER
// ALTERNATE ATTACKS — GRAPPLE
// Foundry VTT 13 / D&D 5e 5.3.3
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

        grapplers: new Map(),
        grappledBy: new Map(),

        socket: null,
        socketReady: false,

        endingGrapples: new Set(),

        // ========================================================
        // INIT
        // ========================================================

        init() {

            if (globalThis.__aecAlternateAttacksInitialized) {
                console.warn("[ALTERNATE ATTACKS] Already initialized.");
                return;
            }

            globalThis.__aecAlternateAttacksInitialized = true;

            this.initSocket();

            Hooks.on(
                "dnd5e.preUseActivity",
                (activity, usageConfig) =>
                    this.handlePreUseActivity(activity, usageConfig)
            );

            Hooks.on(
                "dnd5e.postUseActivity",
                (activity, usageConfig, results) =>
                    this.handlePostUseActivity(
                        activity,
                        usageConfig,
                        results
                    )
            );

            Hooks.on(
                "moveToken",
                (tokenDoc, movement) =>
                    this.handleGrapplerMoved(tokenDoc, movement)
            );

            console.log(
                "%c[ALTERNATE ATTACKS] Grapple handlers installed.",
                "color: lime; font-weight: bold;"
            );

        },

        // ========================================================
        // SOCKETLIB
        // ========================================================

        initSocket() {

            if (!globalThis.socketlib) {

                console.warn(
                    "[ALTERNATE ATTACKS] socketlib not available."
                );

                return;

            }

            Hooks.once("socketlib.ready", () => {

                this.socket = socketlib.registerModule(
                    "action-economy-controller"
                );

                this.socket.register(
                    "chooseGrappleSkill",
                    this._socketChooseGrappleSkill.bind(this)
                );

                this.socket.register(
                    "applyGrappled",
                    this._socketApplyGrappled.bind(this)
                );

                this.socket.register(
                    "removeGrappled",
                    this._socketRemoveGrappled.bind(this)
                );

                this.socket.register(
                    "setGrappleRelationship",
                    this._socketSetGrappleRelationship.bind(this)
                );

                this.socket.register(
                    "clearGrappleRelationship",
                    this._socketClearGrappleRelationship.bind(this)
                );

                this.socketReady = true;

                console.log(
                    "%c[ALTERNATE ATTACKS] socketlib ready.",
                    "color: lime; font-weight: bold;"
                );

            });

        },

        // ========================================================
        // SOCKET: RELATIONSHIP SYNCHRONIZATION
        // ========================================================

        async syncGrappleRelationship(grappler, target) {

            if (!grappler || !target) return;

            if (!this.socketReady) {

                this.addGrappleRelationship(grappler, target);
                return;

            }

            await this.socket.executeForEveryone(
                "setGrappleRelationship",
                grappler.id,
                target.id
            );

        },

        async _socketSetGrappleRelationship(
            grapplerId,
            targetId
        ) {

            const grappler = game.actors.get(grapplerId);
            const target = game.actors.get(targetId);

            if (!grappler || !target) return;

            this.addGrappleRelationship(grappler, target);

        },

        async syncClearGrappleRelationship(grappler, target) {

            if (!grappler || !target) return;

            if (!this.socketReady) {

                this.removeGrappleRelationship(grappler, target);
                return;

            }

            await this.socket.executeForEveryone(
                "clearGrappleRelationship",
                grappler.id,
                target.id
            );

        },

        async _socketClearGrappleRelationship(
            grapplerId,
            targetId
        ) {

            const grappler = game.actors.get(grapplerId);
            const target = game.actors.get(targetId);

            if (!grappler || !target) return;

            this.removeGrappleRelationship(grappler, target);

        },

        // ========================================================
        // SOCKET: TARGET SKILL CHOICE
        // ========================================================

        async requestTargetSkillChoice(actor, options = {}) {

            if (!actor) return null;

            const ownerUser = game.users.find(user =>
                user.active &&
                !user.isGM &&
                actor.testUserPermission(
                    user,
                    CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER
                )
            );

            const userId = ownerUser?.id;

            if (!userId) {

                if (game.user.isGM) {
                    return this.chooseSkill(actor, options);
                }

                return null;

            }

            if (userId === game.user.id) {
                return this.chooseSkill(actor, options);
            }

            if (!this.socketReady) {

                ui.notifications.error(
                    "Grapple system is not ready. Please try again."
                );

                return null;

            }

            return this.socket.executeAsUser(
                "chooseGrappleSkill",
                userId,
                actor.id,
                options
            );

        },

        async _socketChooseGrappleSkill(actorId, options = {}) {

            const actor = game.actors.get(actorId);

            if (!actor) return null;

            return this.chooseSkill(actor, options);

        },

        // ========================================================
        // SOCKET: CONDITION APPLICATION
        // ========================================================

        async requestApplyGrappled(actor) {

            if (!actor) return false;

            if (game.user.isGM) {

                await this.applyGrappled(actor);
                return true;

            }

            if (!this.socketReady) {

                ui.notifications.error(
                    "Grapple system is not ready. Please try again."
                );

                return false;

            }

            return this.socket.executeAsGM(
                "applyGrappled",
                actor.id
            );

        },

        async _socketApplyGrappled(actorId) {

            const actor = game.actors.get(actorId);

            if (!actor) return false;

            await this.applyGrappled(actor);

            return true;

        },

        async requestRemoveGrappled(actor) {

            if (!actor) return false;

            if (game.user.isGM) {

                await this.removeGrappled(actor);
                return true;

            }

            if (!this.socketReady) return false;

            return this.socket.executeAsGM(
                "removeGrappled",
                actor.id
            );

        },

        async _socketRemoveGrappled(actorId) {

            const actor = game.actors.get(actorId);

            if (!actor) return false;

            await this.removeGrappled(actor);

            return true;

        },

        // ========================================================
        // DETECT GRAPPLE ACTIVITY
        // ========================================================

        isGrappleActivity(activity) {

            if (!activity) return false;

            const activityName = String(
                activity.name ?? ""
            ).trim().toLowerCase();

            const itemName = String(
                activity.item?.name ?? ""
            ).trim().toLowerCase();

            return (
                activityName.includes("grapple") ||
                itemName.includes("grapple")
            );

        },

        // ========================================================
        // END GRAPPLE
        // ========================================================

        async endGrapple(actor) {

            if (!actor) return false;

            if (this.endingGrapples.has(actor.id)) {
                return false;
            }

            const target = this.getGrappledTarget(actor);

            if (!target) {

                ui.notifications.warn(
                    `${actor.name} is not grappling anyone.`
                );

                return false;

            }

            this.endingGrapples.add(actor.id);

            try {

                const removed = await this.requestRemoveGrappled(
                    target
                );

                if (removed === false) {

                    ui.notifications.error(
                        `Could not remove Grappled from ${target.name}.`
                    );

                    return false;

                }

                await this.syncClearGrappleRelationship(
                    actor,
                    target
                );

                ui.notifications.info(
                    `${actor.name} ended the grapple with ${target.name}.`
                );

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLE ENDED",
                    "color: cyan; font-weight: bold;",
                    actor.name,
                    "→",
                    target.name
                );

                return true;

            } finally {

                this.endingGrapples.delete(actor.id);

            }

        },

        // ========================================================
        // INITIATE GRAPPLE
        // ========================================================

        async handlePostUseActivity(
            activity,
            usageConfig,
            results
        ) {

            if (!this.isGrappleActivity(activity)) return;

            const actor = activity.actor;

            if (!actor) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple has no actor."
                );

                return;

            }

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE DETECTED",
                "color: orange; font-weight: bold;",
                actor.name
            );

            const target = this.getTarget(
                usageConfig,
                results,
                activity
            );

            if (!target) {

                ui.notifications.warn(
                    "Grapple requires a target."
                );

                return;

            }

            const targetActor = target.actor;

            if (!targetActor) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple target has no actor."
                );

                return;

            }

            if (!this.canGrappleTarget(actor, targetActor)) {

                ui.notifications.warn(
                    `${target.name} is too large to grapple.`
                );

                return;

            }

            const attackerRoll = await this.rollSkill(
                actor,
                "ath",
                "Grapple — Athletics"
            );

            if (!attackerRoll) return;

            const targetSkill = await this.requestTargetSkillChoice(
                targetActor,
                {
                    title: "Grapple Defense",
                    prompt:
                        "must choose a skill to resist the grapple."
                }
            );

            if (!targetSkill) return;

            const targetRoll = await this.rollSkill(
                targetActor,
                targetSkill,
                `Grapple — ${
                    targetSkill === "ath"
                        ? "Athletics"
                        : "Acrobatics"
                }`
            );

            if (!targetRoll) return;

            const attackerTotal = Number(
                attackerRoll.total ?? 0
            );

            const targetTotal = Number(
                targetRoll.total ?? 0
            );

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE CONTEST",
                "color: gold; font-weight: bold;",
                {
                    attacker: attackerTotal,
                    target: targetTotal
                }
            );

            if (attackerTotal > targetTotal) {

                const applied = await this.requestApplyGrappled(
                    targetActor
                );

                if (applied === false) {

                    ui.notifications.error(
                        `Could not apply Grappled to ${target.name}.`
                    );

                    return;

                }

                await this.syncGrappleRelationship(
                    actor,
                    targetActor
                );

                ui.notifications.info(
                    `${actor.name} successfully grappled ${target.name}.`
                );

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLE SUCCESS",
                    "color: lime; font-weight: bold;",
                    actor.name,
                    "→",
                    target.name
                );

            } else {

                ui.notifications.info(
                    `${actor.name} failed to grapple ${target.name}.`
                );

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLE FAILED",
                    "color: red; font-weight: bold;",
                    actor.name,
                    "→",
                    target.name
                );

            }

        },

        // ========================================================
        // GET TARGET
        // ========================================================

        getTarget(usageConfig, results, activity) {

            const workflow =
                results?.workflow ??
                usageConfig?.workflow;

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

            const controlledTargets = Array.from(
                game.user?.targets ?? []
            );

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

            if (
                attackerSize === null ||
                targetSize === null
            ) {

                console.warn(
                    "[ALTERNATE ATTACKS] Could not determine creature size; allowing grapple."
                );

                return true;

            }

            return targetSize <= attackerSize + 1;

        },

        getSizeIndex(actor) {

            const size = actor?.system?.traits?.size;

            if (!size) return null;

            const sizes = [
                "tiny",
                "sm",
                "med",
                "lg",
                "huge",
                "grg"
            ];

            const normalized = String(size)
                .trim()
                .toLowerCase();

            const index = sizes.indexOf(normalized);

            return index >= 0 ? index : null;

        },

        // ========================================================
        // ESCAPE INTERCEPTION
        // ========================================================

        handlePreUseActivity(activity, usageConfig) {

            if (!activity) return true;

            const actor = activity.actor;

            if (!actor) return true;

            // The Grapple feature ends an existing grapple for free.
            // Return false immediately so Action Economy cannot
            // reserve the Action before cleanup finishes.

            if (
                this.isGrappleActivity(activity) &&
                this.grapplers.has(actor.id)
            ) {

                this.endGrapple(actor).catch(error => {

                    console.error(
                        "[ALTERNATE ATTACKS] Failed to end grapple:",
                        error
                    );

                });

                return false;

            }

            // Allow the original Action to be re-fired after the
            // player chooses "Use Action" in the escape prompt.

            if (usageConfig?.__aecSkipGrappleEscape) {
                return true;
            }

            const resource =
                globalThis.actionEconomy?.getResource?.(activity);

            if (resource !== "action") return true;

            const grappler = this.getGrappler(actor);

            if (!grappler) return true;

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED ACTION INTERCEPTED",
                "color: orange; font-weight: bold;",
                {
                    actor: actor.name,
                    action: activity.name,
                    grappler: grappler.name
                }
            );

            const originalActivationType =
                activity.activation?.type;

            if (activity.activation) {
                activity.activation.type = "none";
            }

            setTimeout(() => {

                if (activity.activation) {
                    activity.activation.type =
                        originalActivationType;
                }

            }, 0);

            setTimeout(() => {

                this.showEscapePrompt(
                    actor,
                    grappler,
                    activity,
                    usageConfig
                );

            }, 0);

            return false;

        },

        // ========================================================
        // ESCAPE PROMPT
        // ========================================================

        async showEscapePrompt(
            actor,
            grappler,
            activity,
            usageConfig
        ) {

            if (!actor || !grappler || !activity) return;

            const choice = await this.chooseEscapeAction(
                actor,
                grappler
            );

            if (choice === "cancel") {

                console.log(
                    "[ALTERNATE ATTACKS] Escape prompt cancelled."
                );

                return;

            }

            if (choice === "action") {

                console.log(
                    "%c[ALTERNATE ATTACKS] Player chose normal Action.",
                    "color: cyan; font-weight: bold;",
                    actor.name,
                    activity.name
                );

                try {

                    await activity.use({
                        ...usageConfig,
                        __aecSkipGrappleEscape: true
                    });

                } catch (error) {

                    console.error(
                        "[ALTERNATE ATTACKS] Failed to re-fire original Action:",
                        error
                    );

                }

                return;

            }

            if (choice === "escape") {

                console.log(
                    "%c[ALTERNATE ATTACKS] Player chose Escape Grapple.",
                    "color: gold; font-weight: bold;",
                    actor.name
                );

                await this.handleEscapeGrapple(
                    actor,
                    grappler
                );

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
                        <p>
                            <strong>${actor.name}</strong> is currently
                            grappled by <strong>${grappler.name}</strong>.
                        </p>
                        <p>
                            Would you like to attempt to escape the grapple?
                        </p>
                    `,

                    buttons: {

                        yes: {
                            label: "Yes — Escape Grapple",
                            callback: () => finish("escape")
                        },

                        no: {
                            label: "No — Use Action",
                            callback: () => finish("action")
                        },

                        cancel: {
                            label: "Cancel",
                            callback: () => finish("cancel")
                        }

                    },

                    default: "yes",

                    close: () => finish("cancel")

                }).render(true);

            });

        },

        // ========================================================
        // ESCAPE GRAPPLE
        // ========================================================

        async handleEscapeGrapple(actor, grappler) {

            if (!actor || !grappler) return;

            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE ATTEMPT",
                "color: gold; font-weight: bold;",
                actor.name,
                "→",
                grappler.name
            );

            const state =
                globalThis.actionEconomy?.getState?.(actor);

            if (state?.action) {

                ui.notifications.warn(
                    `${actor.name} has already used their Action.`
                );

                console.warn(
                    "[ALTERNATE ATTACKS] Escape blocked — Action already used."
                );

                return;

            }

            const actionUsed =
                globalThis.actionEconomy?.use?.(
                    actor,
                    "action"
                );

            if (actionUsed === false) {

                ui.notifications.warn(
                    `${actor.name} cannot use an Action right now.`
                );

                return;

            }

            const escapeSkill = await this.chooseSkill(
                actor,
                {
                    title: "Escape Grapple",
                    prompt:
                        "must choose a skill to escape the grapple."
                }
            );

            if (!escapeSkill) {

                console.log(
                    "[ALTERNATE ATTACKS] Escape skill selection cancelled."
                );

                return;

            }

            const escapeRoll = await this.rollSkill(
                actor,
                escapeSkill,
                `Escape Grapple — ${
                    escapeSkill === "ath"
                        ? "Athletics"
                        : "Acrobatics"
                }`
            );

            if (!escapeRoll) return;

            const grapplerRoll = await this.rollSkill(
                grappler,
                "ath",
                "Escape Grapple — Grappler Athletics"
            );

            if (!grapplerRoll) return;

            const escapeTotal = Number(
                escapeRoll.total ?? 0
            );

            const grapplerTotal = Number(
                grapplerRoll.total ?? 0
            );

            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE CONTEST",
                "color: gold; font-weight: bold;",
                {
                    escaping: actor.name,
                    escapeSkill,
                    escapeTotal,
                    grappler: grappler.name,
                    grapplerTotal
                }
            );

            if (escapeTotal > grapplerTotal) {

                const removed = await this.requestRemoveGrappled(
                    actor
                );

                if (removed === false) {

                    ui.notifications.error(
                        `Could not remove Grappled from ${actor.name}.`
                    );

                    return;

                }

                await this.syncClearGrappleRelationship(
                    grappler,
                    actor
                );

                ui.notifications.info(
                    `${actor.name} escaped ${grappler.name}'s grapple.`
                );

                console.log(
                    "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE SUCCESS",
                    "color: lime; font-weight: bold;",
                    actor.name,
                    "escaped from",
                    grappler.name
                );

            } else {

                ui.notifications.info(
                    `${actor.name} failed to escape ${grappler.name}'s grapple.`
                );

                console.log(
                    "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE FAILED",
                    "color: red; font-weight: bold;",
                    actor.name,
                    "vs",
                    grappler.name
                );

            }

        },

        // ========================================================
        // SKILL-CHOICE DIALOG
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
                        <p>
                            <strong>${actor.name}</strong> ${prompt}
                        </p>
                        <p>
                            Choose Athletics or Acrobatics.
                        </p>
                    `,

                    buttons: {

                        athletics: {
                            label: "Athletics",
                            callback: () => finish("ath")
                        },

                        acrobatics: {
                            label: "Acrobatics",
                            callback: () => finish("acr")
                        }

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
                    `${actor.name} does not have ${
                        skillId === "ath"
                            ? "Athletics"
                            : "Acrobatics"
                    }.`
                );

                return null;

            }

            const bonus = Number(
                skill.total ?? skill.bonus ?? 0
            );

            const roll = await new Roll(
                `1d20 + ${bonus}`
            ).evaluate();

            await roll.toMessage({

                speaker: ChatMessage.getSpeaker({
                    actor
                }),

                flavor:
                    `<strong>${actor.name}</strong> — ${flavor}`

            });

            console.log(
                "%c[ALTERNATE ATTACKS] SKILL ROLL COMPLETE",
                "color: cyan; font-weight: bold;",
                actor.name,
                skillId,
                roll.total
            );

            return roll;

        },

        // ========================================================
        // GRAPPLED CONDITION
        // ========================================================

        async applyGrappled(actor) {

            if (!actor) return;

            if (this._hasCondition(actor)) {

                console.log(
                    "[ALTERNATE ATTACKS] Target already Grappled."
                );

                return;

            }

            if (
                typeof actor.toggleStatusEffect ===
                "function"
            ) {

                await actor.toggleStatusEffect(
                    CONDITION_ID,
                    {
                        active: true
                    }
                );

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION APPLIED",
                    "color: lime; font-weight: bold;",
                    actor.name
                );

                return;

            }

            await actor.createEmbeddedDocuments(
                "ActiveEffect",
                [
                    {
                        name: "Grappled",
                        statuses: [CONDITION_ID],
                        flags: {
                            core: {
                                statusId: CONDITION_ID
                            }
                        }
                    }
                ]
            );

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION APPLIED VIA FALLBACK",
                "color: lime; font-weight: bold;",
                actor.name
            );

        },

        async removeGrappled(actor) {

            if (!actor) return;

            if (
                typeof actor.toggleStatusEffect ===
                "function"
            ) {

                if (this._hasCondition(actor)) {

                    await actor.toggleStatusEffect(
                        CONDITION_ID,
                        {
                            active: false
                        }
                    );

                }

                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION REMOVED",
                    "color: lime; font-weight: bold;",
                    actor.name
                );

                return;

            }

            const grappleEffects =
                actor.effects?.filter(effect =>
                    this._isConditionEffect(effect)
                ) ?? [];

            for (const effect of grappleEffects) {
                await effect.delete();
            }

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION REMOVED VIA FALLBACK",
                "color: lime; font-weight: bold;",
                actor.name
            );

        },

        _isConditionEffect(effect) {

            return (
                effect.statuses?.has?.(CONDITION_ID) ||
                effect.flags?.core?.statusId === CONDITION_ID
            );

        },

        _hasCondition(actor) {

            return actor.effects?.some(effect =>
                this._isConditionEffect(effect)
            ) ?? false;

        },

        // ========================================================
        // RELATIONSHIP TRACKING
        // ========================================================

        addGrappleRelationship(grappler, target) {

            if (!grappler || !target) return;

            this.grapplers.set(
                grappler.id,
                target.id
            );

            this.grappledBy.set(
                target.id,
                grappler.id
            );

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE RELATIONSHIP CREATED",
                "color: lime; font-weight: bold;",
                {
                    grappler: grappler.name,
                    target: target.name
                }
            );

        },

        getGrappler(actor) {

            if (!actor) return null;

            const grapplerId =
                this.grappledBy.get(actor.id);

            if (!grapplerId) return null;

            return game.actors?.get(grapplerId) ?? null;

        },

        getGrappledTarget(actor) {

            if (!actor) return null;

            const targetId =
                this.grapplers.get(actor.id);

            if (!targetId) return null;

            return game.actors?.get(targetId) ?? null;

        },

        removeGrappleRelationship(grappler, target) {

            if (!grappler || !target) return;

            if (
                this.grapplers.get(grappler.id) === target.id
            ) {

                this.grapplers.delete(grappler.id);

            }

            if (
                this.grappledBy.get(target.id) === grappler.id
            ) {

                this.grappledBy.delete(target.id);

            }

            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE RELATIONSHIP REMOVED",
                "color: cyan; font-weight: bold;",
                {
                    grappler: grappler.name,
                    target: target.name
                }
            );

        },

        // ========================================================
        // DRAG-ALONG MOVEMENT + DOUBLE MOVEMENT COST
        // ========================================================

        handleGrapplerMoved(tokenDoc, movement) {

            const actor = tokenDoc.actor;

            if (!actor) return;

            if (!this.grapplers.has(actor.id)) return;

            const cost = Number(
                movement?.passed?.cost ?? 0
            );

            const distance = Number(
                movement?.passed?.distance ?? 0
            );

            if (cost > 0) {

                globalThis.movementTracker
                    ?.recordMovement
                    ?.(
                        actor,
                        cost,
                        distance
                    );

                console.log(
                    "%c[ALTERNATE ATTACKS] DOUBLED MOVEMENT COST",
                    "color: orange; font-weight: bold;",
                    actor.name,
                    `+${cost} ft`
                );

            }

            const origin = movement?.origin;
            const destination = movement?.destination;

            if (!origin || !destination) return;

            const deltaX =
                Number(destination.x ?? 0) -
                Number(origin.x ?? 0);

            const deltaY =
                Number(destination.y ?? 0) -
                Number(origin.y ?? 0);

            if (deltaX === 0 && deltaY === 0) return;

            const targetActorId =
                this.grapplers.get(actor.id);

            const targetActor =
                game.actors?.get(targetActorId);

            if (!targetActor) return;

            const targetToken =
                targetActor.getActiveTokens(false, true)[0];

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

                console.error(
                    "[ALTERNATE ATTACKS] Failed to drag grapple target:",
                    error
                );

            });

            console.log(
                "%c[ALTERNATE ATTACKS] DRAGGED TARGET",
                "color: gold; font-weight: bold;",
                {
                    grappler: actor.name,
                    target: targetActor.name,
                    deltaX,
                    deltaY
                }
            );

        }

    };

    // Register immediately.
    globalThis.alternateAttacks.init();

    console.log(
        "%c[ALTERNATE ATTACKS] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
