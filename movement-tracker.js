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
    // MOVEMENT MODIFIERS
    //
    // These are calculated dynamically from the actor.
    //
    // We do NOT permanently modify the actor's movement speed.
    // This allows effects to appear/disappear safely.
    // ============================================================

    function getMovementModifiers(actor) {

        if (!actor) {

            return {
                multiplier: 1,
                flat: 0,
                reasons: []
            };

        }

        let multiplier = 1;
        let flat = 0;

        const reasons = [];


        // --------------------------------------------------------
        // PRONE
        //
        // Standing up from Prone costs half of the creature's
        // movement speed.
        //
        // While prone, movement itself is not reduced to zero.
        // The important cost is standing up.
        //
        // We track this separately so the tracker can later
        // account for the actual 5e movement rules.
        // --------------------------------------------------------

        const isProne =
            actor.effects?.some(
                effect =>
                    effect.name?.toLowerCase() === "prone" ||
                    effect.label?.toLowerCase() === "prone" ||
                    effect.statuses?.has?.("prone")
            );

        if (isProne) {

            reasons.push("Prone");

        }


        // --------------------------------------------------------
        // FUTURE MODIFIERS
        //
        // Additional movement effects will be added here.
        //
        // Examples:
        // - Grappled
        // - Restrained
        // - Difficult Terrain
        // - Haste
        // - Slow
        // - Bladesong
        // - Exhaustion-related effects
        //
        // We intentionally leave these out for now rather than
        // guessing how another module is implementing them.
        // --------------------------------------------------------


        return {
            multiplier,
            flat,
            reasons
        };

    }


    // ============================================================
    // GET BASE MOVEMENT SPEED
    // ============================================================

    function getBaseMovementSpeed(actor) {

        return Number(
            actor?.system?.attributes?.movement?.walk ?? 30
        );

    }


    // ============================================================
    // GET EFFECTIVE MOVEMENT SPEED
    // ============================================================

    function getMovementSpeed(actor) {

        if (!actor) return 30;

        const base =
            getBaseMovementSpeed(actor);

        const modifiers =
            getMovementModifiers(actor);

        const effective =
            Math.max(
                0,
                (base * modifiers.multiplier) +
                modifiers.flat
            );

        return effective;

    }


    // ============================================================
    // GET MOVEMENT STATE
    // ============================================================

    function getState(actor) {

        if (!actor) return null;

        let state =
            actors.get(actor.id);

        if (!state) {

            const maximum =
                getMovementSpeed(actor);

            state = {

                // Base movement available this turn.
                baseMaximum:
                    maximum,

                // Additional movement granted by Dash.
                dashBonus:
                    0,

                // Total movement available.
                maximum,

                // Movement remaining.
                remaining:
                    maximum,

                // Movement already spent.
                spent:
                    0,

                // Whether Dash has already been activated.
                dashed:
                    false,

                // Effective speed used when the state was last
                // calculated.
                movementSpeed:
                    maximum

            };

            actors.set(
                actor.id,
                state
            );

        }

        return state;

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

            // Actor isn't participating in this combat.
            return false;

        }

        return (
            combat.combatant?.id ===
            combatant.id
        );

    }


    // ============================================================
    // CAN ACTOR MOVE?
    // ============================================================

    function canMove(actor) {

        if (!actor) return false;

        // GM is never restricted by the tracker.
        if (game.user?.isGM) return true;

        // During combat, only the active combatant can move.
        if (!isActorTurn(actor)) {

            return false;

        }

        const state =
            getState(actor);

        if (!state) return false;

        return state.remaining > 0;

    }


    // ============================================================
    // RECALCULATE CURRENT MOVEMENT
    //
    // This is important when a condition/effect changes during
    // a turn.
    //
    // We preserve movement already spent.
    // ============================================================

    function recalculate(actor) {

        if (!actor) return null;

        const state =
            getState(actor);

        if (!state) return null;


        const movementSpeed =
            getMovementSpeed(actor);


        // Preserve Dash as an additional copy of the current
        // effective movement speed.
        //
        // Example:
        //
        // 30 speed
        // Dash
        // 60 total
        //
        // If speed later becomes 20:
        //
        // 20 base + 20 Dash = 40 total.
        //
        const dashBonus =
            state.dashed
                ? movementSpeed
                : 0;


        const maximum =
            movementSpeed +
            dashBonus;


        const spent =
            state.spent;


        state.baseMaximum =
            movementSpeed;

        state.dashBonus =
            dashBonus;

        state.movementSpeed =
            movementSpeed;

        state.maximum =
            maximum;

        state.remaining =
            Math.max(
                0,
                maximum - spent
            );


        globalThis.AECTrackerUI?.updateMovement(
            state.spent,
            state.maximum
        );


        console.log(
            `%c[MOVEMENT TRACKER] RECALCULATED ${actor.name} → ` +
            `${state.remaining} ft remaining ` +
            `(${movementSpeed} base` +
            `${state.dashed ? ` + ${dashBonus} Dash` : ""})`,
            "color: violet; font-weight: bold;"
        );


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

                baseMaximum:
                    maximum,

                dashBonus:
                    0,

                maximum:
                    maximum,

                remaining:
                    maximum,

                spent:
                    0,

                dashed:
                    false,

                movementSpeed:
                    maximum

            }
        );


        console.log(
            `%c[MOVEMENT TRACKER] RESET ${actor.name} → ` +
            `${maximum} ft available`,
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


        // --------------------------------------------------------
        // TURN CHECK
        // --------------------------------------------------------

        if (!game.user?.isGM && !isActorTurn(actor)) {

            ui.notifications.warn(
                `${actor.name} cannot Dash because it is not their turn.`
            );

            console.warn(
                `[MOVEMENT TRACKER] BLOCKED DASH → ${actor.name} ` +
                `(not their turn)`
            );

            return false;

        }


        const state =
            getState(actor);

        if (!state) return false;


        // --------------------------------------------------------
        // PREVENT MULTIPLE DASHES
        // --------------------------------------------------------

        if (state.dashed) {

            console.log(
                `%c[MOVEMENT TRACKER] ${actor.name} ` +
                `already dashed this turn.`,
                "color: yellow; font-weight: bold;"
            );

            ui.notifications.warn(
                `${actor.name} has already used Dash this turn.`
            );

            return false;

        }


        // --------------------------------------------------------
        // CURRENT EFFECTIVE SPEED
        // --------------------------------------------------------

        const movementSpeed =
            getMovementSpeed(actor);


        // --------------------------------------------------------
        // ADD DASH
        // --------------------------------------------------------

        state.dashed =
            true;

        state.dashBonus =
            movementSpeed;

        state.maximum +=
            movementSpeed;

        state.remaining +=
            movementSpeed;


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
            `${actor.name}: Dash activated! ` +
            `+${movementSpeed} ft movement.`
        );


        return true;

    }


    // ============================================================
    // RECORD MOVEMENT
    // ============================================================

    function recordMovement(
        actor,
        cost,
        distance
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
            `${movementCost} ft cost | ` +
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

        getBaseMovementSpeed,

        getMovementModifiers,

        getCombatant,

        isActorTurn,

        canMove,

        recalculate,

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
                    "[MOVEMENT TRACKER] Could not find a token " +
                    "to install path limiter."
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
                    //
                    // Movement is unrestricted outside combat.
                    // ------------------------------------------------

                    const combat =
                        game.combat;


                    if (!combat) {

                        return result;

                    }


                    // ------------------------------------------------
                    // VERIFY ACTOR IS CURRENT COMBATANT
                    // ------------------------------------------------

                    const combatant =
                        combat.combatants?.find(
                            c =>
                                c.actor?.id ===
                                actor.id
                        );


                    if (!combatant) {

                        return result;

                    }


                    // ------------------------------------------------
                    // HARD TURN LOCK
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


                    // ------------------------------------------------
                    // RECALCULATE CURRENT STATE
                    //
                    // This catches movement changes caused by
                    // effects added/removed during the turn.
                    // ------------------------------------------------

                    const state =
                        tracker.recalculate(actor);


                    if (!state) {

                        return result;

                    }


                    // ------------------------------------------------
                    // NO MOVEMENT REMAINING
                    // ------------------------------------------------

                    if (
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
                            "[MOVEMENT TRACKER] Failed to measure path:",
                            error
                        );

                        return result;

                    }


                    const totalCost =
                        Number(
                            measurement?.cost ?? 0
                        );


                    // ------------------------------------------------
                    // PATH IS WITHIN REMAINING MOVEMENT
                    // ------------------------------------------------

                    if (
                        totalCost <=
                        state.remaining
                    ) {

                        return result;

                    }


                    // ------------------------------------------------
                    // LIMIT PATH
                    // ------------------------------------------------

                    console.log(
                        `%c[MOVEMENT TRACKER] LIMITING ${actor.name} → ` +
                        `${totalCost} ft requested | ` +
                        `${state.remaining} ft remaining`,
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
                                "[MOVEMENT TRACKER] Failed measuring " +
                                "candidate path:",
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
        (
            token,
            movement
        ) => {

            const actor =
                token.actor;


            if (!actor) return;


            // ------------------------------------------------
            // NEVER RECORD MOVEMENT OUTSIDE THE ACTOR'S TURN
            // ------------------------------------------------

            if (
                !game.user?.isGM &&
                game.combat &&
                !isActorTurn(actor)
            ) {

                console.warn(
                    `%c[MOVEMENT TRACKER] IGNORED MOVEMENT RECORD → ` +
                    `${actor.name} moved outside their turn.`,
                    "color: red; font-weight: bold;"
                );

                return;

            }


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
                `%c[MOVEMENT TRACKER] DASH ACTIVITY DETECTED → ` +
                `${actor.name}`,
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
    // EFFECT CHANGE DETECTION
    //
    // When an actor changes, recalculate movement.
    //
    // This lets movement modifiers update without requiring a
    // new turn.
    // ============================================================

    Hooks.on(
        "updateActor",
        (
            actor,
            changed
        ) => {

            if (!actors.has(actor.id)) return;


            if (
                changed.system?.attributes?.movement ||
                changed.effects
            ) {

                recalculate(actor);

            }

        }
    );


    // ============================================================
    // EFFECT CREATION / REMOVAL
    // ============================================================

    Hooks.on(
        "createActiveEffect",
        effect => {

            const actor =
                effect.parent;


            if (!actor?.id) return;


            if (!actors.has(actor.id)) return;


            recalculate(actor);

        }
    );


    Hooks.on(
        "deleteActiveEffect",
        effect => {

            const actor =
                effect.parent;


            if (!actor?.id) return;


            if (!actors.has(actor.id)) return;


            recalculate(actor);

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
