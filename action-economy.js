```javascript
// ============================================================
// ACTION ECONOMY CONTROLLER
// Foundry VTT 13
// D&D 5e 5.3.3
// Midi-QOL 13.0.56
// BG3 Inspired HUD 0.6.0
//
// Tracks:
//   ACTION
//   BONUS ACTION
//   REACTION
//
// Enforces one use per resource per turn and synchronizes
// the resource state with BG3 Inspired HUD.
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
        "[ACTION ECONOMY] Controller already exists. Skipping duplicate initialization."
    );

} else {


// ============================================================
// ACTION ECONOMY CONTROLLER
// ============================================================

globalThis.actionEconomy = {

    // --------------------------------------------------------
    // Actor resource states
    // --------------------------------------------------------

    actors: new Map(),

    getState(actor) {

        if (!this.actors.has(actor.id)) {

            this.actors.set(actor.id, {
                action: false,
                bonus: false,
                reaction: false
            });

        }

        return this.actors.get(actor.id);
    },


    // ========================================================
    // BG3 HUD SYNCHRONIZATION
    // ========================================================

    syncHUD(actor, resource, isUsed) {

        const hud = globalThis.ui?.BG3HUD_APP;

        if (!hud) {

            console.log(
                "[ACTION ECONOMY] BG3 HUD not available yet."
            );

            return;
        }


        const filters = hud.components?.filters;

        if (!filters) {

            console.log(
                "[ACTION ECONOMY] BG3 HUD filters not available."
            );

            return;
        }


        const filter = filters.filterButtons?.find(
            button => button.data?.id === resource
        );

        if (!filter) {

            console.log(
                "[ACTION ECONOMY] HUD filter not found:",
                resource
            );

            return;
        }


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
            isUsed ? "USED" : "AVAILABLE"
        );
    }
};


// ============================================================
// ACTIVITY CONSUMPTION
// ============================================================

Hooks.on("dnd5e.preActivityConsumption", (activity, usageConfig) => {

    const actor = activity.actor;

    if (!actor) return;


    // --------------------------------------------------------
    // Must be in combat
    // --------------------------------------------------------

    const combat = game.combat;

    if (!combat) return;


    // --------------------------------------------------------
    // Find this actor's combatant
    // --------------------------------------------------------

    const combatant = combat.combatants.find(
        c => c.actor?.id === actor.id
    );

    if (!combatant) return;


    // --------------------------------------------------------
    // Only enforce during this actor's turn
    // --------------------------------------------------------

    if (combat.combatant?.id !== combatant.id) return;


    // --------------------------------------------------------
    // Determine resource
    // --------------------------------------------------------

    const type = activity.activation?.type;

    let resource = null;

    if (type === "action") {

        resource = "action";

    }

    else if (type === "bonus") {

        resource = "bonus";

    }

    else if (type === "reaction") {

        resource = "reaction";

    }

    else {

        return;
    }


    console.log(
        "%c[ACTION ECONOMY]",
        "color: cyan; font-weight: bold;",
        actor.name,
        activity.name,
        "→",
        resource
    );


    // --------------------------------------------------------
    // Get state
    // --------------------------------------------------------

    const state =
        globalThis.actionEconomy.getState(actor);


    // --------------------------------------------------------
    // Already used?
    // --------------------------------------------------------

    if (state[resource]) {

        const displayName = {

            action: "Action",
            bonus: "Bonus Action",
            reaction: "Reaction"

        }[resource];


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


    // --------------------------------------------------------
    // Consume resource immediately
    //
    // This MUST happen here so a second click is blocked.
    // --------------------------------------------------------

    state[resource] = true;


    console.log(
        "%c[ACTION ECONOMY] USED",
        "color: lime; font-weight: bold;",
        actor.name,
        resource,
        "→",
        activity.name
    );


    // --------------------------------------------------------
    // Update HUD after activity processing
    // --------------------------------------------------------

    setTimeout(() => {

        if (!game.combat) return;

        globalThis.actionEconomy.syncHUD(
            actor,
            resource,
            true
        );

    }, 100);

});


// ============================================================
// RESET RESOURCES WHEN A NEW TURN STARTS
// ============================================================

Hooks.on("updateCombat", (combat, changed) => {

    if (!("turn" in changed)) return;


    const combatant = combat.combatant;

    if (!combatant?.actor) return;


    const actor = combatant.actor;


    const state =
        globalThis.actionEconomy.getState(actor);


    // --------------------------------------------------------
    // Reset resources
    // --------------------------------------------------------

    state.action = false;
    state.bonus = false;
    state.reaction = false;


    // --------------------------------------------------------
    // Give BG3 HUD a moment to finish its own refresh,
    // then restore all three resource indicators.
    // --------------------------------------------------------

    setTimeout(() => {

        globalThis.actionEconomy.syncHUD(
            actor,
            "action",
            false
        );

        globalThis.actionEconomy.syncHUD(
            actor,
            "bonus",
            false
        );

        globalThis.actionEconomy.syncHUD(
            actor,
            "reaction",
            false
        );

    }, 100);


    console.log(
        "%c[ACTION ECONOMY] RESET",
        "color: yellow; font-weight: bold;",
        actor.name
    );

});


console.log(
    "%c[ACTION ECONOMY] CONTROLLER CREATED",
    "color: lime; font-size: 16px; font-weight: bold;"
);

}

```
