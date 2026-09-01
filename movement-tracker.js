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
                spent: 0,
                dashed: false

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
            spent: 0,
            dashed: false

        });

        console.log(
            `%c[MOVEMENT TRACKER] RESET ${actor.name} → ${maximum} ft available`,
            "color: lime; font-weight: bold;"
        );

        ui.notifications.info(
            `${actor.name}: ${maximum} ft movement available.`
        );

        globalThis.AECTrackerUI?.updateMovement(
            0,
            maximum
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


        // Prevent Dash from being used more than once
        // during the same turn.

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

        state.maximum += movementSpeed;

        state.remaining += movementSpeed;

        state.dashed = true;


        console.log(
            `%c[MOVEMENT TRACKER] DASH ${actor.name} → ` +
            `+${movementSpeed} ft | ` +
            `${state.remaining} ft remaining`,
            "color: cyan; font-weight: bold;"
        );


        globalThis.AECTrackerUI?.updateMovement(
            state.spent,
            state.maximum
        );


        ui.notifications.info(
            `${actor.name}: Dash activated! +${movementSpeed} ft movement.`
        );


        return true;

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

        globalThis.AECTrackerUI?.updateMovement(
            state.spent,
            state.maximum
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

            reset(combatant.actor);

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

                    const result =
                        this._aecOriginalConstrainMovementPath(
                            waypoints,
                            options
                        );

                    const path =
                        result[0];

                    const constrained =
                        result[1];

                    if (game.user.isGM) {

                        return result;

                    }

                    const actor =
                        this.actor;

                    if (!actor) {

                        return result;

                    }

                    const combat =
                        game.combat;

                    if (!combat) {

                        return result;

                    }

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

                    if (state.remaining <= 0) {

                        return [
                            [path[0]],
                            true
                        ];

                    }

                    if (path.length <= 1) {

                        return result;

                    }

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

                    if (
                        totalCost <=
                        state.remaining
                    ) {

                        return result;

                    }

                    console.log(
                        `%c[MOVEMENT TRACKER] LIMITING ${actor.name} → ` +
                        `${totalCost} ft requested | ` +
                        `${state.remaining} ft remaining`,
                        "color: red; font-weight: bold;"
                    );

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

                        break;

                    }

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
    // D&D 5E DASH INTEGRATION
    //
    // When the normal D&D 5e Dash activity is used,
    // activate Dash in the movement tracker.
    // ============================================================

    Hooks.on(
        "dnd5e.postUseActivity",
        (activity, results) => {

            if (!activity) return;

            const activityName =
                activity.name?.toLowerCase();

            if (activityName !== "dash") return;

            const actor =
                activity.actor;

            if (!actor) return;

            console.log(
                `%c[MOVEMENT TRACKER] DASH ACTIVITY DETECTED → ${actor.name}`,
                "color: cyan; font-weight: bold;"
            );

            const success =
                globalThis.movementTracker?.dash(actor);

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
