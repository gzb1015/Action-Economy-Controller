// ============================================================
// TRACKER UI
// Action Economy / Movement Display
// Foundry VTT v13 / D&D 5e 5.3.3
// ============================================================

(() => {
    "use strict";

    const UI_ID = "aec-tracker-ui";
    const STYLE_ID = "aec-tracker-styles";

    let positionFrame = null;


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


    // ============================================================
    // POSITION MOVEMENT WHEEL
    // ============================================================

    function positionTracker() {

        const ui =
            document.getElementById(UI_ID);

        const filter =
            document.querySelector(
                ".bg3-filter-container"
            );


        if (!ui || !filter) {
            return;
        }


        const rect =
            filter.getBoundingClientRect();


        const centerX =
            rect.left +
            (rect.width / 2);


        const centerY =
            rect.top;


        const left =
            `${centerX}px`;

        const top =
            `${centerY - 53}px`;


        /*
         * IMPORTANT:
         *
         * Do not write the same style values repeatedly.
         * The BG3 watcher observes style mutations, so unnecessary
         * writes can cause a MutationObserver feedback loop.
         */

        if (ui.style.left !== left) {
            ui.style.left = left;
        }

        if (ui.style.top !== top) {
            ui.style.top = top;
        }
    }


    // ============================================================
    // SCHEDULE POSITION UPDATE
    // ============================================================

    function schedulePositionUpdate() {

        if (positionFrame !== null) {
            return;
        }


        positionFrame =
            requestAnimationFrame(() => {

                positionFrame = null;

                positionTracker();

            });
    }


    // ============================================================
    // GET SINGLE SELECTED TOKEN
    // ============================================================

    function getSingleSelectedToken() {

        const controlled =
            canvas.tokens?.controlled ?? [];


        if (controlled.length !== 1) {
            return null;
        }


        return controlled[0];
    }


    // ============================================================
    // MOVEMENT DISPLAY
    //
    // current = movement spent
    // maximum = total movement available
    // ============================================================

    function updateMovement(
        current,
        maximum
    ) {

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


        if (!ui || !value || !ring) {
            return;
        }


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
                "drop-shadow(0 0 6px rgba(255,70,70,0.9))";


            if (warning) {
                warning.style.display = "none";
            }

        }


        // --------------------------------------------------------
        // NORMAL MOVEMENT
        // --------------------------------------------------------

        else {

            value.style.color =
                "rgb(255,245,190)";


            ring.style.filter =
                "drop-shadow(0 1px 3px rgba(0,0,0,0.65))";


            if (warning) {
                warning.style.display = "none";
            }
        }
    }


    // ============================================================
    // UPDATE FOR ACTOR
    // ============================================================

    function updateMovementForActor(
        actor
    ) {

        if (!actor) return;


        const token =
            getSingleSelectedToken();


        if (!token?.actor) {
            return;
        }


        if (
            token.actor.id !==
            actor.id
        ) {
            return;
        }


        const state =
            globalThis.movementTracker?.getState(
                actor
            );


        if (!state) {
            return;
        }


        updateMovement(
            state.spent,
            state.maximum
        );
    }


    // ============================================================
    // TRACKER VISIBILITY
    //
    // ONLY SHOW WHEN:
    //
    // 1. Combat is active
    // 2. EXACTLY ONE token is selected
    // 3. That token has an actor
    // 4. That actor has movement state
    // ============================================================

    function setTrackerCombatVisibility() {

        const ui =
            document.getElementById(UI_ID);

        if (!ui) return;


        const inCombat =
            !!game.combat &&
            game.combat.started === true;


        const selectedToken =
            getSingleSelectedToken();


        if (
            !inCombat ||
            !selectedToken?.actor
        ) {

            if (ui.style.display !== "none") {
                ui.style.display = "none";
            }

            return;
        }


        const state =
            globalThis.movementTracker?.getState(
                selectedToken.actor
            );


        if (!state) {

            if (ui.style.display !== "none") {
                ui.style.display = "none";
            }

            return;
        }


        updateMovement(
            state.spent,
            state.maximum
        );


        if (ui.style.display !== "flex") {
            ui.style.display = "flex";
        }


        schedulePositionUpdate();
    }


    // ============================================================
    // BG3 HUD ACTION INDICATORS
    // ============================================================

    function setBG3CombatVisibility() {

        const hotbar =
            document.querySelector(
                "#bg3-hotbar"
            );


        const filter =
            document.querySelector(
                ".bg3-filter-container"
            );


        if (
            navigator.userAgent.includes("Firefox") &&
            hotbar &&
            hotbar.classList.contains(
                "bg3-hud-visible"
            )
        ) {

            hotbar.style.removeProperty(
                "display"
            );
        }


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

        }

        else {

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
    //
    // IMPORTANT:
    //
    // The tracker itself is excluded from the observer.
    // This prevents our own UI style changes from retriggering
    // the observer indefinitely.
    // ============================================================

    function startBG3Watcher() {

        if (window.__aecBG3Watcher) {

            window.__aecBG3Watcher.disconnect();

        }


        window.__aecBG3Watcher =
            new MutationObserver(
                (mutations) => {

                    let relevantMutation =
                        false;


                    for (
                        const mutation
                        of mutations
                    ) {

                        const target =
                            mutation.target;


                        /*
                         * Ignore mutations generated by
                         * the tracker itself.
                         */

                        if (
                            target ===
                            document.getElementById(
                                UI_ID
                            ) ||
                            target.closest?.(
                                `#${UI_ID}`
                            )
                        ) {

                            continue;
                        }


                        /*
                         * Ignore the tracker style element.
                         */

                        if (
                            target ===
                            document.getElementById(
                                STYLE_ID
                            )
                        ) {

                            continue;
                        }


                        relevantMutation = true;

                        break;
                    }


                    if (!relevantMutation) {
                        return;
                    }


                    schedulePositionUpdate();

                    setBG3CombatVisibility();

                    setTrackerCombatVisibility();
                }
            );


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
    // WINDOW POSITION LISTENERS
    // ============================================================

    function registerPositionListeners() {

        window.addEventListener(
            "resize",
            schedulePositionUpdate
        );


        window.addEventListener(
            "scroll",
            schedulePositionUpdate,
            true
        );
    }


    // ============================================================
    // TOKEN SELECTION
    // ============================================================

    function registerTokenSelectionHook() {

        Hooks.on(
            "controlToken",
            () => {

                /*
                 * Always use the centralized visibility function.
                 *
                 * This guarantees the tracker cannot appear merely
                 * because a token was selected outside combat.
                 */

                setTrackerCombatVisibility();

                schedulePositionUpdate();
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


                setTimeout(
                    () => {

                        setBG3CombatVisibility();

                        setTrackerCombatVisibility();

                        schedulePositionUpdate();

                    },
                    100
                );


                setTimeout(
                    () => {

                        setBG3CombatVisibility();

                        setTrackerCombatVisibility();

                        schedulePositionUpdate();

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
            (
                combat,
                changed
            ) => {

                setTrackerCombatVisibility();


                if (
                    "turn" in changed
                ) {

                    setBG3CombatVisibility();

                    schedulePositionUpdate();
                }
            }
        );
    }


    // ============================================================
    // STYLES
    // ============================================================

    function injectStyles() {

        if (
            document.getElementById(
                STYLE_ID
            )
        ) {

            return;
        }


        const style =
            document.createElement(
                "style"
            );


        style.id =
            STYLE_ID;


        style.textContent = `

/* ============================================================
   MOVEMENT TRACKER
   ============================================================ */

#${UI_ID} {

    position: fixed;

    width: 50px;
    height: 50px;

    transform:
        translateX(-50%);

    display: none;

    align-items: center;
    justify-content: center;

    pointer-events: none;

    user-select: none;

    z-index: 100;

    font-family:
        Signika,
        sans-serif;

    color: white;
}


/* ============================================================
   WHEEL
   ============================================================ */

#${UI_ID} .aec-stamina-wheel {

    width: 50px;
    height: 50px;

    position: relative;

    display: flex;

    align-items: center;
    justify-content: center;
}


/* ============================================================
   YELLOW MOVEMENT RING
   ============================================================ */

#${UI_ID} .aec-stamina-ring {

    --aec-progress: 100%;

    width: 47px;
    height: 47px;

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

        0 0 4px
            rgba(0,0,0,0.90),

        0 0 5px
            rgba(231,200,90,0.35),

        inset 0 0 3px
            rgba(255,255,255,0.30);

    transition:
        filter 0.15s ease;
}


/* ============================================================
   SEGMENT MARKERS
   ============================================================ */

#${UI_ID} .aec-stamina-ring::before {

    content: "";

    position: absolute;

    inset: 0;

    border-radius: 50%;

    background:
        repeating-conic-gradient(
            from -90deg,

            rgba(20,20,20,0.85)
                0deg 4deg,

            transparent
                4deg 30deg
        );

    -webkit-mask:
        radial-gradient(
            farthest-side,

            transparent
                calc(100% - 6px),

            #000
                calc(100% - 5px)
        );

    mask:
        radial-gradient(
            farthest-side,

            transparent
                calc(100% - 6px),

            #000
                calc(100% - 5px)
        );

    pointer-events: none;
}


/* ============================================================
   CENTER
   ============================================================ */

#${UI_ID} .aec-stamina-center {

    position: absolute;

    inset: 10px;

    border-radius: 50%;

    display: flex;

    align-items: center;
    justify-content: center;

    background:
        radial-gradient(
            circle,

            rgba(30,30,30,0.97),

            rgba(10,10,10,0.99)
        );

    border:
        1px solid
        rgba(255,255,255,0.18);

    box-shadow:
        inset 0 0 4px
        rgba(0,0,0,0.9);
}


/* ============================================================
   MOVEMENT NUMBER
   ============================================================ */

#aec-movement-value {

    font-size: 16px;

    font-weight: bold;

    line-height: 1;

    color:
        rgb(255,245,190);

    text-shadow:
        0 1px 2px
        rgba(0,0,0,0.9);
}


/* ============================================================
   WARNING
   ============================================================ */

#aec-warning {

    display: none;

    position: absolute;

    top: 52px;

    left: 50%;

    transform:
        translateX(-50%);

    white-space: nowrap;

    font-size: 9px;

    font-weight: bold;

    color:
        rgb(255,102,102);

    text-shadow:
        0 1px 2px
        rgba(0,0,0,0.9);
}

        `;


        document.head.appendChild(
            style
        );
    }


    // ============================================================
    // PUBLIC UI API
    // ============================================================

    globalThis.AECTrackerUI = {

        updateMovement,

        updateMovementForActor,

        setTrackerCombatVisibility,

        schedulePositionUpdate

    };


    // ============================================================
    // INITIALIZE
    // ============================================================

    function initialize() {

        createTrackerUI();

        registerTokenSelectionHook();

        registerCombatHooks();

        startBG3Watcher();

        registerPositionListeners();


        setTrackerCombatVisibility();

        setBG3CombatVisibility();

        schedulePositionUpdate();


        setTimeout(
            () => {

                setBG3CombatVisibility();

                setTrackerCombatVisibility();

                schedulePositionUpdate();

            },
            500
        );
    }


    // ============================================================
    // READY
    // ============================================================

    Hooks.once(
        "ready",
        initialize
    );

})();
