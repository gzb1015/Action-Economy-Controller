// ============================================================
// ACTION ECONOMY CONTROLLER
// ALTERNATE ATTACKS — GRAPPLE
//
// Foundry VTT 13
// D&D 5e 5.3.3
//
// Handles the mechanical portions of the Grapple action that
// are not handled by the imported Foundry/Plutonium activity:
//
//   • Target size restriction
//   • Athletics vs Athletics/Acrobatics contest
//   • Grappled condition application
//
// The existing Action Economy Controller remains responsible
// for consuming the Action.
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

    // ============================================================
    // CONTROLLER
    // ============================================================

    globalThis.alternateAttacks = {

        // --------------------------------------------------------
        // INITIALIZATION
        // --------------------------------------------------------

        init() {

            if (globalThis.__aecAlternateAttacksInitialized) {

                console.warn(
                    "[ALTERNATE ATTACKS] Already initialized."
                );

                return;

            }


            globalThis.__aecAlternateAttacksInitialized = true;


            // ----------------------------------------------------
            // Grapple activity hook
            //
            // We use postUseActivity because the existing
            // activity/AEC system should be allowed to process
            // the Action normally first.
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
                "%c[ALTERNATE ATTACKS] Grapple handler installed.",
                "color: lime; font-weight: bold;"
            );

        },


        // ========================================================
        // IDENTIFY GRAPPLE
        // ========================================================

        isGrappleActivity(activity) {

            if (!activity) return false;


            const activityName =
                String(
                    activity.name ??
                    ""
                ).trim().toLowerCase();


            const itemName =
                String(
                    activity.item?.name ??
                    ""
                ).trim().toLowerCase();


            return (
                activityName === "grapple" ||
                itemName === "grapple" ||
                activityName.includes("grapple") ||
                itemName.includes("grapple")
            );

        },


        // ========================================================
        // POST ACTIVITY HANDLER
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
            // Get target
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
            // TARGET SIZE CHECK
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
                await this.rollAthletics(
                    actor
                );


            if (!attackerRoll) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple Athletics roll failed."
                );

                return;

            }


            // ----------------------------------------------------
            // TARGET DEFENSE
            //
            // The target chooses Athletics or Acrobatics.
            // ----------------------------------------------------

            const targetRoll =
                await this.rollTargetDefense(
                    targetActor
                );


            if (!targetRoll) {

                console.warn(
                    "[ALTERNATE ATTACKS] Grapple defense roll failed."
                );

                return;

            }


            // ----------------------------------------------------
            // CONTEST
            // ----------------------------------------------------

            const attackerTotal =
                attackerRoll.total ?? 0;


            const targetTotal =
                targetRoll.total ?? 0;


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


            // ----------------------------------------------------
            // SUCCESS
            // ----------------------------------------------------

            if (
                attackerTotal >
                targetTotal
            ) {

                await this.applyGrappled(
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


            // ----------------------------------------------------
            // FAILURE
            // ----------------------------------------------------

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

            // ----------------------------------------------------
            // Midi-QOL workflow
            // ----------------------------------------------------

            const workflow =
                results?.workflow ??
                usageConfig?.workflow ??
                globalThis.MidiQOL?.Workflow?.getWorkflow?.(
                    activity.uuid
                );


            if (
                workflow?.targets?.size
            ) {

                return workflow.targets.values().next().value;

            }


            // ----------------------------------------------------
            // Usage configuration
            // ----------------------------------------------------

            if (
                usageConfig?.targets?.size
            ) {

                return usageConfig.targets.values().next().value;

            }


            if (
                usageConfig?.targets instanceof Set
            ) {

                return usageConfig.targets.values().next().value;

            }


            // ----------------------------------------------------
            // Foundry activity target data
            // ----------------------------------------------------

            const targets =
                activity?.targets;


            if (
                targets?.size
            ) {

                return targets.values().next().value;

            }


            return null;

        },


        // ========================================================
        // TARGET SIZE CHECK
        //
        // A creature can grapple a creature no more than one
        // size category larger.
        //
        // Tiny       → Tiny, Small
        // Small      → Small, Medium
        // Medium     → Medium, Large
        // Large      → Large, Huge
        // Huge       → Huge, Gargantuan
        // Gargantuan → Gargantuan
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
                    "[ALTERNATE ATTACKS] Could not determine creature size."
                );


                // Do not accidentally block a grapple because
                // Foundry contains an unexpected/custom size.
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

        getSizeIndex(actor) {

            const size =
                actor?.system?.traits?.size;


            if (!size) return null;


            const sizes = [
                "tiny",
                "sm",
                "med",
                "lg",
                "huge",
                "grg"
            ];


            const index =
                sizes.indexOf(
                    String(size).toLowerCase()
                );


            return (
                index >= 0
                    ? index
                    : null
            );

        },


        // ========================================================
        // ATHLETICS ROLL
        // ========================================================

        async rollAthletics(actor) {

            const athletics =
                actor.system?.skills?.ath;


            if (!athletics) {

                ui.notifications.error(
                    `${actor.name} does not have an Athletics skill.`
                );


                return null;

            }


            console.log(
                "[ALTERNATE ATTACKS] Rolling Athletics for",
                actor.name
            );


            const roll =
                await actor.rollSkill(
                    "ath"
                );


            return roll ?? null;

        },


        // ========================================================
        // TARGET DEFENSE
        //
        // Player-controlled targets receive a choice between
        // Athletics and Acrobatics.
        //
        // For NPCs, use Athletics by default unless the user
        // chooses otherwise through the dialog.
        // ========================================================

        async rollTargetDefense(actor) {

            const choice =
                await this.chooseDefenseSkill(
                    actor
                );


            if (!choice) return null;


            console.log(
                "[ALTERNATE ATTACKS] Target defense:",
                actor.name,
                choice
            );


            const roll =
                await actor.rollSkill(
                    choice
                );


            return roll ?? null;

        },


        // ========================================================
        // CHOOSE DEFENSE SKILL
        // ========================================================

        async chooseDefenseSkill(actor) {

            return new Promise(
                resolve => {

                    new Dialog({

                        title:
                            "Grapple Defense",

                        content:
                            `<p><strong>${actor.name}</strong> must choose a skill to resist the grapple.</p>`,

                        buttons: {

                            athletics: {

                                label:
                                    "Athletics",

                                callback:
                                    () => resolve(
                                        "ath"
                                    )

                            },

                            acrobatics: {

                                label:
                                    "Acrobatics",

                                callback:
                                    () => resolve(
                                        "acr"
                                    )

                            }

                        },

                        default:
                            "athletics",

                        close:
                            () => resolve(null)

                    }).render(true);

                }
            );

        },


        // ========================================================
        // APPLY GRAPPLED
        //
        // Uses the standard D&D 5e Grappled condition from
        // CONFIG.DND5E.statusEffects.
        // ========================================================

        async applyGrappled(actor) {

            if (!actor) return;


            // ----------------------------------------------------
            // Find the standard Grappled condition.
            // ----------------------------------------------------

            const grappled =
                CONFIG.DND5E?.conditionTypes
                    ? Object.entries(
                        CONFIG.DND5E.conditionTypes
                    ).find(
                        ([id, label]) =>
                            String(id).toLowerCase() ===
                            "grappled"
                    )
                    : null;


            // ----------------------------------------------------
            // Standard 5e condition ID.
            // ----------------------------------------------------

            const conditionId =
                grappled?.[0] ??
                "grappled";


            // ----------------------------------------------------
            // If the actor already has Grappled, don't duplicate.
            // ----------------------------------------------------

            const alreadyGrappled =
                actor.effects?.some(
                    effect =>
                        effect.statuses?.has(
                            conditionId
                        ) ||
                        effect.flags?.core?.statusId ===
                            conditionId
                );


            if (alreadyGrappled) {

                console.log(
                    "[ALTERNATE ATTACKS] Target already Grappled."
                );

                return;

            }


            // ----------------------------------------------------
            // Use D&D 5e's built-in condition API when available.
            // ----------------------------------------------------

            if (
                typeof actor.toggleStatusEffect ===
                "function"
            ) {

                await actor.toggleStatusEffect(
                    conditionId,
                    {
                        active: true
                    }
                );


                return;

            }


            // ----------------------------------------------------
            // Fallback: create a core status effect.
            // ----------------------------------------------------

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

        }

    };


    // ============================================================
    // INITIALIZE
    // ============================================================

    Hooks.once(
        "ready",
        () => {

            globalThis.alternateAttacks.init();

        }
    );


    // ============================================================
    // READY
    // ============================================================

    console.log(
        "%c[ALTERNATE ATTACKS] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
