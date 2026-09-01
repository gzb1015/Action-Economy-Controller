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

  // ------------------------------------------------------------
  // CREATE UI
  // ------------------------------------------------------------

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


  // ------------------------------------------------------------
  // CSS
  // ------------------------------------------------------------

  function injectStyles() {
    if (document.getElementById("aec-tracker-styles")) return;

    const style = document.createElement("style");
    style.id = "aec-tracker-styles";

    style.textContent = `
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
    `;

    document.head.appendChild(style);
  }


  // ------------------------------------------------------------
  // MOVEMENT DISPLAY
  // ------------------------------------------------------------

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


  // ------------------------------------------------------------
  // ACTION DISPLAY
  // ------------------------------------------------------------

  function updateAction(available) {
    const element = document.getElementById("aec-action-value");
    if (!element) return;

    element.textContent = available ? "●" : "○";
    element.style.color = available
      ? "rgb(102, 255, 102)"
      : "rgb(255, 102, 102)";
  }


  // ------------------------------------------------------------
  // BONUS ACTION DISPLAY
  // ------------------------------------------------------------

  function updateBonusAction(available) {
    const element = document.getElementById("aec-bonus-value");
    if (!element) return;

    element.textContent = available ? "●" : "○";
    element.style.color = available
      ? "rgb(102, 255, 102)"
      : "rgb(255, 102, 102)";
  }


  // ------------------------------------------------------------
  // REACTION DISPLAY
  // ------------------------------------------------------------

  function updateReaction(available) {
    const element = document.getElementById("aec-reaction-value");
    if (!element) return;

    element.textContent = available ? "●" : "○";
    element.style.color = available
      ? "rgb(102, 255, 102)"
      : "rgb(255, 102, 102)";
  }


  // ------------------------------------------------------------
  // BG3 HUD ACTION INDICATORS
  //
  // The actual BG3 Action / Bonus Action / Feature buttons live
  // inside .bg3-filter-container.
  //
  // The container is what fades when the HUD isn't hovered.
  //
  // We ONLY override it while combat is active.
  // ------------------------------------------------------------

  function setBG3CombatVisibility() {
    const filter = document.querySelector(".bg3-filter-container");

    if (!filter) return;

    const inCombat = game.combat?.started === true;

    if (inCombat) {
      filter.style.setProperty("opacity", "1", "important");
      filter.style.setProperty("visibility", "visible", "important");
      filter.style.setProperty("display", "flex", "important");

      console.log("[AEC UI] BG3 action indicators locked visible.");
    } else {
      filter.style.removeProperty("opacity");
      filter.style.removeProperty("visibility");
      filter.style.removeProperty("display");

      console.log("[AEC UI] BG3 action indicators returned to normal.");
    }
  }


  // ------------------------------------------------------------
  // BG3 HUD WATCHER
  //
  // BG3 HUD can rebuild its HTML. If that happens, reapply the
  // combat visibility setting automatically.
  // ------------------------------------------------------------

  function startBG3Watcher() {
    if (window.__aecBG3Watcher) return;

    window.__aecBG3Watcher = new MutationObserver(() => {
      if (game.combat?.started === true) {
        const filter = document.querySelector(".bg3-filter-container");

        if (filter) {
          filter.style.setProperty("opacity", "1", "important");
          filter.style.setProperty("visibility", "visible", "important");
          filter.style.setProperty("display", "flex", "important");
        }
      }
    });

    window.__aecBG3Watcher.observe(document.body, {
      childList: true,
      subtree: true
    });

    console.log("[AEC UI] BG3 HUD watcher started.");
  }


  // ------------------------------------------------------------
  // COMBAT HOOKS
  // ------------------------------------------------------------

  function registerCombatHooks() {

    Hooks.on("combatStart", () => {
      console.log("[AEC UI] Combat started.");
      setBG3CombatVisibility();

      // Give the BG3 HUD a moment to finish rendering.
      setTimeout(setBG3CombatVisibility, 100);
      setTimeout(setBG3CombatVisibility, 500);
    });


    Hooks.on("deleteCombat", () => {
      console.log("[AEC UI] Combat ended.");
      setBG3CombatVisibility();
    });


    Hooks.on("updateCombat", () => {
      setBG3CombatVisibility();
    });
  }


  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------

  function initialize() {
    createTrackerUI();
    startBG3Watcher();
    registerCombatHooks();

    // Apply current combat state immediately.
    setBG3CombatVisibility();

    console.log("[AEC UI] Action Economy Tracker initialized.");
  }


  // ------------------------------------------------------------
  // PUBLIC API
  //
  // Other tracker files can update the UI without needing to
  // know anything about the DOM.
  // ------------------------------------------------------------

  window.AECTrackerUI = {
    updateMovement,
    updateAction,
    updateBonusAction,
    updateReaction,
    refreshBG3: setBG3CombatVisibility
  };


  // ------------------------------------------------------------
  // FOUNDry READY
  // ------------------------------------------------------------

  if (typeof Hooks !== "undefined") {
    Hooks.once("ready", initialize);
  } else {
    console.error("[AEC UI] Foundry Hooks unavailable.");
  }

})();
