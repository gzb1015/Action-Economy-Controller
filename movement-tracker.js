// ============================================================
// MOVEMENT TRACKER
// Foundry VTT 13
// D&D 5e 5.3.3
//
// Tracks movement during a creature's turn.
//
// Features:
//   - Tracks remaining movement
//   - Uses dnd5e movement cost
//   - 5 ft diagonal movement
//   - Supports keyboard movement
//   - Supports drag movement
//   - Resets at the start of the actor's turn
//   - Player movement is limited to remaining movement
//   - GM movement is unrestricted
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
        "[MOVEMENT TRACKER] Tracker already exists. Skipping duplicate initialization."
    );

} else {


    // ============================================================
    // INTERNAL STATE
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

        getMovementSpeed: getMovementSpeed,

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
    // MOVEMENT ENFORCEMENT
    //
    // Runs BEFORE the Token document update is committed.
    //
    // This uses Foundry/dnd5e's own movement measurement rather
    // than recreating diagonal movement, terrain, etc.
    // ============================================================

    Hooks.on(
        "preUpdateToken",
        (token, changes, options, userId) => {

            // ----------------------------------------------------
            // Only process the user actually making the movement.
            // ----------------------------------------------------

            if (userId !== game.user.id) return;


            // ----------------------------------------------------
            // GM BYPASS
            // ----------------------------------------------------

            if (game.user.isGM) return;


            // ----------------------------------------------------
            // Only the user who owns the token can trigger this.
            // ----------------------------------------------------

            if (!token.isOwner) return;


            const actor =
                token.actor;

            if (!actor) return;


            // ----------------------------------------------------
            // Only enforce movement during combat.
            // ----------------------------------------------------

            const combat =
                game.combat;

            if (!combat) return;


            // ----------------------------------------------------
            // Find this actor's combatant.
            // ----------------------------------------------------

            const combatant =
                combat.combatants.find(
                    c => c.actor?.id === actor.id
                );

            if (!combatant) return;


            // ----------------------------------------------------
            // Only enforce movement during this actor's turn.
            // ----------------------------------------------------

            if (
                combat.combatant?.id !==
                combatant.id
            ) {

                return;

            }


            // ----------------------------------------------------
            // Get tracker state.
            // ----------------------------------------------------

            const tracker =
                globalThis.movementTracker;

            if (!tracker) return;


            const state =
                tracker.getState(actor);

            if (!state) return;


            // ----------------------------------------------------
            // Get movement information from Foundry.
            // ----------------------------------------------------

            const movement =
                options?.movement?.[token.id];

            if (!movement?.waypoints?.length) return;


            // ----------------------------------------------------
            // Measure using Foundry/dnd5e's actual movement
            // calculation.
            // ----------------------------------------------------

            let measurement;

            try {

                measurement =
                    token.measureMovementPath(
                        movement.waypoints,
                        options
                    );

            } catch (error) {

                console.error(
                    "[MOVEMENT TRACKER] Failed to measure movement:",
                    error
                );

                // If measurement fails, do NOT block movement.
                return;

            }


            const cost =
                Number(measurement?.cost ?? 0);


            console.log(
                `%c[MOVEMENT LIMIT] ${actor.name} → ` +
                `${cost} ft requested | ` +
                `${state.remaining} ft remaining`,
                "color: magenta; font-weight: bold;"
            );


            // ----------------------------------------------------
            // Movement fits within remaining movement.
            // ----------------------------------------------------

            if (
                cost <=
                state.remaining
            ) {

                return;

            }


            // ----------------------------------------------------
            // Movement exceeds remaining movement.
            // ----------------------------------------------------

            console.warn(
                `[MOVEMENT LIMIT] BLOCKED ${actor.name} → ` +
                `${cost} ft requested with ` +
                `${state.remaining} ft remaining`
            );


            ui.notifications.warn(
                `${actor.name} does not have enough movement remaining.`
            );


            // ----------------------------------------------------
            // Prevent the Token update.
            // ----------------------------------------------------

            return false;

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
                Number(passed.cost ?? 0);

            const distance =
                Number(passed.distance ?? 0);

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
