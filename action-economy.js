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


            // Outside combat there is no turn restriction.
            if (!combat) return true;


            const combatant =
                this.getCombatant(actor);


            if (!combatant) return false;


            return (
                combat.combatant?.id ===
                combatant.id
            );

        },


        // ========================================================
        // BG3 HUD SYNCHRONIZATION
        // ========================================================

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
            // Tell our Action-filter hook that this change is
            // being made by AEC rather than manually by the player.
            // ----------------------------------------------------

            if (
                resource === "action"
            ) {

                filters.__aecSyncingAction = true;

            }


            filters._syncFilterUsedState(
                filter,
                isUsed
            );


            if (
                resource === "action"
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


        // ========================================================
        // RESET ACTOR
        // ========================================================

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


        // ========================================================
        // MARK RESOURCE USED
        // ========================================================

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


        // ========================================================
        // MANUAL BG3 HUD ACTION FILTER HOOK
        //
        // BG3 HUD's FilterContainer.used setter is the actual
        // mechanism used when a player right-clicks a filter.
        //
        // We intercept that setter while preserving the original
        // BG3 HUD behavior.
        //
        // Manually marking Action as USED consumes the AEC Action.
        //
        // Removing the HUD filter does NOT refund the Action.
        // ========================================================

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


            // ----------------------------------------------------
            // DnD5eFilterContainer extends FilterContainer.
            //
            // Therefore the FilterContainer prototype is two
            // levels above the current filters object.
            // ----------------------------------------------------

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
            // Replace setter.
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
                        // FIRST:
                        // Let BG3 HUD perform its normal behavior.
                        // ----------------------------------------

                        globalThis.__aecOriginalHUDUsedSetter.call(
                            this,
                            value
                        );


                        // ----------------------------------------
                        // Ignore changes generated by AEC itself.
                        // ----------------------------------------

                        if (
                            this.__aecSyncingAction
                        ) {

                            return;

                        }


                        // ----------------------------------------
                        // Only monitor the Action filter.
                        // ----------------------------------------

                        const filterId =
                            value?.data?.id;


                        if (
                            filterId !== "action"
                        ) {

                            return;

                        }


                        // ----------------------------------------
                        // The HUD setter toggles the filter.
                        //
                        // We only care when Action becomes USED.
                        // ----------------------------------------

                        const actionIsUsed =
                            this._used?.some(
                                filter =>
                                    filter?.data?.id === "action"
                            );


                        // If the player turned the filter OFF,
                        // do nothing. The Action remains consumed.
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
                        // MANUAL ACTION FILTER = ACTION USED
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


        // ========================================================
        // KEEP ACTION FILTER IN SYNC WITH AEC STATE
        //
        // BG3 HUD can refresh its filters when the token moves,
        // when the HUD updates, or when other UI changes occur.
        //
        // If AEC says Action is already consumed, restore the
        // Action filter's USED state after those updates.
        // ========================================================

        installHUDActionPersistenceHooks() {
            if (globalThis.__aecHUDActionPersistenceHooksInstalled) return;

            const filters = ui.BG3HUD_APP?.components?.filters;
            if (!filters) {
                console.warn(
                    "[ACTION ECONOMY] BG3 HUD filters not available for persistence hook."
                );
                return;
            }

            const dndProto = Object.getPrototypeOf(filters);
            const originalSync = dndProto.syncUsedActionFilters;

            if (typeof originalSync !== "function") {
                console.warn(
                    "[ACTION ECONOMY] syncUsedActionFilters() not found."
                );
                return;
            }

            if (globalThis.__aecOriginalSyncUsedActionFilters) {
                console.warn(
                    "[ACTION ECONOMY] syncUsedActionFilters hook already exists."
                );
                return;
            }

            globalThis.__aecOriginalSyncUsedActionFilters = originalSync;

            dndProto.syncUsedActionFilters = function (...args) {

               // Let BG3 HUD perform its normal Bonus Action / Reaction sync.
                const result = globalThis.__aecOriginalSyncUsedActionFilters.apply(
                    this,
                    args
                );

                const actor = this.actor;
                if (!actor) return result;

                const state = globalThis.actionEconomy?.getState(actor);
                if (!state) return result;

                // Only restore the HUD indicator if AEC says the Action
                // has already been consumed.
                if (!state.action) return result;

                const actionFilter = this
                    .getAllFilterButtons()
                    .find(f => f.data?.id === "action");

                if (!actionFilter) return result;

                const currentlyUsed = this._used?.includes(actionFilter);

                if (!currentlyUsed) {

                    // Prevent our own setter from being interpreted as
                    // the player manually changing the Action filter.
                    this.__aecSyncingAction = true;

                    try {
                        this.used = actionFilter;

                        console.log(
                            "%c[ACTION ECONOMY] RESTORED HUD ACTION INDICATOR",
                            "color: cyan; font-weight: bold;",
                            actor.name
                        );
                    } finally {
                        this.__aecSyncingAction = false;
                    }
                }

                return result;
            };

            globalThis.__aecHUDActionPersistenceHooksInstalled = true;

            console.log(
                "%c[ACTION ECONOMY] BG3 HUD Action persistence hook installed on syncUsedActionFilters().",
                "color: lime; font-weight: bold;"
            );
        },


        // ========================================================
        // GET DISPLAY NAME
        // ========================================================

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


            // Activities without an Action Economy cost
            // are not handled here.
            if (!resource) return;


            const combat =
                game.combat;


            // Outside combat:
            // Do not enforce turn-based Action Economy.
            if (!combat) return;


            const combatant =
                globalThis.actionEconomy.getCombatant(
                    actor
                );


            // Actor is not part of the active combat.
            // Do not interfere with their activity.
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
            //
            // Reserve before the activity continues so a second
            // rapid click cannot sneak another use through.
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
    //
    // The resource was already reserved by preUseActivity.
    // Synchronize the HUD after the activity activates.
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


            // Only sync if this resource was reserved.
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
    // INSTALL BG3 HUD HOOKS
    //
    // BG3 HUD may not exist at the instant this file executes,
    // so wait until Foundry is ready.
    // ============================================================

   Hooks.once("ready", () => {
    const installHUDHooks = () => {
        const filters = ui.BG3HUD_APP?.components?.filters;

        if (!filters) {
            console.log(
                "[ACTION ECONOMY] Waiting for BG3 HUD filters..."
            );
            return false;
        }

        controller.installHUDActionFilterHook();
        controller.installHUDActionPersistenceHooks();

        return true;
    };

    // Try immediately.
    if (installHUDHooks()) return;

    // BG3 HUD may initialize after the Foundry ready hook.
    // Check periodically until it becomes available.
    const interval = setInterval(() => {
        if (installHUDHooks()) {
            clearInterval(interval);
            console.log(
                "[ACTION ECONOMY] BG3 HUD hooks successfully installed after waiting."
            );
        }
    }, 250);

    // Safety timeout so we don't leave an interval running forever.
    setTimeout(() => {
        clearInterval(interval);
    }, 30000);
});

    // ============================================================
    // CONTROLLER READY
    // ============================================================

    console.log(
        "%c[ACTION ECONOMY] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
