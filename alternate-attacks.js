// ============================================================
// ACTION ECONOMY CONTROLLER
// ALTERNATE ATTACKS — GRAPPLE
//
// Foundry VTT 13
// D&D 5e 5.3.3
//
// Handles:
//
//   • Grapple target size restriction
//   • Athletics vs Athletics/Acrobatics contest
//   • Grappled condition
//   • Grapple relationship tracking
//   • Contextual Escape Grapple prompt
//   • Escape Grapple Athletics/Acrobatics contest
//
// IMPORTANT:
// This file must load BEFORE action-economy.js so that the
// preUseActivity interception occurs before Action Economy
// reserves the Action.
//
// ============================================================

console.log(
    "%c[ALTERNATE ATTACKS] MODULE LOADING",
    "color: cyan; font-size: 16px; font-weight: bold;"
);


// ============================================================
// PREVENT DUPLICATE INITIALIZATION
// ============================================================

if (globalThis.alternateAttacks) {

    console.warn(
        "[ALTERNATE ATTACKS] Already initialized."
    );

} else {

    globalThis.alternateAttacks = {

        // ========================================================
        // GRAPPLE RELATIONSHIPS
        // ========================================================

        grapplers: new Map(),

        grappledBy: new Map(),


        // ========================================================
        // INITIALIZATION
        // ========================================================

        init() {

            if (
                globalThis.__aecAlternateAttacksInitialized
            ) {

                console.warn(
                    "[ALTERNATE ATTACKS] Already initialized."
                );

                return;

            }


            globalThis.__aecAlternateAttacksInitialized =
                true;


            // ----------------------------------------------------
            // IMPORTANT:
            //
            // This hook MUST be registered before the Action
            // Economy controller's preUseActivity hook.
            // ----------------------------------------------------

            Hooks.on(
                "dnd5e.preUseActivity",
                (
                    activity,
                    usageConfig
                ) => {

                    return this.handlePreUseActivity(
                        activity,
                        usageConfig
                    );

                }
            );


            // ----------------------------------------------------
            // GRAPPLE POST USE
            // ----------------------------------------------------

            Hooks.on(
                "dnd5e.postUseActivity",
                (
                    activity,
                    usageConfig,
                    results
                ) => {

                    this.handlePostUseActivity(
                        activity,
                        usageConfig,
                        results
                    );

                }
            );


            console.log(
                "%c[ALTERNATE ATTACKS] Grapple + Escape Grapple handlers installed.",
                "color: lime; font-weight: bold;"
            );

        },


        // ========================================================
        // PRE-USE ACTIVITY
        //
        // If a Grappled creature attempts to use an Action:
        //
        //   1. Temporarily prevent AEC from consuming the Action.
        //   2. Cancel the original Action.
        //   3. Show the Escape Grapple prompt.
        //
        // YES:
        //     Consume Action for Escape Grapple.
        //
        // NO:
        //     Re-fire the original Action normally.
        //
        // CANCEL:
        //     Do nothing.
        //
        // Bonus Actions and Reactions are untouched.
        // ========================================================

        handlePreUseActivity(
            activity,
            usageConfig
        ) {

            if (!activity) {
                return true;
            }


            const actor =
                activity.actor;


            if (!actor) {
                return true;
            }


            // ----------------------------------------------------
            // Ignore our own re-fired Action.
            // ----------------------------------------------------

            if (
                usageConfig?.__aecSkipGrappleEscape
            ) {

                return true;

            }


            // ----------------------------------------------------
            // Only Actions can trigger Escape Grapple.
            // ----------------------------------------------------

            const resource =
                globalThis.actionEconomy?.getResource?.(
                    activity
                );


            if (
                resource !== "action"
            ) {

                return true;

            }


            // ----------------------------------------------------
            // Find the creature currently grappling this actor.
            // ----------------------------------------------------

            const grappler =
                this.getGrappler(
                    actor
                 );


            if (!grappler) {

                return true;

            }


            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED ACTION INTERCEPTED",
                "color: orange; font-weight: bold;",
                {
                    actor:
                        actor.name,

                    action:
                        activity.name,

                    grappler:
                        grappler.name
                }
            );


            // ----------------------------------------------------
            // IMPORTANT
            //
            // Returning false from this hook does NOT prevent other
            // preUseActivity listeners from executing.
            //
            // Therefore AEC would still see this Action and consume
            // it before our Escape prompt finishes.
            //
            // Temporarily change the activity's activation type so
            // AEC sees this particular intercepted use as a resource
            // it does not track.
            //
            // The activity is already being cancelled, so the original
            // activation type is restored immediately afterward.
            // ----------------------------------------------------

            const originalActivationType =
                activity.activation?.type;


            if (
                activity.activation
            ) {

                activity.activation.type =
            "none";

            }


            // ----------------------------------------------------
            // Restore the activity after the current hook chain has
            // finished.
            //
            // This gives AEC a chance to inspect the modified type,
            // while ensuring the activity itself is completely restored
            // before any later use.
            // ----------------------------------------------------

            setTimeout(
                () => {
    
                    if (
                        activity.activation
                    ) {

                        activity.activation.type =
                            originalActivationType;

                    }
    
                },
                0
            );


            // ----------------------------------------------------
            // Open the prompt after the current hook chain completes.
            // ----------------------------------------------------

            setTimeout(
                () => {

                    this.showEscapePrompt(
                        actor,
                        grappler,
                        activity,
                        usageConfig
                    );

                },
                0
            );


            // ----------------------------------------------------
            // Cancel the original Action.
            // ----------------------------------------------------

            return false;

},


        // ========================================================
        // SHOW ESCAPE PROMPT
        // ========================================================

        async showEscapePrompt(
            actor,
            grappler,
            activity,
            usageConfig
        ) {

            if (
                !actor ||
                !grappler ||
                !activity
            ) {

                return;

            }


            const choice =
                await this.chooseEscapeAction(
                    actor,
                    grappler
                );


            // ====================================================
            // CANCEL
            // ====================================================

            if (
                choice === "cancel"
            ) {

                console.log(
                    "[ALTERNATE ATTACKS] Escape prompt cancelled."
                );


                return;

            }


            // ====================================================
            // NO — USE THE ORIGINAL ACTION
            // ====================================================

            if (
                choice === "action"
            ) {

                console.log(
                    "%c[ALTERNATE ATTACKS] Player chose normal Action.",
                    "color: cyan; font-weight: bold;",
                    actor.name,
                    activity.name
                );


                try {

                    await activity.use({
                        ...usageConfig,

                        __aecSkipGrappleEscape:
                            true

                    });

                } catch (error) {

                    console.error(
                        "[ALTERNATE ATTACKS] Failed to re-fire original Action:",
                        error
                    );

                }


                return;

            }


            // ====================================================
            // YES — ESCAPE GRAPPLE
            // ====================================================

            if (
                choice === "escape"
            ) {

                console.log(
                    "%c[ALTERNATE ATTACKS] Player chose Escape Grapple.",
                    "color: gold; font-weight: bold;",
                    actor.name
                );


                await this.handleEscapeGrapple(
                    actor,
                    grappler
                );


                return;

            }

        },


        // ========================================================
        // ESCAPE PROMPT
        //
        // YES / NO / CANCEL
        // ========================================================

        async chooseEscapeAction(
            actor,
            grappler
        ) {

            return new Promise(
                resolve => {

                    let resolved =
                        false;


                    const finish =
                        value => {

                            if (resolved) {
                                return;
                            }


                            resolved =
                                true;


                            resolve(
                                value
                            );

                        };


                    new Dialog({

                        title:
                            "Grappled",

                        content:
                            `
                                <p>
                                    <strong>${actor.name}</strong>
                                    is currently grappled by
                                    <strong>${grappler.name}</strong>.
                                </p>

                                <p>
                                    Would you like to attempt to escape
                                    the grapple?
                                </p>
                            `,

                        buttons: {

                            yes: {

                                label:
                                    "Yes — Escape Grapple",

                                callback:
                                    () => finish(
                                        "escape"
                                    )

                            },

                            no: {

                                label:
                                    "No — Use Action",

                                callback:
                                    () => finish(
                                        "action"
                                    )

                            },

                            cancel: {

                                label:
                                    "Cancel",

                                callback:
                                    () => finish(
                                        "cancel"
                                    )

                            }

                        },

                        default:
                            "yes",

                        close:
                            () => finish(
                                "cancel"
                            )

                    }).render(true);

                }
            );

        },


        // ========================================================
        // HANDLE ESCAPE GRAPPLE
        // ========================================================

        async handleEscapeGrapple(
            actor,
            grappler
        ) {

            if (
                !actor ||
                !grappler
            ) {

                return;

            }


            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE ATTEMPT",
                "color: gold; font-weight: bold;",
                actor.name,
                "→",
                grappler.name
            );


            // ----------------------------------------------------
            // Confirm Action is available.
            //
            // Because this module intercepted BEFORE the core
            // Action Economy hook, the Action should still be
            // unused here.
            // ----------------------------------------------------

            const state =
                globalThis.actionEconomy?.getState?.(
                    actor
                );


            if (
                state?.action
            ) {

                ui.notifications.warn(
                    `${actor.name} has already used their Action.`
                );


                console.warn(
                    "[ALTERNATE ATTACKS] Escape blocked — Action already used."
                );


                return;

            }


            // ----------------------------------------------------
            // Consume Action.
            // ----------------------------------------------------

            const actionUsed =
                globalThis.actionEconomy?.use?.(
                    actor,
                    "action"
                );


            if (
                actionUsed === false
            ) {

                ui.notifications.warn(
                    `${actor.name} cannot use an Action right now.`
                );


                return;

            }


            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE ACTION CONSUMED",
                "color: orange; font-weight: bold;",
                actor.name
            );


            // ----------------------------------------------------
            // Choose Athletics or Acrobatics.
            // ----------------------------------------------------

            const escapeSkill =
                await this.chooseEscapeSkill(
                    actor
                );


            if (!escapeSkill) {

                console.log(
                    "[ALTERNATE ATTACKS] Escape skill selection cancelled."
                );


                return;

            }


            // ----------------------------------------------------
            // Escaping creature rolls.
            // ----------------------------------------------------

            const escapeRoll =
                await this.rollSkill(
                    actor,
                    escapeSkill,
                    `Escape Grapple — ${escapeSkill === "ath" ? "Athletics" : "Acrobatics"}`
                );


            if (!escapeRoll) {

                console.warn(
                    "[ALTERNATE ATTACKS] Escape roll failed."
                );


                return;

            }


            // ----------------------------------------------------
            // Grappler rolls Athletics.
            // ----------------------------------------------------

            const grapplerRoll =
                await this.rollSkill(
                    grappler,
                    "ath",
                    "Escape Grapple — Grappler Athletics"
                );


            if (!grapplerRoll) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grappler Athletics roll failed."
                );


                return;

            }


            // ----------------------------------------------------
            // COMPARE
            //
            // Escaping creature must EXCEED the grappler.
            // A tie fails.
            // ----------------------------------------------------

            const escapeTotal =
                Number(
                    escapeRoll.total ?? 0
                );


            const grapplerTotal =
                Number(
                    grapplerRoll.total ?? 0
                );


            console.log(
                "%c[ALTERNATE ATTACKS] ESCAPE GRAPPLE CONTEST",
                "color: gold; font-weight: bold;",
                {
                    escaping:
                        actor.name,

                    escapeSkill:
                        escapeSkill,

                    escapeTotal:
                        escapeTotal,

                    grappler:
                        grappler.name,

                    grapplerTotal:
                        grapplerTotal
                }
            );


            // ====================================================
            // SUCCESS
            // ====================================================

            if (
                escapeTotal >
                grapplerTotal
            ) {

                await this.removeGrappled(
                    actor
                );


                this.removeGrappleRelationship(
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


                return;

            }


            // ====================================================
            // FAILURE / TIE
            // ====================================================

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

        },


        // ========================================================
        // CHOOSE ESCAPE SKILL
        // ========================================================

        async chooseEscapeSkill(
            actor
        ) {

            return new Promise(
                resolve => {

                    let resolved =
                        false;


                    const finish =
                        value => {

                            if (resolved) {
                                return;
                            }


                            resolved =
                                true;


                            resolve(
                                value
                            );

                        };


                    new Dialog({

                        title:
                            "Escape Grapple",

                        content:
                            `
                                <p>
                                    <strong>${actor.name}</strong>
                                    must choose a skill to escape the grapple.
                                </p>

                                <p>
                                    Choose Athletics or Acrobatics.
                                </p>
                            `,

                        buttons: {

                            athletics: {

                                label:
                                    "Athletics",

                                callback:
                                    () => finish(
                                        "ath"
                                    )

                            },

                            acrobatics: {

                                label:
                                    "Acrobatics",

                                callback:
                                    () => finish(
                                        "acr"
                                    )

                            }

                        },

                        default:
                            "athletics",

                        close:
                            () => finish(
                                null
                            )

                    }).render(true);

                }
            );

        },


        // ========================================================
        // IDENTIFY GRAPPLE
        // ========================================================

        isGrappleActivity(
            activity
        ) {

            if (!activity) {
                return false;
            }


            const activityName =
                String(
                    activity.name ??
                    ""
                )
                    .trim()
                    .toLowerCase();


            const itemName =
                String(
                    activity.item?.name ??
                    ""
                )
                    .trim()
                    .toLowerCase();


            return (
                activityName === "grapple" ||
                itemName === "grapple" ||
                activityName.includes("grapple") ||
                itemName.includes("grapple")
            );

        },


        // ========================================================
        // HANDLE GRAPPLE
        // ========================================================

        async handlePostUseActivity(
            activity,
            usageConfig,
            results
        ) {

            if (
                !this.isGrappleActivity(
                    activity
                )
            ) {

                return;

            }


            const actor =
                activity.actor;


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


            // ----------------------------------------------------
            // GET TARGET
            // ----------------------------------------------------

            const target =
                this.getTarget(
                    usageConfig,
                    results,
                    activity
                );


            if (!target) {

                ui.notifications.warn(
                    "Grapple requires a target."
                );


                console.warn(
                    "[ALTERNATE ATTACKS] Grapple had no target."
                );


                return;

            }


            const targetActor =
                target.actor;


            if (!targetActor) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple target has no actor."
                );


                return;

            }


            console.log(
                "[ALTERNATE ATTACKS] Grapple target:",
                target.name,
                targetActor.name
            );


            // ----------------------------------------------------
            // SIZE CHECK
            // ----------------------------------------------------

            if (
                !this.canGrappleTarget(
                    actor,
                    targetActor
                )
            ) {

                ui.notifications.warn(
                    `${target.name} is too large to grapple.`
                );


                console.log(
                    "%c[ALTERNATE ATTACKS] GRAPPLE BLOCKED — TARGET TOO LARGE",
                    "color: red; font-weight: bold;",
                    actor.name,
                    "→",
                    target.name
                );


                return;

            }


            // ----------------------------------------------------
            // ATTACKER ATHLETICS
            // ----------------------------------------------------

            const attackerRoll =
                await this.rollSkill(
                    actor,
                    "ath",
                    "Grapple — Athletics"
                );


            if (!attackerRoll) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grappler Athletics roll failed."
                );


                return;

            }


            // ----------------------------------------------------
            // TARGET DEFENSE
            // ----------------------------------------------------

            const targetSkill =
                await this.chooseDefenseSkill(
                    targetActor
                );


            if (!targetSkill) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple defense selection cancelled."
                );


                return;

            }


            const targetRoll =
                await this.rollSkill(
                    targetActor,
                    targetSkill,
                    `Grapple — ${targetSkill === "ath" ? "Athletics" : "Acrobatics"}`
                );


            if (!targetRoll) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple defense roll failed."
                );


                return;

            }


            // ----------------------------------------------------
            // COMPARE RESULTS
            // ----------------------------------------------------

            const attackerTotal =
                Number(
                    attackerRoll.total ?? 0
                );


            const targetTotal =
                Number(
                    targetRoll.total ?? 0
                );


            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE CONTEST",
                "color: gold; font-weight: bold;",
                {
                    attacker:
                        attackerTotal,

                    target:
                        targetTotal
                }
            );


            // ====================================================
            // SUCCESS
            // ====================================================

            if (
                attackerTotal >
                targetTotal
            ) {

                await this.applyGrappled(
                    targetActor
                );


                this.addGrappleRelationship(
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


                return;

            }


            // ====================================================
            // FAILURE / TIE
            // ====================================================

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

        },


        // ========================================================
        // GET TARGET
        // ========================================================

        getTarget(
            usageConfig,
            results,
            activity
        ) {

            const workflow =
                results?.workflow ??
                usageConfig?.workflow;


            if (
                workflow?.targets?.size
            ) {

                return workflow.targets
                    .values()
                    .next()
                    .value;

            }


            if (
                usageConfig?.targets?.size
            ) {

                return usageConfig.targets
                    .values()
                    .next()
                    .value;

            }


            if (
                usageConfig?.targets instanceof Set
            ) {

                return usageConfig.targets
                    .values()
                    .next()
                    .value;

            }


            const targets =
                activity?.targets;


            if (
                targets?.size
            ) {

                return targets
                    .values()
                    .next()
                    .value;

            }


            const controlledTargets =
                Array.from(
                    game.user?.targets ?? []
                );


            if (
                controlledTargets.length === 1
            ) {

                return controlledTargets[0];

            }


            return null;

        },


        // ========================================================
        // SIZE CHECK
        // ========================================================

        canGrappleTarget(
            actor,
            targetActor
        ) {

            const attackerSize =
                this.getSizeIndex(
                    actor
                );


            const targetSize =
                this.getSizeIndex(
                    targetActor
                );


            if (
                attackerSize === null ||
                targetSize === null
            ) {

                console.warn(
                    "[ALTERNATE ATTACKS] Could not determine creature size; allowing grapple."
                );


                return true;

            }


            return (
                targetSize <=
                attackerSize + 1
            );

        },


        // ========================================================
        // GET SIZE INDEX
        // ========================================================

        getSizeIndex(
            actor
        ) {

            const size =
                actor?.system?.traits?.size;


            if (!size) {
                return null;
            }


            const sizes = [
                "tiny",
                "sm",
                "med",
                "lg",
                "huge",
                "grg"
            ];


            const normalized =
                String(size)
                    .trim()
                    .toLowerCase();


            const index =
                sizes.indexOf(
                    normalized
                );


            return (
                index >= 0
                    ? index
                    : null
            );

        },


        // ========================================================
        // ADD GRAPPLE RELATIONSHIP
        // ========================================================

        addGrappleRelationship(
            grappler,
            target
        ) {

            if (
                !grappler ||
                !target
            ) {

                return;

            }


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
                    grappler:
                        grappler.name,

                    target:
                        target.name
                }
            );

        },


        // ========================================================
        // GET GRAPPLER
        // ========================================================

        getGrappler(
            actor
        ) {

            if (!actor) {
                return null;
            }


            const grapplerId =
                this.grappledBy.get(
                    actor.id
                );


            if (!grapplerId) {
                return null;
            }


            return (
                game.actors?.get(
                    grapplerId
                ) ??
                null
            );

        },


        // ========================================================
        // GET GRAPPLED TARGET
        // ========================================================

        getGrappledTarget(
            actor
        ) {

            if (!actor) {
                return null;
            }


            const targetId =
                this.grapplers.get(
                    actor.id
                );


            if (!targetId) {
                return null;
            }


            return (
                game.actors?.get(
                    targetId
                ) ??
                null
            );

        },


        // ========================================================
        // REMOVE GRAPPLE RELATIONSHIP
        // ========================================================

        removeGrappleRelationship(
            grappler,
            target
        ) {

            if (
                !grappler ||
                !target
            ) {

                return;

            }


            if (
                this.grapplers.get(
                    grappler.id
                ) === target.id
            ) {

                this.grapplers.delete(
                    grappler.id
                );

            }


            if (
                this.grappledBy.get(
                    target.id
                ) === grappler.id
            ) {

                this.grappledBy.delete(
                    target.id
                );

            }


            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLE RELATIONSHIP REMOVED",
                "color: cyan; font-weight: bold;",
                {
                    grappler:
                        grappler.name,

                    target:
                        target.name
                }
            );

        },


        // ========================================================
        // ROLL SKILL
        // ========================================================

        async rollSkill(
            actor,
            skillId,
            flavor
        ) {

            const skill =
                actor.system?.skills?.[skillId];


            if (!skill) {

                ui.notifications.error(
                    `${actor.name} does not have ${skillId === "ath" ? "Athletics" : "Acrobatics"}.`
                );


                return null;

            }


            const bonus =
                Number(
                    skill.total ??
                    skill.bonus ??
                    0
                );


            console.log(
                "[ALTERNATE ATTACKS] Building skill roll:",
                {
                    actor:
                        actor.name,

                    skill:
                        skillId,

                    bonus:
                        bonus
                }
            );


            const roll =
                await new Roll(
                    `1d20 + ${bonus}`
                ).evaluate();


            await roll.toMessage({

                speaker:
                    ChatMessage.getSpeaker({
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
        // CHOOSE TARGET DEFENSE
        // ========================================================

        async chooseDefenseSkill(
            actor
        ) {

            return new Promise(
                resolve => {

                    let resolved =
                        false;


                    const finish =
                        value => {

                            if (resolved) {
                                return;
                            }


                            resolved =
                                true;


                            resolve(
                                value
                            );

                        };


                    new Dialog({

                        title:
                            "Grapple Defense",

                        content:
                            `
                                <p>
                                    <strong>${actor.name}</strong>
                                    must choose a skill to resist the grapple.
                                </p>

                                <p>
                                    Choose Athletics or Acrobatics.
                                </p>
                            `,

                        buttons: {

                            athletics: {

                                label:
                                    "Athletics",

                                callback:
                                    () => finish(
                                        "ath"
                                    )

                            },

                            acrobatics: {

                                label:
                                    "Acrobatics",

                                callback:
                                    () => finish(
                                        "acr"
                                    )

                            }

                        },

                        default:
                            "athletics",

                        close:
                            () => finish(
                                null
                            )

                    }).render(true);

                }
            );

        },


        // ========================================================
        // APPLY GRAPPLED CONDITION
        // ========================================================

        async applyGrappled(
            actor
        ) {

            if (!actor) {
                return;
            }


            const conditionId =
                "grappled";


            const alreadyGrappled =
                actor.effects?.some(
                    effect => {

                        if (
                            effect.statuses?.has(
                                conditionId
                            )
                        ) {

                            return true;

                        }


                        if (
                            effect.flags?.core?.statusId ===
                            conditionId
                        ) {

                            return true;

                        }


                        return false;

                    }
                );


            if (alreadyGrappled) {

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
                    conditionId,
                    {
                        active:
                            true
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
                        name:
                            "Grappled",

                        statuses:
                            [
                                conditionId
                            ],

                        flags:
                            {
                                core:
                                    {
                                        statusId:
                                            conditionId
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


        // ========================================================
        // REMOVE GRAPPLED CONDITION
        // ========================================================

        async removeGrappled(
            actor
        ) {

            if (!actor) {
                return;
            }


            const conditionId =
                "grappled";


            if (
                typeof actor.toggleStatusEffect ===
                "function"
            ) {

                const isGrappled =
                    actor.effects?.some(
                        effect => {

                            if (
                                effect.statuses?.has(
                                    conditionId
                                )
                            ) {

                                return true;

                            }


                            if (
                                effect.flags?.core?.statusId ===
                                conditionId
                            ) {

                                return true;

                            }


                            return false;

                        }
                    );


                if (isGrappled) {

                    await actor.toggleStatusEffect(
                        conditionId,
                        {
                            active:
                                false
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
                actor.effects?.filter(
                    effect => {

                        if (
                            effect.statuses?.has(
                                conditionId
                            )
                        ) {

                            return true;

                        }


                        if (
                            effect.flags?.core?.statusId ===
                            conditionId
                        ) {

                            return true;

                        }


                        return false;

                    }
                ) ?? [];


            for (
                const effect of grappleEffects
            ) {

                await effect.delete();

            }


            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION REMOVED VIA FALLBACK",
                "color: lime; font-weight: bold;",
                actor.name
            );

        }

    };


    // ============================================================
    // INITIALIZE
    //
    // IMPORTANT: This runs immediately (NOT on Hooks.once("ready"))
    // because Action Economy Controller (action-economy.js)
    // registers its own dnd5e.preUseActivity listener immediately
    // at load too. Since module.json loads this file before
    // action-economy.js, calling init() here immediately guarantees
    // our listener registers — and therefore runs — first.
    // ============================================================

    globalThis.alternateAttacks.init();


    console.log(
        "%c[ALTERNATE ATTACKS] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
