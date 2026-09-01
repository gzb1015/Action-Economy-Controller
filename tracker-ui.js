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
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;

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
  // BG3 HUD places the Action / Bonus Action / Feature buttons
  // inside .bg3-filter-container.
  //
  // The BG3 HUD itself fades portions of the interface when it
  // is not hovered.
  //
  // During combat we override ONLY the action indicator area.
  // Outside combat we remove every override so BG3 behaves
  // normally.
  // ------------------------------------------------------------

  function forceBG3CombatVisibility() {

    if (game.combat?.started !== true) return;

    const filter = document.querySelector(".bg3-filter-container");

    if (!filter) return;

    // Force the container itself visible.
    filter.style.setProperty("opacity", "1", "important");
    filter.style.setProperty("visibility", "visible", "important");
    filter.style.setProperty("display", "flex", "important");

    // Force the individual action buttons visible too.
    const buttons = filter.querySelectorAll(
      ".bg3-filter-button.action-type-button"
    );

    for (const button of buttons) {
      button.style.setProperty("opacity", "1", "important");
      button.style.setProperty("visibility", "visible", "important");
      button.style.setProperty("display", "flex", "important");
    }
  }


  // ------------------------------------------------------------
  // RESTORE BG3 HUD
  //
  // Remove ONLY the styles that this tracker added.
  // ------------------------------------------------------------

  function restoreBG3Visibility() {

    const filter = document.querySelector(".bg3-filter-container");

    if (!filter) return;

    filter.style.removeProperty("opacity");
    filter.style.removeProperty("visibility");
    filter.style.removeProperty("display");

    const buttons = filter.querySelectorAll(
      ".bg3-filter-button.action-type-button"
    );

    for (const button of buttons) {
      button.style.removeProperty("opacity");
      button.style.removeProperty("visibility");
      button.style.removeProperty("display");
    }
  }


  // ------------------------------------------------------------
  // APPLY CURRENT COMBAT STATE
  // ------------------------------------------------------------

  function updateBG3Visibility() {

    if (game.combat?.started === true) {
      forceBG3CombatVisibility();
    } else {
      restoreBG3Visibility();
    }
  }


  // ------------------------------------------------------------
  // BG3 HUD WATCHER
  //
  // BG3 can modify its HUD after combat starts or when the HUD
  // changes state.
  //
  // Rather than constantly writing styles on every mutation,
  // we schedule ONE visibility update.
  // ------------------------------------------------------------

  function startBG3Watcher() {

    if (window.__aecBG3Watcher) return;

    let scheduled = false;

    const scheduleUpdate = () => {

      if (scheduled) return;

      scheduled = true;

      requestAnimationFrame(() => {

        scheduled = false;

        if (game.combat?.started === true) {
          forceBG3CombatVisibility();
        }

      });
    };


    window.__aecBG3Watcher = new MutationObserver((mutations) => {

      if (game.combat?.started !== true) return;

      for (const mutation of mutations) {

        if (
          mutation.type === "childList" ||
          mutation.type === "attributes"
        ) {
          scheduleUpdate();
          break;
        }

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

    console.log("[AEC UI] BG3 HUD watcher started.");
  }


  // ------------------------------------------------------------
  // COMBAT HOOKS
  // ------------------------------------------------------------

  function registerCombatHooks() {

    // Combat begins.
    Hooks.on("combatStart", () => {

      console.log("[AEC UI] Combat started.");

      // BG3 may not have finished updating its HUD yet.
      setTimeout(updateBG3Visibility, 50);
      setTimeout(updateBG3Visibility, 150);
      setTimeout(updateBG3Visibility, 300);
      setTimeout(updateBG3Visibility, 600);
    });


    // Combat ends.
    Hooks.on("deleteCombat", () => {

      console.log("[AEC UI] Combat ended.");

      restoreBG3Visibility();
    });


    // Handles combat state changes.
    Hooks.on("updateCombat", () => {

      setTimeout(updateBG3Visibility, 50);
    });
  }


  // ------------------------------------------------------------
  // INITIALIZATION
  // ------------------------------------------------------------

  function initialize() {

    createTrackerUI();

    startBG3Watcher();

    registerCombatHooks();

    // Apply the current state immediately.
    updateBG3Visibility();

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
    refreshBG3: updateBG3Visibility
  };


  // ------------------------------------------------------------
  // FOUNDRY READY
  // ------------------------------------------------------------

  if (typeof Hooks !== "undefined") {

    Hooks.once("ready", initialize);

  } else {

    console.error("[AEC UI] Foundry Hooks unavailable.");

  }

})();
