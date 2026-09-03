(() => {
    "use strict";

    const UI_ID = "aec-tracker-ui";
    const STYLE_ID = "aec-tracker-styles";

    let positionFrame = null;


    /* ============================================================
     * CREATE TRACKER UI
     * ============================================================ */

    function createTrackerUI() {

        let ui =
            document.getElementById(UI_ID);

        if (ui) return ui;


        ui =
            document.createElement("div");

        ui.id = UI_ID;

        ui.innerHTML = `
            <div class="aec-tracker-wheel">

                <div class="aec-tracker-ring"></div>

                <div class="aec-tracker-text">

                    <div class="aec-tracker-feet">
                        0
                    </div>

                    <div class="aec-tracker-label">
                        ft
                    </div>

                </div>

            </div>
        `;


        /*
         * IMPORTANT:
         *
         * The tracker is attached directly to BODY rather than
         * inside the BG3 HUD. BG3 rebuilds its HUD/filter
         * containers, which would otherwise destroy the tracker.
         */

        document.body.appendChild(ui);

        return ui;
    }


    /* ============================================================
     * CREATE STYLES
     * ============================================================ */

    function createStyles() {

        if (document.getElementById(STYLE_ID))
            return;


        const style =
            document.createElement("style");

        style.id = STYLE_ID;


        style.textContent = `

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

                /*
                 * Keep this modest so Foundry application
                 * windows can appear above the tracker.
                 */
                z-index: 100;

                font-family:
                    Signika,
                    sans-serif;

                color: white;
            }


            #${UI_ID} .aec-tracker-wheel {

                position: relative;

                width: 50px;
                height: 50px;

                display: flex;

                align-items: center;
                justify-content: center;
            }


            #${UI_ID} .aec-tracker-ring {

                position: absolute;

                inset: 0;

                border-radius: 50%;

                border:
                    4px solid
                    rgba(255,255,255,0.8);

                box-sizing: border-box;

                background:
                    rgba(0,0,0,0.55);

                box-shadow:
                    0 0 6px
                    rgba(0,0,0,0.8);
            }


            #${UI_ID} .aec-tracker-text {

                position: relative;

                z-index: 1;

                display: flex;

                flex-direction: column;

                align-items: center;

                justify-content: center;

                line-height: 1;
            }


            #${UI_ID} .aec-tracker-feet {

                font-size: 16px;

                font-weight: bold;
            }


            #${UI_ID} .aec-tracker-label {

                font-size: 9px;

                opacity: 0.85;

                margin-top: 2px;
            }
        `;


        document.head.appendChild(style);
    }


    /* ============================================================
     * POSITION TRACKER
     * ============================================================ */

    function positionTracker() {

        const ui =
            document.getElementById(UI_ID);

        if (!ui) return;


        const filter =
            document.querySelector(
                ".bg3-filter-container"
            );


        if (!filter) return;


        const rect =
            filter.getBoundingClientRect();


        const centerX =
            rect.left +
            (rect.width / 2);


        const centerY =
            rect.top;


        ui.style.left =
            `${centerX}px`;


        ui.style.top =
            `${centerY - 53}px`;
    }


    /* ============================================================
     * SCHEDULE POSITION UPDATE
     * ============================================================ */

    function schedulePositionUpdate() {

        if (positionFrame)
            cancelAnimationFrame(positionFrame);


        positionFrame =
            requestAnimationFrame(() => {

                positionFrame = null;

                positionTracker();
            });
    }


    /* ============================================================
     * UPDATE MOVEMENT DISPLAY
     *
     * IMPORTANT:
     *
     * This function ONLY updates the displayed numbers.
     *
     * It does NOT call setTrackerCombatVisibility().
     *
     * This prevents the recursive loop:
     *
     * updateMovement()
     *      ->
     * setTrackerCombatVisibility()
     *      ->
     * updateMovement()
     *      ->
     * ...
     * ============================================================ */

    function updateMovement(
        spent,
        maximum
    ) {

        const ui =
            document.getElementById(UI_ID);

        if (!ui) return;


        const feet =
            Math.max(
                0,
                Math.round(
                    maximum - spent
                )
            );


        const feetElement =
            ui.querySelector(
                ".aec-tracker-feet"
            );


        if (feetElement) {

            feetElement.textContent =
                feet;
        }
    }


    /* ============================================================
     * TRACKER VISIBILITY
     *
     * The tracker follows the currently selected token.
     *
     * For GMs this means selecting different tokens switches
     * which actor's movement state is displayed.
     *
     * For players this follows whichever token they control.
     * ============================================================ */

    function setTrackerCombatVisibility() {

        const ui =
            document.getElementById(UI_ID);

        if (!ui) return;


        const inCombat =
            !!game.combat &&
            game.combat.started === true;


        const selectedToken =
            canvas.tokens?.controlled?.[0];


        /*
         * No combat or no selected token.
         */

        if (
            !inCombat ||
            !selectedToken?.actor
        ) {

            ui.style.display =
                "none";

            return;
        }


        const state =
            globalThis.movementTracker?.getState(
                selectedToken.actor
            );


        /*
         * Actor does not have movement state yet.
         */

        if (!state) {

            ui.style.display =
                "none";

            return;
        }


        /*
         * IMPORTANT:
         *
         * Do NOT call updateMovement() here.
         *
         * updateMovement() is only responsible for
         * changing the displayed number.
         */

        ui.style.display =
            "flex";


        schedulePositionUpdate();
    }


    /* ============================================================
     * BG3 HUD VISIBILITY
     *
     * Firefox compatibility fix.
     * ============================================================ */

    function setBG3CombatVisibility() {

        const hotbar =
            document.querySelector(
                "#bg3-hotbar"
            );


        const filter =
            document.querySelector(
                ".bg3-filter-container"
            );


        /*
         * Firefox compatibility:
         *
         * BG3 can leave an inline
         *
         *     display: none
         *
         * on the hotbar even though the HUD
         * is marked as visible.
         *
         * Remove ONLY the inline display property.
         *
         * Do NOT force display:grid or width.
         */

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


    /* ============================================================
     * TOKEN SELECTION HOOK
     *
     * This is what makes the tracker follow the selected token.
     * ============================================================ */

    function registerTokenSelectionHook() {

        Hooks.on(
            "controlToken",
            (
                token,
                controlled
            ) => {

                const ui =
                    document.getElementById(
                        UI_ID
                    );


                if (!ui) return;


                /*
                 * TOKEN DESELECTED
                 */

                if (!controlled) {

                    ui.style.display =
                        "none";

                    return;
                }


                /*
                 * TOKEN SELECTED
                 */

                const actor =
                    token?.actor;


                if (!actor) {

                    ui.style.display =
                        "none";

                    return;
                }


                /*
                 * Get this specific actor's
                 * movement state.
                 */

                const state =
                    globalThis.movementTracker?.getState(
                        actor
                    );


                if (!state) {

                    ui.style.display =
                        "none";

                    return;
                }


                /*
                 * Update the displayed movement.
                 *
                 * This is safe because updateMovement()
                 * no longer calls setTrackerCombatVisibility().
                 */

                updateMovement(
                    state.spent,
                    state.maximum
                );


                ui.style.display =
                    "flex";


                schedulePositionUpdate();
            }
        );
    }


    /* ============================================================
     * COMBAT HOOKS
     * ============================================================ */

    function registerCombatHooks() {

        Hooks.on(
            "combatStart",
            () => {

                setTrackerCombatVisibility();

                setBG3CombatVisibility();


                /*
                 * BG3 sometimes rebuilds its HUD
                 * shortly after combat starts.
                 */

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
                changes
            ) => {

                setTrackerCombatVisibility();


                /*
                 * Turn changes can cause BG3 HUD
                 * elements to be rebuilt/repositioned.
                 */

                if (
                    changes?.turn !== undefined ||
                    changes?.round !== undefined
                ) {

                    setBG3CombatVisibility();

                    schedulePositionUpdate();
                }
            }
        );
    }


    /* ============================================================
     * BG3 HUD MUTATION WATCHER
     * ============================================================ */

    function registerBG3Watcher() {

        const observer =
            new MutationObserver(
                () => {

                    schedulePositionUpdate();


                    if (
                        game.combat?.started === true
                    ) {

                        setBG3CombatVisibility();
                    }


                    setTrackerCombatVisibility();
                }
            );


        observer.observe(
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


    /* ============================================================
     * INITIALIZE
     * ============================================================ */

    function initialize() {

        createStyles();

        createTrackerUI();


        registerTokenSelectionHook();

        registerCombatHooks();

        registerBG3Watcher();


        /*
         * Initial state.
         */

        setTrackerCombatVisibility();

        setBG3CombatVisibility();

        schedulePositionUpdate();


        /*
         * BG3 can finish rendering slightly after
         * our module initializes.
         */

        setTimeout(
            () => {

                setBG3CombatVisibility();

                setTrackerCombatVisibility();

                schedulePositionUpdate();

            },
            500
        );
    }


    /* ============================================================
     * READY
     * ============================================================ */

    Hooks.once(
        "ready",
        initialize
    );

})();
