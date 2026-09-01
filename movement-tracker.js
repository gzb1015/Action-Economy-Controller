// ============================================================
// MOVEMENT TRACKER
// Foundry VTT 13
// D&D 5e 5.3.3
//
// Tracks and enforces movement during combat.
//
// Features:
//   - Tracks movement per actor
//   - Resets movement at the beginning of the actor's turn
//   - Uses Foundry's native movement measurement
//   - Uses Foundry's native movement COST
//   - Tracks movement only during the actor's combat turn
//   - Prevents players from exceeding available movement
//   - GM movement is unrestricted
//   - Notifies players when they are out of movement
//
// Future features:
//   - Movement HUD display
//   - Dash
//   - Movement speed modifiers
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

        // Tokens currently being returned to their previous
        // position after an illegal movement.
        reverting: new Set(),


        // ========================================================
        // ACTOR LOOKUP
        // ========================================================

        getActorFromToken(token) {

            return (
                token.actor ??
                token.document?.actor ??
                game.actors.get(
                    token.document?.actorId
                )
            );

        },


        // ========================================================
        // GET / CREATE ACTOR STATE
        // ========================================================

        getState(actor) {

            if (!this.actors.has(actor.id)) {

                const speed =
                    this.getMovementSpeed(actor);

                this.actors.set(actor.id, {

                    // Normal movement available this turn
                    base: speed,

                    // Total movement available this turn
                    total: speed,

                    // Movement already spent
                    spent: 0,

                    // Movement remaining
                    remaining: speed

                });

            }

            return this.actors.get(actor.id);
        },


        // ========================================================
        // GET CURRENT WALKING SPEED
        // ========================================================

        getMovementSpeed(actor) {

            const movement =
                actor.system?.attributes?.movement;

            return Number(
                movement?.walk ?? 0
            );

        },


        // ========================================================
        // RESET MOVEMENT
        // ========================================================

        reset(actor) {

            const speed =
                this.getMovementSpeed(actor);

            this.actors.set(actor.id, {

                base: speed,
                total: speed,
                spent: 0,
                remaining: speed

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


        // ========================================================
        // RECORD MOVEMENT
        // ========================================================

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

        },


        // ========================================================
        // REJECT ILLEGAL MOVEMENT
        // ========================================================

        async rejectMovement(token, movement, actor) {

            const tokenId =
                token.document?.id;

            if (!tokenId) return;


            // ----------------------------------------------------
            // Prevent our corrective movement from triggering
            // another rejection.
            // ----------------------------------------------------

            if (this.reverting.has(tokenId)) {
                return;
            }


            this.reverting.add(tokenId);


            try {

                const origin =
                    movement?.origin;

                if (!origin) {
                    return;
                }


                console.log(
                    "%c[MOVEMENT TRACKER] ILLEGAL MOVEMENT",
                    "color: red; font-weight: bold;",
                    actor.name,
                    "→ movement rejected"
                );


                // ------------------------------------------------
                // Return the token to the position it occupied
                // before the illegal movement.
                // ------------------------------------------------

                await token.document.update({

                    x: origin.x,
                    y: origin.y,
                    elevation: origin.elevation

                });


                // ------------------------------------------------
                // Tell the player why the movement was rejected.
                // ------------------------------------------------

                if (!game.user.isGM) {

                    ui.notifications.warn(
                        `${actor.name} is out of movement!`
                    );

                }

            } finally {

                // ------------------------------------------------
                // Small delay ensures Foundry has completed the
                // corrective token update before allowing another
                // movement attempt.
                // ------------------------------------------------

                setTimeout(() => {

                    this.reverting.delete(tokenId);

                }, 100);

            }

        }

    };


    // ============================================================
    // TOKEN MOVEMENT
    // ============================================================

    Hooks.on(
        "moveToken",
        async (token, movement) => {

            // ----------------------------------------------------
            // Only track movement during combat.
            // ----------------------------------------------------

            const combat =
                game.combat;

            if (!combat) return;


            // ----------------------------------------------------
            // Resolve the actor.
            // ----------------------------------------------------

            const actor =
                globalThis.movementTracker.getActorFromToken(
                    token
                );

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
            // Only enforce movement during this actor's turn.
            // ----------------------------------------------------

            if (
                combat.combatant?.id !==
                combatant.id
            ) {
                return;
            }


            // ----------------------------------------------------
            // Foundry v13 provides completed movement in
            // movement.passed.
            // ----------------------------------------------------

            const passed =
                movement?.passed;

            if (!passed) return;


            const distance =
                Number(
                    passed.distance ?? 0
                );

            const cost =
                Number(
                    passed.cost ?? 0
                );


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
            // Get current movement state.
            // ----------------------------------------------------

            const state =
                globalThis.movementTracker.getState(
                    actor
                );


            // ----------------------------------------------------
            // HARD STOP
            //
            // If this movement costs more than the actor has
            // remaining, reject the entire movement.
            // ----------------------------------------------------

            if (
                !game.user.isGM &&
                cost > state.remaining
            ) {

                await globalThis.movementTracker.rejectMovement(
                    token,
                    movement,
                    actor
                );

                return;
            }


            // ----------------------------------------------------
            // Movement is legal.
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


    // ============================================================
    // INITIALIZATION COMPLETE
    // ============================================================

    console.log(
        "%c[MOVEMENT TRACKER] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
