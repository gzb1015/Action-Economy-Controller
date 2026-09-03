// ============================================================
// MOVEMENT TRACKER
// ============================================================

console.log(
    "%c[MOVEMENT TRACKER] MODULE LOADING",
    "color: cyan; font-size: 16px; font-weight: bold;"
);


// ============================================================
// PREVENT DUPLICATE INITIALIZATION
// ============================================================

if (globalThis.movementTracker) {

    console.warn(
        "[MOVEMENT TRACKER] Already initialized."
    );

} else {

    // ============================================================
    // STATE
    // ============================================================

    const actors = new Map();


    // ============================================================
    // GET MOVEMENT SPEED
    // ============================================================

    function getMovementSpeed(actor) {

        return Number(
            actor?.system?.attributes?.movement?.walk ?? 30
        );

    }


    // ============================================================
    // GET PRONE EFFECT
    //
    // We intentionally return the actual ActiveEffect so that
    // it can be removed ONLY after successful movement.
    // ============================================================

    function getProneEffect(actor) {

        if (!actor) return null;

        return actor.effects?.find(effect => {

            const name =
                effect.name?.toLowerCase() ?? "";

            const label =
                effect.label?.toLowerCase() ?? "";

            const statuses =
                effect.statuses;

            return (
                name === "prone" ||
                label === "prone" ||
                statuses?.has?.("prone")
            );

        }) ?? null;

    }


    // ============================================================
    // IS PRONE?
    // ============================================================

    function isProne(actor) {

        return !!getProneEffect(actor);

    }


    // ============================================================
    // GET PRONE STAND COST
    //
    // Standing costs half of the actor's movement speed.
    // ============================================================

    function getProneStandCost(actor) {

        if (!actor) return 0;

        if (!isProne(actor)) return 0;

        return getMovementSpeed(actor) / 2;

    }


    // ============================================================
    // GET STATE
    // ============================================================

    function getState(actor) {

        if (!actor) return null;

        let state =
            actors.get(actor.id);

        if (!state) {

            const maximum =
                getMovementSpeed(actor);

            state = {

                maximum,

                remaining:
                    maximum,

                spent:
                    0,

                dashed:
                    false

            };

            actors.set(
                actor.id,
                state
            );

        }

        return state;

    }


    // ============================================================
    // RESET
    // ============================================================

    function reset(actor) {

        if (!actor) return;

        const maximum =
            getMovementSpeed(actor);

        actors.set(
            actor.id,
            {

                maximum,

                remaining:
                    maximum,

                spent:
                    0,

                dashed:
                    false

            }
        );

        console.log(
            `%c[MOVEMENT TRACKER] RESET ${actor.name} → ${maximum} ft available`,
            "color: lime; font-weight: bold;"
        );

        ui.notifications.info(
            `${actor.name}: ${maximum} ft movement available.`
        );

        globalThis.AECTrackerUI?.updateMovementForActor(
            actor
        );

    }


    // ============================================================
    // DASH
    // ============================================================

    function dash(actor) {

        if (!actor) return false;

        const state =
            getState(actor);

        if (!state) return false;


        // --------------------------------------------------------
        // TURN CHECK
        // --------------------------------------------------------

        if (
            !game.user.isGM &&
            game.combat &&
            !isActorTurn(actor)
        ) {

            ui.notifications.warn(
                `${actor.name} cannot Dash because it is not their turn.`
            );

            console.warn(
                `%c[MOVEMENT TRACKER] BLOCKED DASH → ${actor.name} is not the active combatant.`,
                "color: red; font-weight: bold;"
            );

            return false;

        }


        // --------------------------------------------------------
        // PREVENT MULTIPLE DASHES
        // --------------------------------------------------------

        if (state.dashed) {

            console.log(
                `%c[MOVEMENT TRACKER] ${actor.name} already dashed this turn.`,
                "color: yellow; font-weight: bold;"
            );

            ui.notifications.warn(
                `${actor.name} has already used Dash this turn.`
            );

            return false;

        }


        const movementSpeed =
            getMovementSpeed(actor);


        // Add the character's normal movement speed
        // to the current movement allowance.

        state.maximum +=
            movementSpeed;

        state.remaining +=
            movementSpeed;

        state.dashed =
            true;


        console.log(
            `%c[MOVEMENT TRACKER] DASH ${actor.name} → ` +
            `+${movementSpeed} ft | ` +
            `${state.remaining} ft remaining`,
            "color: cyan; font-weight: bold;"
        );


        globalThis.AECTrackerUI?.updateMovementForActor(
            actor
        );


        ui.notifications.info(
            `${actor.name}: Dash activated! +${movementSpeed} ft movement.`
        );


        return true;

    }


    // ============================================================
    // RECORD MOVEMENT
    // ============================================================

    function recordMovement(
        actor,
        cost,
        distance,
        stoodFromProne = false
    ) {

        if (!actor) return;

        const state =
            getState(actor);

        if (!state) return;


        const movementCost =
            Math.max(
                0,
                Number(cost) || 0
            );


        if (movementCost <= 0) return;


        // --------------------------------------------------------
        // RECORD MOVEMENT
        // --------------------------------------------------------

        state.spent +=
            movementCost;


        state.remaining =
            Math.max(
                0,
                state.maximum -
                state.spent
            );


        console.log(
            `%c[MOVEMENT TRACKER] MOVEMENT ${actor.name} → ` +
            `${distance} ft traveled | ` +
            `${movementCost} ft movement cost | ` +
            `${state.remaining} ft remaining`,
            "color: orange; font-weight: bold;"
        );


        // --------------------------------------------------------
        // UPDATE UI
        // --------------------------------------------------------

        globalThis.AECTrackerUI?.updateMovementForActor(
            actor
        );


        // --------------------------------------------------------
        // PRONE → STAND
        //
        // This happens ONLY after movement actually occurred.
        // --------------------------------------------------------

        if (stoodFromProne) {

            const proneEffect =
                getProneEffect(actor);

            if (proneEffect) {

                proneEffect.delete().then(() => {

                    console.log(
                        `%c[MOVEMENT TRACKER] ${actor.name} stood up from Prone.`,
                        "color: yellow; font-weight: bold;"
                    );

                }).catch(error => {

                    console.error(
                        "[MOVEMENT TRACKER] Failed to remove Prone effect:",
                        error
                    );

                });

            }

        }

    }


    // ============================================================
    // GET CURRENT COMBATANT FOR ACTOR
    // ============================================================

    function getCombatant(actor) {

        if (!actor) return null;

        const combat =
            game.combat;

        if (!combat) return null;

        return combat.combatants?.find(
            combatant =>
                combatant.actor?.id === actor.id
        ) ?? null;

    }


    // ============================================================
    // IS ACTOR'S TURN?
    // ============================================================

    function isActorTurn(actor) {

        if (!actor) return false;

        const combat =
            game.combat;


        // Outside combat, movement is unrestricted.
        if (!combat) return true;


        const combatant =
            getCombatant(actor);


        if (!combatant) {

            return false;

        }


        return (
            combat.combatant?.id ===
            combatant.id
        );

    }


    // ============================================================
    // CAN MOVE?
    // ============================================================

    function canMove(actor) {

        if (!actor) return false;

        // GM bypass.
        if (game.user.isGM) return true;


        // During combat, only the active combatant can move.
        if (
            game.combat &&
            !isActorTurn(actor)
        ) {

            return false;

        }


        const state =
            getState(actor);


        if (!state) return false;


        // If Prone, at least enough movement to stand must remain.
        if (isProne(actor)) {

            const standCost =
                getProneStandCost(actor);

            return (
                state.remaining >
                standCost
            );

        }


        return (
            state.remaining > 0
        );

    }


    // ============================================================
    // PUBLIC API
    // ============================================================

    globalThis.movementTracker = {

        actors,

        getState,

        getMovementSpeed,

        getProneEffect,

        isProne,

        getProneStandCost,

        getCombatant,

        isActorTurn,

        canMove,

        reset,

        dash,

        recordMovement

    };


    // ============================================================
    // START OF TURN
    // ============================================================

    Hooks.on(
        "updateCombat",
        (combat, changed) => {

            if (!combat) return;

            if (!("turn" in changed)) return;


            const combatant =
                combat.combatant;


            if (!combatant?.actor) return;


            reset(
                combatant.actor
            );

        }
    );


    // ============================================================
    // MOVEMENT PATH LIMITER
    //
    // This modifies the path BEFORE Foundry executes movement.
    // ============================================================

    Hooks.once(
        "ready",
        () => {

            const token =
                canvas.tokens.placeables.find(
                    t => t.actor
                );


            if (!token) {

                console.warn(
                    "[MOVEMENT TRACKER] Could not find a token to install path limiter."
                );

                return;

            }


            const proto =
                Object.getPrototypeOf(token);


            if (
                proto._aecOriginalConstrainMovementPath
            ) {

                console.warn(
                    "[MOVEMENT TRACKER] Path limiter already installed."
                );

                return;

            }


            proto._aecOriginalConstrainMovementPath =
                proto.constrainMovementPath;


            proto.constrainMovementPath =
                function(
                    waypoints,
                    options
                ) {


                    // ------------------------------------------------
                    // FIRST LET FOUNDRY CALCULATE ITS NORMAL PATH
                    // ------------------------------------------------

                    const result =
                        this._aecOriginalConstrainMovementPath(
                            waypoints,
                            options
                        );


                    const path =
                        result[0];


                    // ------------------------------------------------
                    // GM BYPASS
                    // ------------------------------------------------

                    if (game.user.isGM) {

                        return result;

                    }


                    const actor =
                        this.actor;


                    if (!actor) {

                        return result;

                    }


                    // ------------------------------------------------
                    // OUTSIDE COMBAT
                    // ------------------------------------------------

                    const combat =
                        game.combat;


                    if (!combat) {

                        return result;

                    }


                    // ------------------------------------------------
                    // FIND ACTOR'S COMBATANT
                    // ------------------------------------------------

                    const combatant =
                        combat.combatants?.find(
                            c =>
                                c.actor?.id === actor.id
                        );


                    if (!combatant) {

                        return result;

                    }


                    // ------------------------------------------------
                    // HARD TURN LOCK
                    //
                    // IMPORTANT:
                    // Previously this returned the normal result,
                    // which allowed movement outside the actor's turn.
                    // ------------------------------------------------

                    if (
                        combat.combatant?.id !==
                        combatant.id
                    ) {

                        console.log(
                            `%c[MOVEMENT TRACKER] BLOCKED MOVEMENT → ` +
                            `${actor.name} is not the active combatant.`,
                            "color: red; font-weight: bold;"
                        );


                        return [
                            [path?.[0] ?? waypoints?.[0]],
                            true
                        ];

                    }


                    // ------------------------------------------------
                    // GET TRACKER
                    // ------------------------------------------------

                    const tracker =
                        globalThis.movementTracker;


                    if (!tracker) {

                        return result;

                    }


                    const state =
                        tracker.getState(actor);


                    if (!state) {

                        return result;

                    }


                    // ------------------------------------------------
                    // DETERMINE PRONE STAND COST
                    //
                    // We DON'T remove the effect here.
                    //
                    // We only reserve the movement cost.
                    // The effect is removed after moveToken confirms
                    // that the token actually moved.
                    // ------------------------------------------------

                    const prone =
                        tracker.isProne(actor);


                    const standCost =
                        prone
                            ? tracker.getProneStandCost(actor)
                            : 0;


                    // ------------------------------------------------
                    // MOVEMENT AVAILABLE FOR ACTUAL TRAVEL
                    // ------------------------------------------------

                    const availableMovement =
                        Math.max(
                            0,
                            state.remaining -
                            standCost
                        );


                    // ------------------------------------------------
                    // PRONE WITH NOT ENOUGH MOVEMENT TO STAND
                    // ------------------------------------------------

                    if (
                        prone &&
                        state.remaining <= standCost
                    ) {

                        console.log(
                            `%c[MOVEMENT TRACKER] BLOCKED MOVEMENT → ` +
                            `${actor.name} is Prone and has only ` +
                            `${state.remaining} ft remaining ` +
                            `(needs ${standCost} ft to stand).`,
                            "color: red; font-weight: bold;"
                        );


                        return [
                            [path?.[0] ?? waypoints?.[0]],
                            true
                        ];

                    }


                    // ------------------------------------------------
                    // NORMAL NO-MOVEMENT CHECK
                    // ------------------------------------------------

                    if (
                        !prone &&
                        state.remaining <= 0
                    ) {

                        console.log(
                            `%c[MOVEMENT TRACKER] BLOCKED MOVEMENT → ` +
                            `${actor.name} has no movement remaining.`,
                            "color: red; font-weight: bold;"
                        );


                        return [
                            [path?.[0] ?? waypoints?.[0]],
                            true
                        ];

                    }


                    // ------------------------------------------------
                    // SINGLE WAYPOINT
                    // ------------------------------------------------

                    if (
                        !path ||
                        path.length <= 1
                    ) {

                        return result;

                    }


                    // ------------------------------------------------
                    // MEASURE REQUESTED PATH
                    // ------------------------------------------------

                    let measurement;


                    try {

                        measurement =
                            this.measureMovementPath(
                                path,
                                options
                            );

                    } catch (error) {

                        console.error(
                            "[MOVEMENT TRACKER] Failed to measure constrained path:",
                            error
                        );

                        return result;

                    }


                    const totalCost =
                        Number(
                            measurement?.cost ?? 0
                        );


                    // ------------------------------------------------
                    // PATH FITS
                    //
                    // Notice that for Prone characters the path
                    // must fit AFTER paying the standing cost.
                    // ------------------------------------------------

                    if (
                        totalCost <=
                        availableMovement
                    ) {

                        return result;

                    }


                    // ------------------------------------------------
                    // LIMIT PATH
                    // ------------------------------------------------

                    console.log(
                        `%c[MOVEMENT TRACKER] LIMITING ${actor.name} → ` +
                        `${totalCost} ft requested | ` +
                        `${availableMovement} ft available for travel ` +
                        `${prone ? `(after ${standCost} ft stand cost)` : ""}`,
                        "color: red; font-weight: bold;"
                    );


                    const allowedPath =
                        [
                            path[0]
                        ];


                    let accumulatedCost = 0;


                    for (
                        let i = 1;
                        i < path.length;
                        i++
                    ) {

                        const candidate =
                            [
                                path[0],
                                ...path.slice(
                                    1,
                                    i + 1
                                )
                            ];


                        let candidateMeasurement;


                        try {

                            candidateMeasurement =
                                this.measureMovementPath(
                                    candidate,
                                    options
                                );

                        } catch (error) {

                            console.error(
                                "[MOVEMENT TRACKER] Failed measuring candidate path:",
                                error
                            );

                            break;

                        }


                        const candidateCost =
                            Number(
                                candidateMeasurement?.cost ?? 0
                            );


                        if (
                            candidateCost <=
                            availableMovement
                        ) {

                            allowedPath.push(
                                path[i]
                            );

                            accumulatedCost =
                                candidateCost;

                            continue;

                        }


                        break;

                    }


                    console.log(
                        `%c[MOVEMENT TRACKER] PATH LIMITED ${actor.name} → ` +
                        `${accumulatedCost} ft travel ` +
                        `${prone ? `+ ${standCost} ft stand` : ""}`,
                        "color: red; font-weight: bold;"
                    );


                    return [
                        allowedPath,
                        true
                    ];

                };


            console.log(
                "%c[MOVEMENT TRACKER] HARD MOVEMENT LIMIT INSTALLED",
                "color: lime; font-size: 16px; font-weight: bold;"
            );

        }
    );


    // ============================================================
    // RECORD COMPLETED MOVEMENT
    // ============================================================

    Hooks.on(
        "moveToken",
        (
            token,
            movement
        ) => {

            const actor =
                token.actor;


            if (!actor) return;


            // ------------------------------------------------
            // HARD TURN CHECK
            //
            // This is a SECOND layer of protection.
            //
            // Even if some other system somehow manages to move
            // the token, we do not count that movement as legal
            // player movement outside their turn.
            // ------------------------------------------------

            if (
                game.combat &&
                !isActorTurn(actor)
            ) {

                console.warn(
                    `%c[MOVEMENT TRACKER] MOVEMENT OCCURRED OUTSIDE TURN → ` +
                    `${actor.name}`,
                    "color: red; font-weight: bold;"
                );

                return;

            }


            const passed =
                movement?.passed;


            if (!passed) return;


            const distance =
                Number(
                    passed.distance ?? 0
                );


            const travelCost =
                Number(
                    passed.cost ?? 0
                );


            if (
                travelCost <= 0 &&
                distance <= 0
            ) {

                return;

            }


            // ------------------------------------------------
            // CHECK PRONE BEFORE RECORDING
            //
            // This MUST happen before the effect is removed.
            // ------------------------------------------------

            const wasProne =
                isProne(actor);


            const standCost =
                wasProne
                    ? getProneStandCost(actor)
                    : 0;


            // ------------------------------------------------
            // TOTAL MOVEMENT COST
            //
            // Prone movement:
            //
            //     Stand cost + travel cost
            //
            // Normal movement:
            //
            //     Travel cost
            // ------------------------------------------------

            const totalCost =
                travelCost +
                standCost;


            console.log(
                `%c[MOVEMENT TRACKER] COMPLETED MOVEMENT ${actor.name} → ` +
                `${distance} ft travel + ` +
                `${wasProne ? `${standCost} ft standing` : "0 ft standing"} = ` +
                `${totalCost} ft total`,
                "color: orange; font-weight: bold;"
            );


            // ------------------------------------------------
            // RECORD MOVEMENT
            //
            // The Prone effect is still present at this point.
            // recordMovement removes it only after the movement
            // has actually happened.
            // ------------------------------------------------

            recordMovement(
                actor,
                totalCost,
                distance,
                wasProne
            );

        }
    );


    // ============================================================
    // D&D 5E DASH INTEGRATION
    // ============================================================

    Hooks.on(
        "dnd5e.postUseActivity",
        (
            activity,
            results
        ) => {

            if (!activity) return;


            const activityName =
                activity.name?.toLowerCase();


            if (
                activityName !== "dash"
            ) return;


            const actor =
                activity.actor;


            if (!actor) return;


            console.log(
                `%c[MOVEMENT TRACKER] DASH ACTIVITY DETECTED → ${actor.name}`,
                "color: cyan; font-weight: bold;"
            );


            const success =
                globalThis.movementTracker?.dash(
                    actor
                );


            if (!success) {

                console.log(
                    "[MOVEMENT TRACKER] Dash was not applied."
                );

            }

        }
    );


    // ============================================================
    // READY
    // ============================================================

    console.log(
        "%c[MOVEMENT TRACKER] READY",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
