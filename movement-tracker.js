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

        return actor?.system?.attributes?.movement?.walk ?? 30;

    }


    // ============================================================
    // GET STATE
    // ============================================================

    function getState(actor) {

        if (!actor) return null;

        let state = actors.get(actor.id);

        if (!state) {

            const maximum =
                getMovementSpeed(actor);

            state = {

                maximum,
                remaining: maximum,
                spent: 0

            };

            actors.set(actor.id, state);

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

        actors.set(actor.id, {

            maximum,
            remaining: maximum,
            spent: 0

        });

        console.log(
            `%c[MOVEMENT TRACKER] RESET ${actor.name} → ${maximum} ft available`,
            "color: lime; font-weight: bold;"
        );

        ui.notifications.info(
            `${actor.name}: ${maximum} ft movement available.`
        );

    }


    // ============================================================
    // RECORD MOVEMENT
    // ============================================================

    function recordMovement(actor, cost, distance) {

        if (!actor) return;

        const state =
            getState(actor);

        if (!state) return;

        state.spent += cost;

        state.remaining =
            Math.max(
                0,
                state.maximum - state.spent
            );

        console.log(
            `%c[MOVEMENT TRACKER] MOVEMENT ${actor.name} → ` +
            `${distance} ft traveled | ` +
            `${cost} ft cost | ` +
            `${state.remaining} ft remaining`,
            "color: orange; font-weight: bold;"
        );

    }


    // ============================================================
    // PUBLIC API
    // ============================================================

    globalThis.movementTracker = {

        actors,

        getState,

        getMovementSpeed,

        reset,

        recordMovement

    };


    // ============================================================
    // START OF TURN
    // ============================================================

    Hooks.on(
        "combatTurn",
        (combat, update, context) => {

            if (!combat) return;

            const combatant =
                combat.combatant;

            if (!combatant) return;

            const actor =
                combatant.actor;

            if (!actor) return;

            reset(actor);

        }
    );


    // ============================================================
    // MOVEMENT PATH LIMITER
    //
    // This modifies the path BEFORE Foundry executes movement.
    //
    // We intentionally wrap the dnd5e Token5e prototype rather
    // than trying to access Token5e as a global variable.
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


            if (proto._aecOriginalConstrainMovementPath) {

                console.warn(
                    "[MOVEMENT TRACKER] Path limiter already installed."
                );

                return;

            }


            proto._aecOriginalConstrainMovementPath =
                proto.constrainMovementPath;


            proto.constrainMovementPath =
                function(waypoints, options) {

                    // ------------------------------------------------
                    // Always let dnd5e do its normal movement
                    // constraint processing first.
                    // ------------------------------------------------

                    const result =
                        this._aecOriginalConstrainMovementPath(
                            waypoints,
                            options
                        );


                    const path =
                        result[0];

                    const constrained =
                        result[1];


                    // ------------------------------------------------
                    // GMs are unrestricted.
                    // ------------------------------------------------

                    if (game.user.isGM) {

                        return result;

                    }


                    // ------------------------------------------------
                    // Get actor.
                    // ------------------------------------------------

                    const actor =
                        this.actor;

                    if (!actor) {

                        return result;

                    }


                    // ------------------------------------------------
                    // Only enforce movement during combat.
                    // ------------------------------------------------

                    const combat =
                        game.combat;

                    if (!combat) {

                        return result;

                    }


                    // ------------------------------------------------
                    // Make sure this actor is the active combatant.
                    // ------------------------------------------------

                    const combatant =
                        combat.combatants.find(
                            c => c.actor?.id === actor.id
                        );

                    if (!combatant) {

                        return result;

                    }


                    if (
                        combat.combatant?.id !==
                        combatant.id
                    ) {

                        return result;

                    }


                    // ------------------------------------------------
                    // Get movement state.
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
                    // If there is no movement remaining, don't allow
                    // a new path.
                    // ------------------------------------------------

                    if (state.remaining <= 0) {

                        return [
                            [path[0]],
                            true
                        ];

                    }


                    // ------------------------------------------------
                    // If there isn't a destination, nothing to do.
                    // ------------------------------------------------

                    if (path.length <= 1) {

                        return result;

                    }


                    // ------------------------------------------------
                    // Measure the path using Foundry/dnd5e's own
                    // movement measurement.
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
                    // Path is legal.
                    // ------------------------------------------------

                    if (
                        totalCost <=
                        state.remaining
                    ) {

                        return result;

                    }


                    // ------------------------------------------------
                    // PATH EXCEEDS MOVEMENT
                    // ------------------------------------------------

                    console.log(
                        `%c[MOVEMENT TRACKER] LIMITING ${actor.name} → ` +
                        `${totalCost} ft requested | ` +
                        `${state.remaining} ft remaining`,
                        "color: red; font-weight: bold;"
                    );


                    // ------------------------------------------------
                    // Build a shortened path one segment at a time.
                    //
                    // We retain the original waypoints rather than
                    // rebuilding them from scratch.
                    // ------------------------------------------------

                    const allowedPath =
                        [path[0]];

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


                        // ------------------------------------------------
                        // This waypoint still fits.
                        // ------------------------------------------------

                        if (
                            candidateCost <=
                            state.remaining
                        ) {

                            allowedPath.push(
                                path[i]
                            );

                            accumulatedCost =
                                candidateCost;

                            continue;

                        }


                        // ------------------------------------------------
                        // This waypoint exceeds the budget.
                        //
                        // We stop before it.
                        // ------------------------------------------------

                        break;

                    }


                    // ------------------------------------------------
                    // Return the shortened path.
                    // ------------------------------------------------

                    console.log(
                        `%c[MOVEMENT TRACKER] PATH LIMITED ${actor.name} → ` +
                        `${accumulatedCost} ft`,
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
        (token, movement) => {

            const actor =
                token.actor;

            if (!actor) return;

            const passed =
                movement?.passed;

            if (!passed) return;

            const cost =
                Number(
                    passed.cost ?? 0
                );

            const distance =
                Number(
                    passed.distance ?? 0
                );

            if (cost <= 0) return;

            recordMovement(
                actor,
                cost,
                distance
            );

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
