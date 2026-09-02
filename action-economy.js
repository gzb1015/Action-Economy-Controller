// ============================================================
// ACTION ECONOMY CONTROLLER
// Foundry VTT 13
// D&D 5e 5.3.3
//
// Tracks:
//   ACTION
//   BONUS ACTION
//   REACTION
//
// Enforces one use per resource per turn.
// Synchronizes with BG3 HUD.
// ============================================================

console.log(
    "%c[ACTION ECONOMY] MODULE LOADING",
    "color: cyan; font-size: 16px; font-weight: bold;"
);


// ============================================================
// PREVENT DUPLICATE INITIALIZATION
// ============================================================

if (globalThis.actionEconomy) {

    console.warn(
        "[ACTION ECONOMY] Already initialized."
    );

} else {

    // ============================================================
    // CONTROLLER
    // ============================================================

    globalThis.actionEconomy = {

        // --------------------------------------------------------
        // ACTOR RESOURCE STATES
        // --------------------------------------------------------

        actors: new Map(),


        getState(actor) {

            if (!actor) return null;


            if (!this.actors.has(actor.id)) {

                this.actors.set(
                    actor.id,
                    {
                        action: false,
                        bonus: false,
                        reaction: false
                    }
                );

            }


            return this.actors.get(actor.id);

        },


        // --------------------------------------------------------
        // GET RESOURCE TYPE
        // --------------------------------------------------------

        getResource(activity) {

            const type =
                activity?.activation?.type;


            if (type === "action") {

                return "action";

            }


            if (type === "bonus") {

                return "bonus";

            }


            if (type === "reaction") {

                return "reaction";

            }


            return null;

        },


        // --------------------------------------------------------
        // GET COMBATANT
        // --------------------------------------------------------

        getCombatant(actor) {

            if (!actor) return null;


            const combat =
                game.combat;


            if (!combat) return null;


            return (
                combat.combatants?.find(
                    combatant =>
                        combatant.actor?.id === actor.id
                )
                ?? null
            );

        },


        // --------------------------------------------------------
        // IS ACTOR'S TURN?
        // --------------------------------------------------------

        isActorTurn(actor) {

            if (!actor) return false;


            const combat =
                game.combat;


            if (!combat) return true;


            const combatant =
                this.getCombatant(actor);


            if (!combatant) return false;


            return (
                combat.combatant?.id ===
                combatant.id
            );

        },


        // --------------------------------------------------------
        // BG3 HUD SYNCHRONIZATION
        // --------------------------------------------------------

        syncHUD(actor, resource, isUsed) {

            const hud =
                globalThis.ui?.BG3HUD_APP;


            if (!hud) return;


            const filters =
                hud.components?.filters;


            if (!filters) return;


            const filter =
                filters.filterButtons?.find(
                    button =>
                        button.data?.id === resource
                );


            if (!filter) return;


            // ----------------------------------------------------
            // Prevent our manual Action hook from interpreting
            // this AEC-generated HUD update as a player click.
            // ----------------------------------------------------

            if (
                resource === "action" &&
                isUsed
            ) {

                filters.__aecSyncingAction = true;

            }


            filters._syncFilterUsedState(
                filter,
                isUsed
            );


            if (
                resource === "action" &&
                isUsed
            ) {

                filters.__aecSyncingAction = false;

            }


            console.log(
                "%c[ACTION ECONOMY] HUD SYNC",
                "color: magenta; font-weight: bold;",
                actor.name,
                resource,
                "→",
                isUsed
                    ? "USED"
                    : "AVAILABLE"
            );

        },


        // --------------------------------------------------------
        // RESET ACTOR
        // --------------------------------------------------------

        reset(actor) {

            if (!actor) return;


            const state =
                this.getState(actor);


            state.action = false;
            state.bonus = false;
            state.reaction = false;


            console.log(
                "%c[ACTION ECONOMY] RESET",
                "color: yellow; font-weight: bold;",
                actor.name
            );


            // Give the HUD time to render/update.
            setTimeout(() => {

                this.syncHUD(
                    actor,
                    "action",
                    false
                );

                this.syncHUD(
                    actor,
                    "bonus",
                    false
                );

                this.syncHUD(
                    actor,
                    "reaction",
                    false
                );

            }, 100);

        },


        // --------------------------------------------------------
        // MARK RESOURCE USED
        // --------------------------------------------------------

        use(actor, resource) {

            if (!actor) return false;

            if (!resource) return false;


            const state =
                this.getState(actor);


            if (state[resource]) {

                return false;

            }


            state[resource] = true;


            console.log(
                "%c[ACTION ECONOMY] USED",
                "color: lime; font-weight: bold;",
                actor.name,
                resource
            );


            setTimeout(() => {

                this.syncHUD(
                    actor,
                    resource,
                    true
                );

            }, 100);


            return true;

        },


        // --------------------------------------------------------
        // MANUAL BG3 HUD ACTION FILTER
        //
        // A player can right-click the Action filter in BG3 HUD.
        // BG3 HUD changes FilterContainer.used, which ultimately
        // modifies filters._used.
        //
        // We intercept that setter and treat manually marking
        // Action as used as consuming the Action Economy resource.
        //
        // IMPORTANT:
        // Removing the HUD filter does NOT refund the Action.
        // The AEC state remains consumed until the turn resets.
        // --------------------------------------------------------

        installHUDActionFilterHook() {

            if (
                globalThis.__aecHUDActionFilterHookInstalled
            ) {

                console.log(
                    "[ACTION ECONOMY] HUD Action filter hook already installed."
                );

                return;

            }


            const hud =
                globalThis.ui?.BG3HUD_APP;


            if (!hud) {

                console.warn(
                    "[ACTION ECONOMY] BG3 HUD not available; Action filter hook not installed."
                );

                return;

            }


            const filters =
                hud.components?.filters;


            if (!filters) {

                console.warn(
                    "[ACTION ECONOMY] BG3 HUD filters not available; Action filter hook not installed."
                );

                return;

            }


            const filterContainerProto =
                Object.getPrototypeOf(
                    Object.getPrototypeOf(filters)
                );


            const descriptor =
                Object.getOwnPropertyDescriptor(
                    filterContainerProto,
                    "used"
                );


            if (
                !descriptor?.set ||
                !descriptor?.get
            ) {

                console.warn(
                    "[ACTION ECONOMY] Could not locate FilterContainer.used setter."
                );

                return;

            }


            // ----------------------------------------------------
            // Save original setter.
            // ----------------------------------------------------

            globalThis.__aecOriginalHUDUsedSetter =
                descriptor.set;


            // ----------------------------------------------------
            // Replace setter while preserving original behavior.
            // ----------------------------------------------------

            Object.defineProperty(
                filterContainerProto,
                "used",
                {

                    configurable:
                        descriptor.configurable,

                    enumerable:
                        descriptor.enumerable,

                    get:
                        descriptor.get,

                    set(value) {

                        // ----------------------------------------
                        // Always allow BG3 HUD to perform its
                        // normal filter behavior first.
                        // ----------------------------------------

                        globalThis.__aecOriginalHUDUsedSetter.call(
                            this,
                            value
                        );


                        // ----------------------------------------
                        // Ignore Action changes generated by AEC
                        // itself.
                        // ----------------------------------------

                        if (
                            this.__aecSyncingAction
                        ) {

                            return;

                        }


                        // ----------------------------------------
                        // Only care about the Action filter.
                        // ----------------------------------------

                        const filterId =
                            value?.data?.id;


                        if (
                            filterId !== "action"
                        ) {

                            return;

                        }


                        // ----------------------------------------
                        // The setter toggles the filter.
                        //
                        // We only care about the filter becoming
                        // USED. Turning it off must never refund
                        // the Action.
                        // ----------------------------------------

                        const actionIsUsed =
                            this._used?.some(
                                filter =>
                                    filter?.data?.id === "action"
                            );


                        if (!actionIsUsed) {

                            return;

                        }


                        const actor =
                            this.actor;


                        if (!actor) return;


                        const controller =
                            globalThis.actionEconomy;


                        if (!controller) return;


                        const state =
                            controller.getState(actor);


                        if (!state) return;


                        // Already consumed.
                        if (state.action) return;


                        // ----------------------------------------
                        // Manual Action filter = Action consumed.
                        // ----------------------------------------

                        state.action = true;


                        console.log(
                            "%c[ACTION ECONOMY] MANUAL ACTION FILTER DETECTED",
                            "color: orange; font-weight: bold;",
                            actor.name,
                            "→ action"
                        );

                    }

                }
            );


            globalThis.__aecHUDActionFilterHookInstalled =
                true;


            console.log(
                "%c[ACTION ECONOMY] BG3 HUD Action filter hook installed.",
                "color: lime; font-weight: bold;"
            );

        },


        // --------------------------------------------------------
        // GET DISPLAY NAME
        // --------------------------------------------------------

        getDisplayName(resource) {

            return {

                action: "Action",
                bonus: "Bonus Action",
                reaction: "Reaction"

            }[resource] ?? resource;

        }

    };


    // ============================================================
    // PRIMARY ACTION ECONOMY GATE
    //
    // Fires BEFORE the activity is configured.
    // Returning false prevents the activity from being used.
    // ============================================================

    Hooks.on(
        "dnd5e.preUseActivity",
        (
            activity,
            usageConfig,
            dialogConfig,
            messageConfig
        ) => {

            const actor =
                activity?.actor;


            if (!actor) return;


            const resource =
                globalThis.actionEconomy.getResource(
                    activity
                );


            if (!resource) return;


            const combat =
                game.combat;


            if (!combat) return;


            const combatant =
                globalThis.actionEconomy.getCombatant(
                    actor
                );


            if (!combatant) return;


            // ----------------------------------------------------
            // HARD TURN LOCK
            // ----------------------------------------------------

            if (
                combat.combatant?.id !==
                combatant.id
            ) {

                ui.notifications.error(
                    `${actor.name} cannot use ${globalThis.actionEconomy.getDisplayName(resource)} because it is not their turn.`
                );


                console.log(
                    "%c[ACTION ECONOMY] BLOCKED OUT OF TURN",
                    "color: red; font-weight: bold;",
                    actor.name,
                    activity.name,
                    resource
                );


                return false;

            }


            // ----------------------------------------------------
            // GET STATE
            // ----------------------------------------------------

            const state =
                globalThis.actionEconomy.getState(
                    actor
                );


            // ----------------------------------------------------
            // RESOURCE ALREADY USED
            // ----------------------------------------------------

            if (state[resource]) {

                const displayName =
                    globalThis.actionEconomy.getDisplayName(
                        resource
                    );


                ui.notifications.error(
                    `${actor.name} has already used their ${displayName} this turn.`
                );


                console.log(
                    "%c[ACTION ECONOMY] BLOCKED",
                    "color: red; font-weight: bold;",
                    actor.name,
                    activity.name,
                    resource
                );


                return false;

            }


            // ----------------------------------------------------
            // RESERVE RESOURCE
            // ----------------------------------------------------

            state[resource] = true;


            console.log(
                "%c[ACTION ECONOMY] RESERVED",
                "color: cyan; font-weight: bold;",
                actor.name,
                activity.name,
                "→",
                resource
            );

        }
    );


    // ============================================================
    // CONFIRM SUCCESSFUL ACTIVITY
    // ============================================================

    Hooks.on(
        "dnd5e.postUseActivity",
        (
            activity,
            usageConfig,
            results
        ) => {

            const actor =
                activity?.actor;


            if (!actor) return;


            const resource =
                globalThis.actionEconomy.getResource(
                    activity
                );


            if (!resource) return;


            const combat =
                game.combat;


            if (!combat) return;


            const combatant =
                globalThis.actionEconomy.getCombatant(
                    actor
                );


            if (!combatant) return;


            const state =
                globalThis.actionEconomy.getState(
                    actor
                );


            if (!state[resource]) return;


            console.log(
                "%c[ACTION ECONOMY] CONFIRMED",
                "color: lime; font-weight: bold;",
                actor.name,
                activity.name,
                "→",
                resource
            );


            globalThis.actionEconomy.syncHUD(
                actor,
                resource,
                true
            );

        }
    );


    // ============================================================
    // RESET ON NEW TURN
    // ============================================================

    Hooks.on(
        "updateCombat",
        (
            combat,
            changed
        ) => {

            if (!("turn" in changed)) return;


            const combatant =
                combat.combatant;


            if (!combatant?.actor) return;


            globalThis.actionEconomy.reset(
                combatant.actor
            );

        }
    );


    // ============================================================
    // INSTALL BG3 HUD ACTION FILTER HOOK
    //
    // BG3 HUD may not exist at the instant this file executes,
    // so install it when the Foundry UI is ready.
    // ============================================================

    Hooks.once(
        "ready",
        () => {

            setTimeout(() => {

                globalThis.actionEconomy
                    ?.installHUDActionFilterHook();

            }, 500);

        }
    );


    // ============================================================
    // CONTROLLER READY
    // ============================================================

    console.log(
        "%c[ACTION ECONOMY] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
