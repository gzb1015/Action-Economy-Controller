// tracker-ui.js
// Action Economy Tracker UI
// Foundry VTT v13 / D&D 5e 5.3.3
//
// Responsibilities:
//   - Display movement/action/bonus action/reaction resources
//   - Display "NO MORE MOVEMENT" when movement is exhausted
//   - Keep BG3 HUD action indicators visible during combat only
//
// Does NOT handle movement calculation or movement restriction.
// Those systems remain in their own files.

(() => {
  "use strict";

  const UI_ID = "aec-tracker-ui";
  const STYLE_ID = "aec-tracker-styles";
  const COMBAT_CLASS = "aec-in-combat";


  // ============================================================
  // CREATE UI
  // ============================================================

  function createTrackerUI() {

    if (document.getElementById(UI_ID)) return;

    const ui = document.createElement("div");

    ui.id = UI_ID;

    ui.innerHTML = `
      <div class="aec-tracker-header">
        Action Economy
      </div>

      <div class="aec-tracker-row">
        <span>Movement</span>
        <span id="aec-movement-value">0 / 30 ft</span>
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

      <div id="aec-warning">
        NO MORE MOVEMENT
      </div>
    `;


    Object.assign(ui.style, {
      position: "fixed",
      top: "20px",
      right: "20px",
      zIndex: "1000",
      minWidth: "190px",
      padding: "10px 12px",
      background: "rgba(20, 20, 20, 0.9)",
      border: "1px solid rgba(255, 255, 255, 0.25)",
      borderRadius: "8px",
      color: "white",
      fontFamily: "Signika, sans-serif",
      fontSize: "14px",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)"
    });


    document.body.appendChild(ui);

    injectStyles();

    console.log("[AEC UI] Tracker UI created.");
  }


  // ============================================================
  // CSS
  // ============================================================

  function injectStyles() {

    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");

    style.id = STYLE_ID;

    style.textContent = `

      /* --------------------------------------------------------
         ACTION ECONOMY TRACKER
         -------------------------------------------------------- */

      #aec-tracker-ui {
        user-select: none;
        pointer-events: none;
      }


      #aec-tracker-ui .aec-tracker-header {
        font-weight: bold;
        font-size: 16px;
        margin-bottom: 8px;
        text-align: center;
        border-bottom: 1px solid rgba(255,255,255,0.2);
        padding-bottom: 5px;
      }


      #aec-tracker-ui .aec-tracker-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin: 5px 0;
      }


      #aec-tracker-ui .aec-tracker-row span:last-child {
        font-weight: bold;
      }


      #aec-movement-value {
        color: rgb(102, 255, 102);
      }


      #aec-warning {
        display: none;
        margin-top: 8px;
        padding-top: 7px;
        border-top: 1px solid rgba(255,255,255,0.2);
        color: rgb(255, 90, 90);
        font-weight: bold;
        text-align: center;
      }


      /* --------------------------------------------------------
         BG3 HUD COMBAT VISIBILITY
         
         BG3 normally fades the action filter container when the
         HUD isn't being hovered.
         
         During combat, keep the Action / Bonus Action /
         Feature indicators permanently visible.
         -------------------------------------------------------- */

      body.${COMBAT_CLASS} .bg3-filter-container {
        opacity: 1 !important;
        visibility: visible !important;
      }

    `;


    document.head.appendChild(style);

    console.log("[AEC UI] Styles injected.");
  }


  // ============================================================
  // MOVEMENT DISPLAY
  // ============================================================

  function updateMovement(current, maximum) {

    const value = document.getElementById("aec-movement-value");
    const warning = document.getElementById("aec-warning");

    if (!value) return;


    current = Number(current) || 0;
    maximum = Number(maximum) || 0;


    value.textContent = `${current} / ${maximum} ft`;


    if (current >= maximum) {

      value.style.color = "rgb(255, 102, 102)";

      if (warning) {
        warning.style.display = "block";
      }

    } else {

      value.style.color = "rgb(102, 255, 102)";

      if (warning) {
        warning.style.display = "none";
      }
    }
  }


  // ============================================================
  // ACTION DISPLAY
  // ============================================================

  function updateAction(available) {

    const element =
      document.getElementById("aec-action-value");

    if (!element) return;


    element.textContent = available ? "●" : "○";

    element.style.color = available
      ? "rgb(102, 255, 102)"
      : "rgb(255, 102, 102)";
  }


  // ============================================================
  // BONUS ACTION DISPLAY
  // ============================================================

  function updateBonusAction(available) {

    const element =
      document.getElementById("aec-bonus-value");

    if (!element) return;


    element.textContent = available ? "●" : "○";

    element.style.color = available
      ? "rgb(102, 255, 102)"
      : "rgb(255, 102, 102)";
  }


  // ============================================================
  // REACTION DISPLAY
  // ============================================================

  function updateReaction(available) {

    const element =
      document.getElementById("aec-reaction-value");

    if (!element) return;


    element.textContent = available ? "●" : "○";

    element.style.color = available
      ? "rgb(102, 255, 102)"
      : "rgb(255, 102, 102)";
  }


  // ============================================================
  // BG3 HUD COMBAT STATE
  // ============================================================

  function updateBG3CombatState() {

    const inCombat =
      game.combat?.started === true;


    if (inCombat) {

      if (!document.body.classList.contains(COMBAT_CLASS)) {

        document.body.classList.add(COMBAT_CLASS);

        console.log(
          "[AEC UI] BG3 action indicators locked visible."
        );
      }

    } else {

      if (document.body.classList.contains(COMBAT_CLASS)) {

        document.body.classList.remove(COMBAT_CLASS);

        console.log(
          "[AEC UI] BG3 action indicators returned to normal."
        );
      }
    }
  }


  // ============================================================
  // COMBAT HOOKS
  // ============================================================

  function registerCombatHooks() {


    // ----------------------------------------------------------
    // Combat starts
    // ----------------------------------------------------------

    Hooks.on("combatStart", () => {

      console.log("[AEC UI] Combat started.");

      updateBG3CombatState();
    });


    // ----------------------------------------------------------
    // Combat changes
    // ----------------------------------------------------------

    Hooks.on("updateCombat", () => {

      updateBG3CombatState();
    });


    // ----------------------------------------------------------
    // Combat deleted
    // ----------------------------------------------------------

    Hooks.on("deleteCombat", () => {

      console.log("[AEC UI] Combat ended.");

      updateBG3CombatState();
    });
  }


  // ============================================================
  // INITIALIZATION
  // ============================================================

  function initialize() {

    createTrackerUI();

    registerCombatHooks();

    updateBG3CombatState();

    console.log(
      "[AEC UI] Action Economy Tracker initialized."
    );
  }


  // ============================================================
  // PUBLIC API
  // ============================================================

  window.AECTrackerUI = {

    updateMovement,

    updateAction,

    updateBonusAction,

    updateReaction,

    refreshBG3: updateBG3CombatState

  };


  // ============================================================
  // FOUNDRY READY
  // ============================================================

  if (typeof Hooks !== "undefined") {

    Hooks.once("ready", initialize);

  } else {

    console.error(
      "[AEC UI] Foundry Hooks unavailable."
    );
  }

})();
