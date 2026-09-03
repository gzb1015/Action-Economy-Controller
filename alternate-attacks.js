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
//
// Action Economy Controller remains responsible for consuming
// the Action.
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
            // FAILURE / TIE
            //
            // Grapple rules require the attacker to exceed the
            // defender's result. A tie therefore fails.
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
                usageConfig?.workflow;


            if (
                workflow?.targets?.size
            ) {

                return workflow.targets
                    .values()
                    .next()
                    .value;

            }


            // ----------------------------------------------------
            // Usage configuration targets
            // ----------------------------------------------------

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


            // ----------------------------------------------------
            // Activity targets
            // ----------------------------------------------------

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


            // ----------------------------------------------------
            // Currently targeted token fallback
            // ----------------------------------------------------

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
        // ROLL SKILL
        //
        // IMPORTANT:
        //
        // We intentionally do NOT use:
        //
        //     actor.rollSkill("ath")
        //
        // Midi-QOL's rollSkill wrapper in the user's setup
        // expects the newer configuration structure.
        //
        // Instead, we construct a normal d20 roll from the
        // actor's skill bonus.
        //
        // This preserves:
        //
        //   • skill proficiency
        //   • ability modifier
        //   • skill bonus
        //   • normal Foundry Roll
        //
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


            // ----------------------------------------------------
            // Construct the roll.
            //
            // We use the skill's calculated total rather than
            // rebuilding proficiency/ability calculations
            // ourselves.
            // ----------------------------------------------------

            const roll =
                await new Roll(
                    `1d20 + ${bonus}`
                ).evaluate();


            // ----------------------------------------------------
            // Create normal Foundry chat message.
            // ----------------------------------------------------

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

        async chooseDefenseSkill(actor) {

            return new Promise(
                resolve => {

                    let resolved =
                        false;


                    const finish =
                        value => {

                            if (resolved) return;

                            resolved = true;

                            resolve(value);

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

        async applyGrappled(actor) {

            if (!actor) return;


            // ----------------------------------------------------
            // Standard D&D 5e condition ID.
            // ----------------------------------------------------

            const conditionId =
                "grappled";


            // ----------------------------------------------------
            // Check existing effects/statuses.
            // ----------------------------------------------------

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


            // ----------------------------------------------------
            // Preferred Foundry/D&D 5e method.
            // ----------------------------------------------------

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


            // ----------------------------------------------------
            // Fallback Active Effect.
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


            console.log(
                "%c[ALTERNATE ATTACKS] GRAPPLED CONDITION APPLIED VIA FALLBACK",
                "color: lime; font-weight: bold;",
                actor.name
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
    // CONTROLLER READY
    // ============================================================

    console.log(
        "%c[ALTERNATE ATTACKS] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
