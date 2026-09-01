// ============================================================
// MOVEMENT TRACKER
// Foundry VTT 13
// D&D 5e 5.3.3
//
// Tracks movement spent during combat.
//
// Phase 1:
//   - Tracks movement per actor
//   - Resets movement at the beginning of the actor's turn
//   - Uses Foundry's native movement measurement
//   - Uses Foundry's movement COST
//   - Does NOT block movement yet
//   - Does NOT show warnings yet
//
// GM movement is currently unrestricted.
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
        "[MOVEMENT TRACKER] Already initialized. Skipping duplicate initialization."
    );

} else {

    globalThis.movementTracker = {

        // --------------------------------------------------------
        // Actor movement states
        // --------------------------------------------------------

        actors: new Map(),


        // --------------------------------------------------------
        // Get or create state for an actor
        // --------------------------------------------------------

        getState(actor) {

            if (!this.actors.has(actor.id)) {

                const movement =
                    actor.system?.attributes?.movement;

                const total =
                    Number(movement?.walk ?? 0);


                this.actors.set(actor.id, {

                    total: total,
                    remaining: total,
                    spent: 0

                });

            }

            return this.actors.get(actor.id);
        },


        // --------------------------------------------------------
        // Get the actor's current walking speed
        // --------------------------------------------------------

        getMovementSpeed(actor) {

            const movement =
                actor.system?.attributes?.movement;

            return Number(
                movement?.walk ?? 0
            );
        },


        // --------------------------------------------------------
        // Reset an actor's movement
        // --------------------------------------------------------

        reset(actor) {

            const speed =
                this.getMovementSpeed(actor);

            this.actors.set(actor.id, {

                total: speed,
                remaining: speed,
                spent: 0

            });


            console.log(
                "%c[MOVEMENT TRACKER] RESET",
                "color: yellow; font-weight: bold;",
                actor.name,
                "→",
                speed,
                "ft"
            );

        },


        // --------------------------------------------------------
        // Record movement
        // --------------------------------------------------------

        recordMovement(actor, cost, distance) {

            const state =
                this.getState(actor);


            state.spent += cost;

            state.remaining =
                Math.max(
                    0,
                    state.total - state.spent
                );


            console.log(
                "%c[MOVEMENT TRACKER] MOVEMENT",
                "color: lime; font-weight: bold;",
                actor.name,
                "→",
                distance,
                "ft traveled |",
                cost,
                "ft cost |",
                state.remaining,
                "ft remaining"
            );

        }

    };


    // ============================================================
    // TOKEN MOVEMENT
    // ============================================================

    Hooks.on(
        "moveToken",
        (token, movement) => {

            // ----------------------------------------------------
            // Only track movement during combat.
            // ----------------------------------------------------

            const combat = game.combat;

            if (!combat) return;


            // ----------------------------------------------------
            // Get the actor.
            // ----------------------------------------------------

            const actor =
                token.actor;

            if (!actor) return;


            // ----------------------------------------------------
            // Find this actor's combatant.
            // ----------------------------------------------------

            const combatant =
                combat.combatants.find(
                    c => c.actor?.id === actor.id
                );

            if (!combatant) return;


            // ----------------------------------------------------
            // Only track movement during this actor's turn.
            // ----------------------------------------------------

            if (
                combat.combatant?.id !==
                combatant.id
            ) {
                return;
            }


            // ----------------------------------------------------
            // Foundry v13 provides movement information in
            // movement.passed.
            //
            // distance = actual distance traveled
            // cost     = movement cost
            //
            // We use COST because difficult terrain and other
            // movement modifiers may cause cost > distance.
            // ----------------------------------------------------

            const passed =
                movement?.passed;

            if (!passed) return;


            const distance =
                Number(passed.distance ?? 0);

            const cost =
                Number(passed.cost ?? 0);


            // ----------------------------------------------------
            // Ignore invalid / zero movement.
            // ----------------------------------------------------

            if (
                !Number.isFinite(cost) ||
                cost <= 0
            ) {
                return;
            }


            // ----------------------------------------------------
            // Record the movement.
            // ----------------------------------------------------

            globalThis.movementTracker.recordMovement(
                actor,
                cost,
                distance
            );

        }
    );


    // ============================================================
    // RESET MOVEMENT AT THE START OF A NEW TURN
    // ============================================================

    Hooks.on(
        "updateCombat",
        (combat, changed) => {

            if (!("turn" in changed)) return;


            const combatant =
                combat.combatant;

            if (!combatant?.actor) return;


            const actor =
                combatant.actor;


            globalThis.movementTracker.reset(
                actor
            );

        }
    );


    console.log(
        "%c[MOVEMENT TRACKER] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
