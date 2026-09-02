// ============================================================
// ACTION ECONOMY TRACKER — TRACKER UI
// ============================================================

const UI_ID = "aec-tracker-ui";

let movementValue = null;
let movementRing = null;
let movementWarning = null;


// ============================================================
// CREATE UI
// ============================================================

function createTrackerUI() {
    let ui = document.getElementById(UI_ID);

    if (ui) {
        movementValue = ui.querySelector("#aec-movement-value");
        movementRing = ui.querySelector(".aec-stamina-ring");
        movementWarning = ui.querySelector("#aec-warning");
        return ui;
    }

    ui = document.createElement("div");
    ui.id = UI_ID;

    ui.innerHTML = `
        <div class="aec-stamina-wheel" aria-label="Movement remaining">
            <div class="aec-stamina-ring">
                <div class="aec-stamina-center">
                    <span id="aec-movement-value">30</span>
                </div>
            </div>
        </div>

        <div id="aec-warning">
            NO MORE MOVEMENT
        </div>
    `;

    document.body.appendChild(ui);

    movementValue = ui.querySelector("#aec-movement-value");
    movementRing = ui.querySelector(".aec-stamina-ring");
    movementWarning = ui.querySelector("#aec-warning");

    injectStyles();

    return ui;
}


// ============================================================
// ATTACH TO BG3 HUD
// ============================================================

function attachTrackerToBG3Filter() {
    const ui = document.getElementById(UI_ID);
    const filter = document.querySelector(".bg3-filter-container");

    if (!ui || !filter) return false;

    // Already attached
    if (ui.parentElement === filter) return true;

    filter.appendChild(ui);

    console.log(
        "%c[AEC UI] Movement wheel attached to BG3 HUD.",
        "color: cyan; font-weight: bold;"
    );

    return true;
}


// ============================================================
// COMBAT VISIBILITY
// ============================================================

function setTrackerCombatVisibility() {
    const ui = document.getElementById(UI_ID);

    if (!ui) return;

    const attached = attachTrackerToBG3Filter();

    if (!attached) {
        ui.style.display = "none";
        return;
    }

    const inCombat =
        !!game.combat &&
        game.combat.started === true;

    ui.style.display = inCombat ? "flex" : "none";
}


// ============================================================
// BG3 HUD VISIBILITY
// ============================================================

function setBG3CombatVisibility() {
    const filter = document.querySelector(".bg3-filter-container");

    if (!filter) return;

    const inCombat =
        !!game.combat &&
        game.combat.started === true;

    filter.style.display = inCombat ? "flex" : "";
}


// ============================================================
// MUTATION WATCHER
// ============================================================

function startBG3Watcher() {
    if (window.__aecBG3Watcher) {
        window.__aecBG3Watcher.disconnect();
    }

    window.__aecBG3Watcher =
        new MutationObserver(() => {

            // BG3 can rebuild its filter container when
            // actions/movement are used, so make sure our
            // movement tracker gets reattached.
            attachTrackerToBG3Filter();

            setTrackerCombatVisibility();

            if (game.combat?.started === true) {
                setBG3CombatVisibility();
            }
        });

    window.__aecBG3Watcher.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
            "style",
            "class"
        ]
    });
}


// ============================================================
// MOVEMENT UPDATE
// ============================================================

function updateMovement(current, maximum) {
    const ui = document.getElementById(UI_ID);

    if (!ui) return;

    if (!movementValue) {
        movementValue =
            ui.querySelector("#aec-movement-value");
    }

    if (!movementRing) {
        movementRing =
            ui.querySelector(".aec-stamina-ring");
    }

    if (!movementWarning) {
        movementWarning =
            ui.querySelector("#aec-warning");
    }

    const remaining =
        Math.max(0, maximum - current);

    const percent =
        maximum > 0
            ? Math.min(
                100,
                (remaining / maximum) * 100
            )
            : 0;

    // Display only the number.
    // "ft" is intentionally omitted so the wheel stays compact.
    movementValue.textContent =
        `${Math.ceil(remaining)}`;

    movementRing.style.setProperty(
        "--aec-progress",
        `${percent}%`
    );

    // --------------------------------------------------------
    // EMPTY MOVEMENT
    // --------------------------------------------------------

    if (remaining <= 0) {

        movementValue.style.color =
            "rgb(255,102,102)";

        movementRing.style.filter =
            "drop-shadow(0 0 3px rgba(255,70,70,0.8))";

        if (movementWarning) {
            movementWarning.style.display = "none";
        }

    }

    // --------------------------------------------------------
    // NORMAL MOVEMENT
    // --------------------------------------------------------

    else {

        movementValue.style.color =
            "rgb(255,245,190)";

        movementRing.style.filter =
            "none";

        if (movementWarning) {
            movementWarning.style.display = "none";
        }
    }
}


// ============================================================
// REFRESH BG3 HUD
// ============================================================

function refreshBG3() {
    attachTrackerToBG3Filter();

    if (game.combat?.started === true) {
        setBG3CombatVisibility();
    }

    setTrackerCombatVisibility();
}


// ============================================================
// COMBAT HOOKS
// ============================================================

