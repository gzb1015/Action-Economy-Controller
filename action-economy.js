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
//
// Also synchronizes manually-used BG3 HUD Action filters
// back into the Action Economy controller.
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


            filters._syncFilterUsedState(
                filter,
                isUsed
            );


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
        // SYNC MANUALLY-USED BG3 ACTION FILTER
        //
        // BG3 HUD tracks manually-used filters internally in:
        //
        //     filters._used
        //
        // A manually-used Action filter appears there as:
        //
        //     FilterButton.data.id === "action"
        //
        // This bridges that HUD state back into AEC.
        // --------------------------------------------------------

        syncManualActionFilter() {

            const hud =
                globalThis.ui?.BG3HUD_APP;


            if (!hud) return;


            const filters =
                hud.components?.filters;


            if (!filters) return;


            const actionIsUsed =
                filters._used?.some(
                    filter =>
                        filter?.data?.id === "action"
                );


            // Nothing to synchronize if Action is not
            // currently marked as used in the HUD.
            if (!actionIsUsed) return;


            const actor =
                filters.actor;


            if (!actor) return;


            const state =
                this.getState(actor);


            // Already synchronized.
            if (state.action) return;


            state.action = true;


            console.log(
                "%c[ACTION ECONOMY] MANUAL ACTION FILTER DETECTED",
                "color: orange; font-weight: bold;",
                actor.name,
                "→ action"
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
    // BG3 HUD MANUAL ACTION FILTER WATCHER
    //
    // Watches for changes to the HUD filter classes.
    //
    // We do NOT rely solely on the DOM class. When a change occurs,
    // syncManualActionFilter() checks the HUD's actual internal
    // filters._used collection.
    // ============================================================

    function startManualActionFilterWatcher() {

        if (globalThis.__aecManualActionWatcher) return;


        globalThis.__aecManualActionWatcher =
            new MutationObserver(() => {

                globalThis.actionEconomy
                    ?.syncManualActionFilter();

            });


        globalThis.__aecManualActionWatcher.observe(
            document.body,
            {
                subtree: true,
                attributes: true,
                attributeFilter: ["class"]
            }
        );


        console.log(
            "%c[ACTION ECONOMY] Manual Action filter watcher started.",
            "color: orange; font-weight: bold;"
        );

    }


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
            // We reserve it here, before the activity can continue,
            // so a second rapid click cannot sneak another Action
            // through before the first activity finishes.
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
    // Here we synchronize the HUD after the activity activates.
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
    // CONTROLLER READY
    // ============================================================

    Hooks.once(
        "ready",
        () => {

            startManualActionFilterWatcher();

            console.log(
                "%c[ACTION ECONOMY] CONTROLLER READY",
                "color: lime; font-size: 16px; font-weight: bold;"
            );

        }
    );


    // ============================================================
    // CONTROLLER CREATED
    // ============================================================

    console.log(
        "%c[ACTION ECONOMY] CONTROLLER CREATED",
        "color: lime; font-size: 16px; font-weight: bold;"
    );

}
