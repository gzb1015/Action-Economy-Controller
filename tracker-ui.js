// ============================================================
// TRACKER UI
// Action Economy / Movement Display
// Foundry VTT v13 / D&D 5e 5.3.3
//
// Responsibilities:
//   - Show movement during combat only
//   - Display movement as an original BotW-inspired stamina wheel
//   - Show "NO MORE MOVEMENT" when movement is exhausted
//   - Keep BG3 HUD Action / Bonus Action / Feature indicators visible
//     during combat
//
// Does NOT calculate or restrict movement.
// movement-tracker.js remains the source of truth.
// ============================================================

(() => {
    "use strict";

    const UI_ID = "aec-tracker-ui";
    const STYLE_ID = "aec-tracker-styles";

    // ============================================================
    // CREATE UI
    // ============================================================

    function createTrackerUI() {

    let ui =
        document.getElementById(UI_ID);

    if (ui) return ui;


    ui =
        document.createElement("div");

    ui.id =
        UI_ID;

    ui.innerHTML = `
        <div
            class="aec-stamina-wheel"
            aria-label="Movement remaining"
        >
            <div class="aec-stamina-ring">

                <div class="aec-stamina-center">

                    <span id="aec-movement-value">
                        30
                    </span>

                </div>

            </div>
        </div>

        <div id="aec-warning">
            NO MORE MOVEMENT
        </div>
    `;


    document.body.appendChild(ui);

    injectStyles();

    return ui;
}

    function attachTrackerToBG3Filter() {

    const ui =
        document.getElementById(UI_ID);

    const filter =
        document.querySelector(
            ".bg3-filter-container"
        );

    if (!ui || !filter) return;


    /*
     * Already attached to the correct container.
     */
    if (ui.parentElement === filter) {
        return;
    }


    /*
     * Move the movement tracker into
     * the BG3 action filter row.
     *
     * appendChild automatically removes it
     * from its previous parent.
     */
    filter.appendChild(ui);


    console.log(
        "%c[AEC UI] Movement wheel attached to BG3 action HUD.",
        "color: cyan; font-weight: bold;"
    );
}


    // ============================================================
    // CSS
    // ============================================================

    function injectStyles() {

        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement("style");
        style.id = STYLE_ID;

       style.textContent = `

    /* ============================================================
       MOVEMENT TRACKER
       Compact BG3 HUD integration
       ============================================================ */

    #${UI_ID} {

        position: static;

        width: 24px;
        height: 24px;

        margin-left: 3px;
        margin-right: 2px;

        flex: 0 0 24px;

        display: none;

        align-items: center;
        justify-content: center;

        user-select: none;

        /*
         * The wheel should never steal clicks from
         * the BG3 HUD.
         */
        pointer-events: none;

        color: white;

        font-family:
            Signika,
            sans-serif;

        filter:
            drop-shadow(
                0 1px 3px
                rgba(0,0,0,0.65)
            );

        position: relative;
    }


    /* ============================================================
       STAMINA WHEEL
       ============================================================ */

    #${UI_ID} .aec-stamina-wheel {

        width: 24px;
        height: 24px;

        position: relative;

        display: flex;

        align-items: center;
        justify-content: center;
    }


    /* ============================================================
       OUTER RING
       ============================================================ */

    #${UI_ID} .aec-stamina-ring {

        --aec-progress: 100%;

        width: 22px;
        height: 22px;

        border-radius: 50%;

        position: relative;

        background:
            conic-gradient(
                from -90deg,

                #e7c85a
                    0 var(--aec-progress),

                rgba(20,20,20,0.70)
                    var(--aec-progress) 100%
            );

        box-shadow:
            0 0 3px
                rgba(0,0,0,0.85),

            inset 0 0 2px
                rgba(255,255,255,0.30);
    }


    /* ============================================================
       SEGMENTED / TACTICAL RING DETAIL
       ============================================================ */

    #${UI_ID} .aec-stamina-ring::before {

        content: "";

        position: absolute;

        inset: 0;

        border-radius: 50%;

        background:
            repeating-conic-gradient(
                from -90deg,

                rgba(20,20,20,0.80)
                    0deg 3deg,

                transparent
                    3deg 30deg
            );

        -webkit-mask:
            radial-gradient(
                farthest-side,

                transparent
                    calc(100% - 3px),

                #000
                    calc(100% - 2px)
            );

        mask:
            radial-gradient(
                farthest-side,

                transparent
                    calc(100% - 3px),

                #000
                    calc(100% - 2px)
            );
    }


    /* ============================================================
       CENTER
       ============================================================ */

    #${UI_ID} .aec-stamina-center {

        position: absolute;

        inset: 5px;

        border-radius: 50%;

        display: flex;

        align-items: center;
        justify-content: center;

        background:
            rgba(18,18,18,0.92);

        border:
            1px solid
            rgba(255,255,255,0.18);

        box-shadow:
            inset 0 0 3px
            rgba(0,0,0,0.80);
    }


    /* ============================================================
       MOVEMENT NUMBER
       ============================================================ */

    #${UI_ID} #aec-movement-value {

        font-size: 7px;

        font-weight: bold;

        line-height: 1;

        color:
            rgb(255,245,190);

        text-shadow:
            0 1px 2px black;
    }


    /* ============================================================
       EXHAUSTED WARNING
       ============================================================ */

    #${UI_ID} #aec-warning {

        display: none;
    }


    /* ============================================================
       BG3 HUD INTEGRATION
       ============================================================ */

    .bg3-filter-container
        #${UI_ID} {

        position: static;

        display: flex;

        flex: 0 0 24px;
    }

`;

        document.head.appendChild(style);
    }


    // ============================================================
    // COMBAT VISIBILITY
    // ============================================================

    function setTrackerCombatVisibility() {

    const ui =
        document.getElementById(UI_ID);

    if (!ui) return;


    /*
     * Make sure the tracker is actually inside
     * the BG3 HUD before changing visibility.
     */
    attachTrackerToBG3Filter();


    const inCombat =
        !!game.combat &&
        game.combat.started === true;


    ui.style.display =
        inCombat
            ? "flex"
            : "none";
}


    // ============================================================
    // MOVEMENT DISPLAY
    //
    // current = movement spent
    // maximum = movement speed
    // ============================================================

    function updateMovement(current, maximum) {

        const ui =
            document.getElementById(UI_ID);

        const value =
            document.getElementById("aec-movement-value");

        const warning =
            document.getElementById("aec-warning");

        const ring =
            ui?.querySelector(".aec-stamina-ring");

        if (!value || !ring) return;

        current = Math.max(0, Number(current) || 0);
        maximum = Math.max(0, Number(maximum) || 0);

        const remaining =
            Math.max(0, maximum - current);

        const percent =
            maximum > 0
                ? Math.min(100, (remaining / maximum) * 100)
                : 0;

        value.textContent =
            `${Math.ceil(remaining)}`;

        ring.style.setProperty(
            "--aec-progress",
            `${percent}%`
        );

        if (remaining <= 0) {

            value.style.color =
                "rgb(255,102,102)";

            ring.style.filter =
                "drop-shadow(0 0 3px rgba(255,70,70,0.8))";

            if (warning) {
                warning.style.display = "none";
            }

        } else {

            value.style.color =
                "rgb(255,245,190)";

            ring.style.filter =
                "none";

            if (warning) {
                warning.style.display = "none";
            }
        }

        setTrackerCombatVisibility();
    }


    // ============================================================
    // BG3 HUD ACTION INDICATORS
    // ============================================================

    function setBG3CombatVisibility() {

        const filter =
            document.querySelector(".bg3-filter-container");

        if (!filter) return;

        const inCombat =
            !!game.combat &&
            game.combat.started === true;

        if (inCombat) {

            filter.style.setProperty(
                "opacity",
                "1",
                "important"
            );

            filter.style.setProperty(
                "visibility",
                "visible",
                "important"
            );

            filter.style.setProperty(
                "display",
                "flex",
                "important"
            );

        } else {

            filter.style.removeProperty("opacity");
            filter.style.removeProperty("visibility");
            filter.style.removeProperty("display");
        }
    }


    // ============================================================
    // BG3 HUD WATCHER
    // ============================================================

    function startBG3Watcher() {

        if (window.__aecBG3Watcher) return;

        window.__aecBG3Watcher =
            new MutationObserver(() => {

                /*
                 * BG3 can rebuild the HUD.
                 * Reattach our movement wheel if necessary.
                 */
                attachTrackerToBG3Filter();

                setTrackerCombatVisibility();


                if (
                    game.combat?.started === true
                ) {

                    setBG3CombatVisibility();

                }

            });
        
        window.__aecBG3Watcher.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ["style", "class"]
            }
        );
    }


    // ============================================================
    // COMBAT HOOKS
    // ============================================================

    function registerCombatHooks() {

        Hooks.on(
            "combatStart",
            () => {

                setTrackerCombatVisibility();
                setBG3CombatVisibility();

                setTimeout(setBG3CombatVisibility, 100);
                setTimeout(setBG3CombatVisibility, 500);
            }
        );

        Hooks.on(
            "deleteCombat",
            () => {

                setTrackerCombatVisibility();
                setBG3CombatVisibility();
            }
        );

        Hooks.on(
            "updateCombat",
            (combat, changed) => {

                setTrackerCombatVisibility();

                if ("turn" in changed) {
                    setBG3CombatVisibility();
                }
            }
        );
    }


    // ============================================================
    // INITIALIZATION
    // ============================================================

    function initialize() {

        createTrackerUI();
        
        attachTrackerToBG3Filter();
        
        startBG3Watcher();

        registerCombatHooks();

        setTrackerCombatVisibility();
        
        setBG3CombatVisibility();

        console.log(
            "%c[AEC UI] Movement UI initialized.",
            "color: lime; font-size: 16px; font-weight: bold;"
        );
    }


    // ============================================================
    // PUBLIC API
    // ============================================================

    globalThis.AECTrackerUI = {

        updateMovement,

        refreshBG3:
            setBG3CombatVisibility,

        refreshCombatVisibility:
            setTrackerCombatVisibility
    };


    // ============================================================
    // FOUNDRY READY
    // ============================================================

    if (typeof Hooks !== "undefined") {

        Hooks.once(
            "ready",
            initialize
        );

    } else {

        console.error(
            "[AEC UI] Foundry Hooks unavailable."
        );
    }

})();
