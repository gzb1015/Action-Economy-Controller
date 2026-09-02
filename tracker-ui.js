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


        /*
         * Initially put it on the body.
         *
         * attachTrackerToBG3Filter() will move it into
         * the BG3 action row once that row exists.
         */
        document.body.appendChild(ui);

        injectStyles();

        return ui;
    }


    // ============================================================
    // ATTACH MOVEMENT WHEEL TO BG3 HUD
    // ============================================================

    function attachTrackerToBG3Filter() {

        const ui =
            document.getElementById(UI_ID);

        const filter =
            document.querySelector(
                ".bg3-filter-container"
            );

        if (!ui || !filter) return false;


        /*
         * Already attached.
         */
        if (ui.parentElement === filter) {
            return true;
        }


        /*
         * BG3 may rebuild this container.
         *
         * appendChild automatically removes the tracker
         * from its previous parent and places it into the
         * current BG3 action row.
         */
        filter.appendChild(ui);


        console.log(
            "%c[AEC UI] Movement wheel attached to BG3 action HUD.",
            "color: cyan; font-weight: bold;"
        );

        return true;
    }


    // ============================================================
    // CSS
    // ============================================================

    function injectStyles() {

        if (document.getElementById(STYLE_ID)) return;

        const style =
            document.createElement("style");

        style.id =
            STYLE_ID;

        style.textContent = `

    /* ============================================================
       MOVEMENT TRACKER
       ============================================================ */

    #${UI_ID} {

        position: static;

        /*
         * Slightly larger than the original 24px wheel.
         * Still intentionally compact beside the action icons.
         */
        width: 36px;
        height: 36px;

        margin-left: 5px;
        margin-right: 2px;

        flex: 0 0 36px;

        display: none;

        align-items: center;
        justify-content: center;

        user-select: none;

        /*
         * Never steal clicks from BG3 controls.
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

        width: 34px;
        height: 34px;

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

        width: 32px;
        height: 32px;

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

        transition:
            filter 0.15s ease;
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
                    calc(100% - 4px),

                #000
                    calc(100% - 3px)
            );

        mask:
            radial-gradient(
                farthest-side,

                transparent
                    calc(100% - 4px),

                #000
                    calc(100% - 3px)
            );

        pointer-events: none;
    }


    /* ============================================================
       CENTER
       ============================================================ */

    #${UI_ID} .aec-stamina-center {

        position: absolute;

        inset: 7px;

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

        font-size: 9px;

        font-weight: bold;

        line-height: 1;

        color:
            rgb(255,245,190);

        text-shadow:
            0 1px 2px black;

        white-space: nowrap;
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

        flex: 0 0 36px;
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
         * Make sure the wheel is inside the current
         * BG3 action filter.
         */
        const attached =
            attachTrackerToBG3Filter();


        /*
         * If BG3 has not created its HUD yet,
         * keep our tracker hidden.
         */
        if (!attached) {

            ui.style.display =
                "none";

            return;
        }


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
    // maximum = movement available
    // ============================================================

    function updateMovement(current, maximum) {

        const ui =
            document.getElementById(UI_ID);

        const value =
            document.getElementById(
                "aec-movement-value"
            );

        const warning =
            document.getElementById(
                "aec-warning"
            );

        const ring =
            ui?.querySelector(
                ".aec-stamina-ring"
            );


        if (!value || !ring) return;


        current =
            Math.max(
                0,
                Number(current) || 0
            );

        maximum =
            Math.max(
                0,
                Number(maximum) || 0
            );


        const remaining =
            Math.max(
                0,
                maximum - current
            );


        const percent =
            maximum > 0
                ? Math.min(
                    100,
                    (remaining / maximum) * 100
                )
                : 0;


        /*
         * Keep the wheel compact.
         * Number only — no "ft".
         */
        value.textContent =
            `${Math.ceil(remaining)}`;


        ring.style.setProperty(
            "--aec-progress",
            `${percent}%`
        );


        // --------------------------------------------------------
        // EMPTY MOVEMENT
        // --------------------------------------------------------

        if (remaining <= 0) {

            value.style.color =
                "rgb(255,102,102)";

            ring.style.filter =
                "drop-shadow(0 0 3px rgba(255,70,70,0.8))";

            if (warning) {
                warning.style.display =
                    "none";
            }

        }


        // --------------------------------------------------------
        // NORMAL MOVEMENT
        // --------------------------------------------------------

        else {

            value.style.color =
                "rgb(255,245,190)";

            ring.style.filter =
                "none";

            if (warning) {
                warning.style.display =
                    "none";
            }
        }


        setTrackerCombatVisibility();
    }


    // ============================================================
    // BG3 HUD ACTION INDICATORS
    //
    // THIS IS THE ORIGINAL WORKING LOGIC.
    // DO NOT REMOVE THE !important FLAGS.
    // ============================================================

    function setBG3CombatVisibility() {

        const filter =
            document.querySelector(
                ".bg3-filter-container"
            );

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

            filter.style.removeProperty(
                "opacity"
            );

            filter.style.removeProperty(
                "visibility"
            );

            filter.style.removeProperty(
                "display"
            );
        }
    }


    // ============================================================
    // BG3 HUD WATCHER
    // ============================================================

    function startBG3Watcher() {

        if (window.__aecBG3Watcher) {
            return;
        }


        window.__aecBG3Watcher =
            new MutationObserver(() => {

                /*
                 * First make sure the movement wheel is
                 * attached to the CURRENT BG3 filter.
                 */
                attachTrackerToBG3Filter();


                /*
                 * Keep our wheel's own combat visibility
                 * synchronized.
                 */
                setTrackerCombatVisibility();


                /*
                 * IMPORTANT:
                 *
                 * Preserve the existing BG3 action-filter
                 * visibility logic.
                 */
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

                attributeFilter: [
                    "style",
                    "class"
                ]
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


                /*
                 * BG3 may finish constructing its HUD
                 * slightly after combat starts.
                 */
                setTimeout(
                    () => {

                        attachTrackerToBG3Filter();
                        setTrackerCombatVisibility();
                        setBG3CombatVisibility();

                    },
                    100
                );


                setTimeout(
                    () => {

                        attachTrackerToBG3Filter();
                        setTrackerCombatVisibility();
                        setBG3CombatVisibility();

                    },
                    500
                );
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

        /*
         * Create our tracker.
         */
        createTrackerUI();


        /*
         * Try to attach immediately.
         * If BG3 has not created its HUD yet,
         * the MutationObserver will catch it.
         */
        attachTrackerToBG3Filter();


        /*
         * Start watching for BG3 HUD rebuilds.
         */
        startBG3Watcher();


        /*
         * Register combat hooks.
         */
        registerCombatHooks();


        /*
         * Set both systems' initial visibility.
         */
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
