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

        recordMovement(actor, distance) {

            const state =
                this.getState(actor);


            state.spent += distance;

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
                "ft spent |",
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
            // We only care about combat right now.
            // ----------------------------------------------------

            const combat = game.combat;

            if (!combat) return;


            // ----------------------------------------------------
            // Get the actor.
            // ----------------------------------------------------

            const actor =
                token.document?.actor;

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
            // Get movement information.
            //
            // Foundry v13 movement operations provide movement
            // data which we can inspect instead of calculating
            // distance from raw X/Y coordinates.
            // ----------------------------------------------------

            let distance = 0;


            if (
                movement?.distance != null
            ) {

                distance =
                    Number(
                        movement.distance
                    );

            }


            // ----------------------------------------------------
            // Ignore invalid / zero movement.
            // ----------------------------------------------------

            if (
                !Number.isFinite(distance) ||
                distance <= 0
            ) {
                return;
            }


            // ----------------------------------------------------
            // Record the movement.
            // ----------------------------------------------------

            globalThis.movementTracker.recordMovement(
                actor,
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