function registerCombatHooks() {

    Hooks.on("combatStart", () => {

        setBG3CombatVisibility();
        setTrackerCombatVisibility();

    });

    Hooks.on("combatEnd", () => {

        setBG3CombatVisibility();
        setTrackerCombatVisibility();

    });

    Hooks.on("updateCombat", () => {

        setBG3CombatVisibility();
        setTrackerCombatVisibility();

    });

    Hooks.on("updateToken", () => {

        if (game.combat?.started === true) {
            setTrackerCombatVisibility();
        }

    });
}


// ============================================================
// STYLES
// ============================================================

function injectStyles() {

    if (document.getElementById("aec-tracker-styles")) {
        return;
    }

    const style =
        document.createElement("style");

    style.id = "aec-tracker-styles";

    style.textContent = `

        /* ====================================================
           MAIN CONTAINER
           ==================================================== */

        #aec-tracker-ui {

            width: 36px;
            height: 36px;

            min-width: 36px;
            min-height: 36px;

            margin-left: 5px;

            display: flex;

            align-items: center;
            justify-content: center;

            position: relative;

            flex-shrink: 0;

            pointer-events: none;

            z-index: 9999;
        }


        /* ====================================================
           STAMINA WHEEL
           ==================================================== */

        #aec-tracker-ui .aec-stamina-wheel {

            width: 34px;
            height: 34px;

            position: relative;

            display: flex;

            align-items: center;
            justify-content: center;
        }


        /* ====================================================
           OUTER RING
           ==================================================== */

        #aec-tracker-ui .aec-stamina-ring {

            --aec-progress: 100%;

            width: 32px;
            height: 32px;

            border-radius: 50%;

            position: relative;

            display: flex;

            align-items: center;
            justify-content: center;

            background:
                conic-gradient(
                    from -90deg,
                    rgb(218,178,76) 0%,
                    rgb(218,178,76) var(--aec-progress),
                    rgba(80,65,35,0.55) var(--aec-progress),
                    rgba(80,65,35,0.55) 100%
                );

            box-shadow:
                0 0 2px rgba(255,230,150,0.65),
                inset 0 0 2px rgba(0,0,0,0.8);

            transition:
                filter 0.15s ease,
                background 0.15s ease;
        }


        /* ====================================================
           SEGMENTED / BOTW-LIKE EFFECT
           ==================================================== */

        #aec-tracker-ui .aec-stamina-ring::before {

            content: "";

            position: absolute;

            inset: 0;

            border-radius: 50%;

            background:
                repeating-conic-gradient(
                    from -90deg,
                    rgba(255,245,190,0.75) 0deg,
                    rgba(255,245,190,0.75) 2deg,
                    transparent 2deg,
                    transparent 12deg
                );

            -webkit-mask:
                radial-gradient(
                    farthest-side,
                    transparent calc(100% - 4px),
                    #000 calc(100% - 3px)
                );

            mask:
                radial-gradient(
                    farthest-side,
                    transparent calc(100% - 4px),
                    #000 calc(100% - 3px)
                );

            pointer-events: none;
        }


        /* ====================================================
           CENTER
           ==================================================== */

        #aec-tracker-ui .aec-stamina-center {

            position: absolute;

            inset: 7px;

            border-radius: 50%;

            background:
                radial-gradient(
                    circle,
                    rgba(30,28,20,0.96),
                    rgba(10,10,8,0.98)
                );

            display: flex;

            align-items: center;
            justify-content: center;

            box-shadow:
                inset 0 0 3px rgba(0,0,0,0.9);
        }


        /* ====================================================
           MOVEMENT NUMBER
           ==================================================== */

        #aec-tracker-ui #aec-movement-value {

            font-family:
                "Signika",
                "Modesto Condensed",
                sans-serif;

            font-size: 9px;

            font-weight: 700;

            line-height: 1;

            color:
                rgb(255,245,190);

            text-shadow:
                0 0 2px rgba(0,0,0,0.95);

            user-select: none;

            white-space: nowrap;
        }


        /* ====================================================
           WARNING
           ==================================================== */

        #aec-tracker-ui #aec-warning {

            display: none;

            position: absolute;

            pointer-events: none;
        }

    `;

    document.head.appendChild(style);
}


// ============================================================
// INITIALIZE
// ============================================================

function initialize() {

    createTrackerUI();

    attachTrackerToBG3Filter();

    startBG3Watcher();

    registerCombatHooks();

    setTrackerCombatVisibility();

    if (game.combat?.started === true) {
        setBG3CombatVisibility();
    }

    // Initialize the movement display from the
    // current combatant if one exists.
    const combatant =
        game.combat?.combatant;

    if (combatant?.actor) {

        const actor =
            combatant.actor;

        const maximum =
            actor.system?.attributes?.movement?.walk ??
            30;

        updateMovement(
            0,
            maximum
        );
    }

    console.log(
        "%c[AEC UI] Tracker UI initialized.",
        "color: lime; font-weight: bold;"
    );
}


// ============================================================
// GLOBAL API
// ============================================================

globalThis.AECTrackerUI = {

    updateMovement,

    refreshBG3,

    refreshCombatVisibility:
        setTrackerCombatVisibility
};


// ============================================================
// START
// ============================================================

Hooks.once("ready", () => {

    initialize();

});
