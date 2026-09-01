console.log(
    "%c[AEC UI] Loading tracker-ui.js",
    "color: cyan; font-weight: bold;"
);


// ============================================================
// TRACKER UI
// ============================================================

if (globalThis.aecTrackerUI) {

    console.warn("[AEC UI] Already initialized.");

} else {

    class TrackerUI {

        constructor() {

            this.element = null;
            this.warningTimeout = null;

        }


        // ========================================================
        // CREATE UI
        // ========================================================

        create() {

            if (this.element) return;

            const element =
                document.createElement("div");

            element.id =
                "aec-tracker-ui";

            element.innerHTML = `
                <div class="aec-tracker-header">
                    Action Economy
                </div>

                <div class="aec-tracker-row">
                    <span>Movement</span>
                    <span id="aec-movement-value">-- / -- ft</span>
                </div>

                <div class="aec-tracker-row">
                    <span>Action</span>
                    <span id="aec-action-value">●</span>
                </div>

                <div class="aec-tracker-row">
                    <span>Bonus Action</span>
                    <span id="aec-bonus-value">●</span>
                </div>

                <div class="aec-tracker-row">
                    <span>Reaction</span>
                    <span id="aec-reaction-value">●</span>
                </div>
            `;

            element.style.position = "fixed";
            element.style.top = "20px";
            element.style.right = "20px";
            element.style.zIndex = "1000";

            element.style.minWidth = "190px";

            element.style.padding =
                "10px 12px";

            element.style.background =
                "rgba(20, 20, 20, 0.9)";

            element.style.border =
                "1px solid rgba(255,255,255,0.25)";

            element.style.borderRadius =
                "8px";

            element.style.color =
                "white";

            element.style.fontFamily =
                "Signika, sans-serif";

            element.style.fontSize =
                "14px";

            element.style.boxShadow =
                "0 4px 12px rgba(0,0,0,0.4)";

            document.body.appendChild(element);

            this.element = element;

            console.log(
                "%c[AEC UI] UI CREATED",
                "color: lime; font-weight: bold;"
            );

        }


        // ========================================================
        // REMOVE UI
        // ========================================================

        remove() {

            if (!this.element) return;

            this.element.remove();

            this.element = null;

        }


        // ========================================================
        // UPDATE MOVEMENT
        // ========================================================

        updateMovement(actor) {

            if (!this.element) {
                this.create();
            }

            const tracker =
                globalThis.movementTracker;

            if (!tracker) {

                console.warn(
                    "[AEC UI] movementTracker not available."
                );

                return;

            }

            const state =
                tracker.getState(actor);

            if (!state) return;

            const movementElement =
                this.element.querySelector(
                    "#aec-movement-value"
                );

            if (!movementElement) return;

            movementElement.textContent =
                `${state.remaining} / ${state.maximum} ft`;


            // ----------------------------------------------------
            // No movement remaining
            // ----------------------------------------------------

            if (state.remaining <= 0) {

                movementElement.style.fontWeight =
                    "bold";

                movementElement.style.color =
                    "#ff6666";

            } else {

                movementElement.style.fontWeight =
                    "normal";

                movementElement.style.color =
                    "white";

            }

        }


        // ========================================================
        // SHOW NO MOVEMENT WARNING
        // ========================================================

        showNoMovementWarning(actor) {

            const name =
                actor?.name ?? "This character";

            ui.notifications.warn(
                `${name} has no movement remaining!`
            );

        }


        // ========================================================
        // TEST
        // ========================================================

        test() {

            this.create();

            const actor =
                canvas.tokens.controlled[0]?.actor;

            if (!actor) {

                console.warn(
                    "[AEC UI] Select a token first."
                );

                return;

            }

            this.updateMovement(actor);

            console.log(
                "%c[AEC UI] TEST COMPLETE",
                "color: lime; font-weight: bold;"
            );

        }

    }


    // ============================================================
    // CREATE GLOBAL UI OBJECT
    // ============================================================

    globalThis.aecTrackerUI =
        new TrackerUI();


    console.log(
        "%c[AEC UI] READY",
        "color: lime; font-weight: bold;"
    );

}
