// ============================================================
// ACTION ECONOMY CONTROLLER
// GRAPPLE SYSTEM
//
// Foundry VTT 13
// D&D 5e 5.3.3
// Monk's TokenBar
// socketlib
//
// VERSION 1.0.0
//
// CURRENT SCOPE:
//   - Start grapple
//   - Athletics vs Athletics/Acrobatics
//   - Player + GM support
//   - Apply Grappled condition on success
//   - Track grappler/grappled relationship
//
// NOT YET IMPLEMENTED:
//   - Grappler dragging target
//   - Escape-on-Action prompt
//   - Escape contest
//   - Forced movement breaking grapple
//   - Teleport breaking grapple
// ============================================================

const AEC_GRAPPLE = {

    MODULE_ID: "action-economy-controller",

    CONDITION_ID: "grappled",

    SOCKET_NAME: "action-economy-controller-grapple",

    CONTEST_FLAG: "action-economy-controller.grapple",

    // ------------------------------------------------------------
    // Runtime state
    // ------------------------------------------------------------

    grapplers: new Map(),

    grappledBy: new Map(),

    pendingContests: new Map(),

    socket: null,

    initialized: false,

    // ------------------------------------------------------------
    // Logging
    // ------------------------------------------------------------

    log(...args) {
        console.log(
            "%c[AEC GRAPPLE]",
            "color:#9b59b6;font-weight:bold;",
            ...args
        );
    },

    warn(...args) {
        console.warn(
            "%c[AEC GRAPPLE]",
            "color:#e67e22;font-weight:bold;",
            ...args
        );
    },

    error(...args) {
        console.error(
            "%c[AEC GRAPPLE]",
            "color:#e74c3c;font-weight:bold;",
            ...args
        );
    },

    // ------------------------------------------------------------
    // Initialization
    // ------------------------------------------------------------

    init() {

        if (this.initialized) return;

        this.initialized = true;

        this.log("Initializing new Grapple system...");

        this.registerSocket();

        Hooks.on(
            "dnd5e.postUseActivity",
            (activity, config, usageConfig, results) => {
                this.handlePostUseActivity(
                    activity,
                    config,
                    usageConfig,
                    results
                );
            }
        );

        Hooks.on(
            "monks-tokenbar.updateContested",
            (result, message) => {
                this.handleContestResult(result, message);
            }
        );

        Hooks.on(
            "deleteActor",
            actor => {
                this.cleanupActor(actor);
            }
        );

        this.log("Grapple system initialized.");
    },

    // ------------------------------------------------------------
    // Socketlib
    // ------------------------------------------------------------

    registerSocket() {

        if (!game.modules.get("socketlib")?.active) {

            this.warn(
                "socketlib is not active. Player-created grapple requests may be limited."
            );

            return;
        }

        try {

            this.socket = socketlib.registerModule(
                this.MODULE_ID
            );

            this.socket.register(
                "createContestedRoll",
                async data => {

                    if (!game.user.isGM) {
                        return {
                            success: false,
                            error: "Only a GM may execute the socket relay."
                        };
                    }

                    return await this.createContestedRoll(
                        data
                    );
                }
            );

            this.socket.register(
                "applyGrappled",
                async data => {

                    if (!game.user.isGM) {
                        return {
                            success: false,
                            error: "Only a GM may execute the socket relay."
                        };
                    }

                    return await this.applyGrappledByUuid(
                        data
                    );
                }
            );

            this.socket.register(
                "removeGrappled",
                async data => {

                    if (!game.user.isGM) {
                        return {
                            success: false,
                            error: "Only a GM may execute the socket relay."
                        };
                    }

                    return await this.removeGrappledByUuid(
                        data
                    );
                }
            );

            this.log("socketlib registered.");

        } catch (err) {

            this.error(
                "Failed to register socketlib:",
                err
            );
        }
    },

    // ------------------------------------------------------------
    // Detect Grapple activity
    // ------------------------------------------------------------

    isGrappleActivity(activity) {

        if (!activity) return false;

        const item = activity.item;

        if (!item) return false;

        const names = [

            item.name,

            item.system?.identifier,

            item.identifier,

            activity.name,

            activity.identifier

        ]
            .filter(Boolean)
            .map(v => String(v).toLowerCase());

        return names.some(name =>
            name.includes("grapple")
        );
    },

    // ------------------------------------------------------------
    // Activity hook
    // ------------------------------------------------------------

    async handlePostUseActivity(
        activity,
        config,
        usageConfig,
        results
    ) {

        try {

            if (!this.isGrappleActivity(activity)) {
                return;
            }

            const actor = activity.actor;

            if (!actor) {
                return;
            }

            const token = actor.getActiveTokens()?.[0];

            if (!token) {
                ui.notifications.warn(
                    "Grapple requires an active token."
                );

                return;
            }

            this.log(
                "Grapple activity detected:",
                activity.item?.name,
                actor.name
            );

            const target = this.getGrappleTarget(
                activity,
                config,
                usageConfig,
                results
            );

            if (!target) {

                ui.notifications.warn(
                    "Select one creature to grapple."
                );

                return;
            }

            if (!target.actor) {

                ui.notifications.warn(
                    "The selected target does not have an actor."
                );

                return;
            }

            if (target.actor.uuid === actor.uuid) {

                ui.notifications.warn(
                    "You cannot grapple yourself."
                );

                return;
            }

            // ----------------------------------------------------
            // Combat requirement
            // ----------------------------------------------------

            if (!game.combat) {

                ui.notifications.warn(
                    "Grapple can only be used during combat."
                );

                return;
            }

            // ----------------------------------------------------
            // Current combatant requirement
            // ----------------------------------------------------

            if (
                game.combat.current?.tokenId &&
                game.combat.current.tokenId !== token.id
            ) {

                ui.notifications.warn(
                    "You can only grapple during your turn."
                );

                return;
            }

            // ----------------------------------------------------
            // Size restriction
            // ----------------------------------------------------

            if (
                !this.canGrappleSize(
                    actor,
                    target.actor
                )
            ) {

                ui.notifications.warn(
                    `${target.name} is too large to grapple.`
                );

                return;
            }

            // ----------------------------------------------------
            // Already grappling someone
            // ----------------------------------------------------

            if (this.grapplers.has(actor.id)) {

                ui.notifications.warn(
                    `${actor.name} is already grappling someone.`
                );

                return;
            }

            // ----------------------------------------------------
            // Target already grappled by this actor
            // ----------------------------------------------------

            if (
                this.grappledBy.get(target.actor.id) === actor.id
            ) {

                ui.notifications.warn(
                    `${target.name} is already grappled by ${actor.name}.`
                );

                return;
            }

            // ----------------------------------------------------
            // Start contest
            // ----------------------------------------------------

            await this.startGrappleContest(
                token,
                target
            );

        } catch (err) {

            this.error(
                "Error handling grapple activity:",
                err
            );

            console.error(err);
        }
    },

    // ------------------------------------------------------------
    // Find target
    // ------------------------------------------------------------

    getGrappleTarget(
        activity,
        config,
        usageConfig,
        results
    ) {

        const candidates = [];

        // --------------------------------------------------------
        // Midi-QOL workflow targets
        // --------------------------------------------------------

        try {

            const workflow =
                config?.workflow ??
                usageConfig?.workflow ??
                results?.workflow ??
                activity?.workflow;

            if (workflow?.targets) {

                for (const target of workflow.targets) {
                    candidates.push(target);
                }
            }

        } catch (err) {
            this.warn(
                "Could not read workflow targets:",
                err
            );
        }

        // --------------------------------------------------------
        // Usage config targets
        // --------------------------------------------------------

        const usageTargets =
            usageConfig?.targets ??
            config?.targets ??
            activity?.targets;

        if (usageTargets) {

            if (usageTargets instanceof Set) {

                for (const target of usageTargets) {
                    candidates.push(target);
                }

            } else if (Array.isArray(usageTargets)) {

                candidates.push(
                    ...usageTargets
                );

            } else if (
                typeof usageTargets === "object"
            ) {

                for (const target of Object.values(
                    usageTargets
                )) {

                    candidates.push(target);
                }
            }
        }

        // --------------------------------------------------------
        // Foundry user targets
        // --------------------------------------------------------

        try {

            for (const target of game.user.targets) {
                candidates.push(target);
            }

        } catch (err) {
            // Ignore.
        }

        // --------------------------------------------------------
        // Controlled target fallback
        // --------------------------------------------------------

        if (
            candidates.length === 0 &&
            canvas.tokens?.controlled?.length === 1
        ) {

            const controlled =
                canvas.tokens.controlled[0];

            if (
                controlled &&
                controlled.actor &&
                controlled !==
                    this.getActorToken(
                        activity.actor
                    )
            ) {

                candidates.push(
                    controlled
                );
            }
        }

        // --------------------------------------------------------
        // Normalize tokens
        // --------------------------------------------------------

        const tokens = [];

        for (const candidate of candidates) {

            if (!candidate) continue;

            let token = candidate;

            if (
                candidate.object &&
                candidate.object.actor
            ) {
                token = candidate.object;
            }

            if (
                candidate.documentName === "Token"
            ) {
                token = candidate.object ?? candidate;
            }

            if (
                token?.actor &&
                !tokens.some(
                    t => t.id === token.id
                )
            ) {

                tokens.push(token);
            }
        }

        if (tokens.length !== 1) {

            if (tokens.length > 1) {

                ui.notifications.warn(
                    "Grapple requires exactly one target."
                );
            }

            return null;
        }

        return tokens[0];
    },

    // ------------------------------------------------------------
    // Get actor's token
    // ------------------------------------------------------------

    getActorToken(actor) {

        if (!actor) return null;

        const active =
            actor.getActiveTokens?.() ?? [];

        return active[0] ?? null;
    },

    // ------------------------------------------------------------
    // Size check
    //
    // Target can be no more than one size category larger.
    // ------------------------------------------------------------

    canGrappleSize(
        grappler,
        target
    ) {

        const grapplerSize =
            this.getSizeRank(
                grappler
            );

        const targetSize =
            this.getSizeRank(
                target
            );

        if (
            grapplerSize === null ||
            targetSize === null
        ) {

            return true;
        }

        return targetSize <= grapplerSize + 1;
    },

    getSizeRank(actor) {

        const size =
            actor?.system?.traits?.size ??
            actor?.system?.details?.size ??
            actor?.system?.traits?.size?.value;

        if (!size) return null;

        const sizes = {

            tiny: 0,

            sm: 1,
            small: 1,

            med: 2,
            medium: 2,

            lg: 3,
            large: 3,

            huge: 4,

            grg: 5,
            gargantuan: 5
        };

        const normalized =
            String(size).toLowerCase();

        return sizes[normalized] ?? null;
    },

    // ------------------------------------------------------------
    // Start grapple contest
    // ------------------------------------------------------------

    async startGrappleContest(
        grapplerToken,
        defenderToken
    ) {

        const contestId =
            foundry.utils.randomID(16);

        const grapplerActor =
            grapplerToken.actor;

        const defenderActor =
            defenderToken.actor;

        const requestData = {

            contestId,

            grapplerTokenUuid:
                grapplerToken.document?.uuid ??
                grapplerToken.uuid,

            defenderTokenUuid:
                defenderToken.document?.uuid ??
                defenderToken.uuid,

            grapplerActorUuid:
                grapplerActor.uuid,

            defenderActorUuid:
                defenderActor.uuid,

            flavor:
                `${grapplerActor.name} attempts to grapple ${defenderActor.name}.`
        };

        this.pendingContests.set(
            contestId,
            requestData
        );

        this.log(
            "Starting grapple contest:",
            requestData
        );

        let response = null;

        // --------------------------------------------------------
        // If current user is GM, create directly.
        // --------------------------------------------------------

        if (game.user.isGM) {

            response =
                await this.createContestedRoll(
                    requestData
                );

        }

        // --------------------------------------------------------
        // Otherwise ask a GM to create it.
        // --------------------------------------------------------

        else if (this.socket) {

            try {

                response =
                    await this.socket.executeAsGM(
                        "createContestedRoll",
                        requestData
                    );

            } catch (err) {

                this.error(
                    "Socketlib could not contact a GM:",
                    err
                );

                ui.notifications.error(
                    "Could not start the grapple contest. Make sure a GM is connected."
                );

                this.pendingContests.delete(
                    contestId
                );

                return;
            }

        } else {

            ui.notifications.error(
                "Grapple requires socketlib when used by a player."
            );

            this.pendingContests.delete(
                contestId
            );

            return;
        }

        if (!response?.success) {

            this.error(
                "Failed to create grapple contest:",
                response
            );

            this.pendingContests.delete(
                contestId
            );

            return;
        }

        this.log(
            "Grapple contest created:",
            contestId
        );
    },

    // ------------------------------------------------------------
    // Create Monk's TokenBar contest
    // ------------------------------------------------------------

    async createContestedRoll(
        data
    ) {

        if (!game.user.isGM) {

            return {
                success: false,
                error: "Only a GM can create the relay contest."
            };
        }

        if (
            !game.modules.get(
                "monks-tokenbar"
            )?.active
        ) {

            ui.notifications.error(
                "Monk's TokenBar is required for Grapple."
            );

            return {
                success: false,
                error: "Monk's TokenBar is not active."
            };
        }

        try {

            const grapplerToken =
                await fromUuid(
                    data.grapplerTokenUuid
                );

            const defenderToken =
                await fromUuid(
                    data.defenderTokenUuid
                );

            if (!grapplerToken?.actor) {

                return {
                    success: false,
                    error: "Could not find grappler."
                };
            }

            if (!defenderToken?.actor) {

                return {
                    success: false,
                    error: "Could not find defender."
                };
            }

            // ----------------------------------------------------
            // Monk's TokenBar accepts a request object for each
            // participant.
            //
            // Grappler:
            //     Athletics
            //
            // Defender:
            //     Athletics OR Acrobatics
            //
            // The second side is intentionally passed as an array.
            // Monk's TokenBar supports multiple requested options.
            // ----------------------------------------------------

            const grapplerRequest = {

                token: grapplerToken,

                request: {
                    type: "skill",
                    key: "ath"
                }

            };

            const defenderRequest = {

                token: defenderToken,

                request: [
                    {
                        type: "skill",
                        key: "ath"
                    },
                    {
                        type: "skill",
                        key: "acr"
                    }
                ]

            };

            const flavor =
                `${data.flavor}
                
Grappler: Athletics
Defender: Athletics or Acrobatics`;

            await game.MonksTokenBar.requestContestedRoll(
                grapplerRequest,
                defenderRequest,
                {
                    rollMode: "roll",

                    flavor,

                    hidenpcname: false,

                    // Store our identifier in the TokenBar
                    // message flags/options.
                    [this.CONTEST_FLAG]: {
                        contestId: data.contestId,
                        type: "grapple",
                        grapplerActorUuid:
                            data.grapplerActorUuid,
                        defenderActorUuid:
                            data.defenderActorUuid
                    }
                }
            );

            return {
                success: true,
                contestId: data.contestId
            };

        } catch (err) {

            this.error(
                "Failed to create Monk's TokenBar contest:",
                err
            );

            return {
                success: false,
                error: err?.message ??
                    String(err)
            };
        }
    },

    // ------------------------------------------------------------
    // Contest result
    // ------------------------------------------------------------

    async handleContestResult(
        result,
        message
    ) {

        try {

            if (!message) return;

            const flags =
                message.getFlag(
                    "monks-tokenbar",
                    "options"
                );

            // ----------------------------------------------------
            // We intentionally also inspect the top-level TokenBar
            // flags because different TokenBar versions serialize
            // options differently.
            // ----------------------------------------------------

            const contestData =
                flags?.[this.CONTEST_FLAG] ??
                message.getFlag(
                    "monks-tokenbar",
                    this.CONTEST_FLAG
                );

            if (
                !contestData ||
                contestData.type !== "grapple"
            ) {

                return;
            }

            const contestId =
                contestData.contestId;

            if (!contestId) return;

            this.log(
                "Received grapple contest result:",
                contestId,
                result
            );

            const tokenResults =
                result?.tokenresults ?? [];

            if (tokenResults.length < 2) {

                this.warn(
                    "Grapple contest completed without two results."
                );

                return;
            }

            const grapplerResult =
                tokenResults.find(
                    entry =>
                        entry.actor?.uuid ===
                        contestData.grapplerActorUuid
                ) ??
                tokenResults.find(
                    entry =>
                        entry.uuid ===
                        contestData.grapplerTokenUuid
                );

            const defenderResult =
                tokenResults.find(
                    entry =>
                        entry.actor?.uuid ===
                        contestData.defenderActorUuid
                ) ??
                tokenResults.find(
                    entry =>
                        entry.uuid ===
                        contestData.defenderTokenUuid
                );

            if (
                !grapplerResult ||
                !defenderResult
            ) {

                this.warn(
                    "Could not identify both grapple participants."
                );

                return;
            }

            const grapplerTotal =
                this.getContestTotal(
                    grapplerResult
                );

            const defenderTotal =
                this.getContestTotal(
                    defenderResult
                );

            if (
                grapplerTotal === null ||
                defenderTotal === null
            ) {

                this.warn(
                    "Could not determine grapple contest totals."
                );

                return;
            }

            this.log(
                "Grapple results:",
                {
                    grappler:
                        grapplerTotal,

                    defender:
                        defenderTotal
                }
            );

            // ----------------------------------------------------
            // D&D 5e grapple:
            //
            // Grappler must roll HIGHER.
            //
            // Tie = defender wins.
            // ----------------------------------------------------

            const success =
                grapplerTotal >
                defenderTotal;

            const grapplerActor =
                await fromUuid(
                    contestData.grapplerActorUuid
                );

            const defenderActor =
                await fromUuid(
                    contestData.defenderActorUuid
                );

            if (
                !grapplerActor ||
                !defenderActor
            ) {

                this.warn(
                    "Could not resolve grapple actors."
                );

                return;
            }

            if (success) {

                this.log(
                    `${grapplerActor.name} successfully grappled ${defenderActor.name}.`
                );

                await this.applyGrapple(
                    grapplerActor,
                    defenderActor
                );

                ui.notifications.info(
                    `${grapplerActor.name} successfully grappled ${defenderActor.name}!`
                );

            } else {

                this.log(
                    `${grapplerActor.name} failed to grapple ${defenderActor.name}.`
                );

                ui.notifications.info(
                    `${defenderActor.name} resisted the grapple.`
                );
            }

            this.pendingContests.delete(
                contestId
            );

        } catch (err) {

            this.error(
                "Error processing grapple contest:",
                err
            );

            console.error(err);
        }
    },

    // ------------------------------------------------------------
    // Get TokenBar result total
    // ------------------------------------------------------------

    getContestTotal(entry) {

        if (!entry) return null;

        if (
            typeof entry.roll?.total === "number"
        ) {

            return entry.roll.total;
        }

        if (
            typeof entry.total === "number"
        ) {

            return entry.total;
        }

        return null;
    },

    // ------------------------------------------------------------
    // Apply grapple
    // ------------------------------------------------------------

    async applyGrapple(
        grapplerActor,
        defenderActor
    ) {

        if (!grapplerActor || !defenderActor) {
            return;
        }

        // --------------------------------------------------------
        // Remove an existing relationship if the defender was
        // already grappled by somebody else.
        // --------------------------------------------------------

        const oldGrapplerId =
            this.grappledBy.get(
                defenderActor.id
            );

        if (
            oldGrapplerId &&
            oldGrapplerId !== grapplerActor.id
        ) {

            this.grapplers.delete(
                oldGrapplerId
            );
        }

        this.grapplers.set(
            grapplerActor.id,
            defenderActor.id
        );

        this.grappledBy.set(
            defenderActor.id,
            grapplerActor.id
        );

        // --------------------------------------------------------
        // Apply actual D&D 5e Grappled condition.
        //
        // Do this on the actor that owns the condition.
        // --------------------------------------------------------

        await this.applyGrappledCondition(
            defenderActor
        );

        this.broadcastRelationship(
            grapplerActor,
            defenderActor
        );

        this.log(
            "Grapple relationship established:",
            grapplerActor.name,
            "->",
            defenderActor.name
        );
    },

    // ------------------------------------------------------------
    // Apply condition
    // ------------------------------------------------------------

    async applyGrappledCondition(
        actor
    ) {

        if (!actor) return;

        try {

            // ----------------------------------------------------
            // D&D 5e 5.x status effects.
            // ----------------------------------------------------

            if (
                typeof actor.toggleStatusEffect ===
                "function"
            ) {

                await actor.toggleStatusEffect(
                    this.CONDITION_ID,
                    {
                        active: true
                    }
                );

                return;
            }

        } catch (err) {

            this.warn(
                "toggleStatusEffect failed:",
                err
            );
        }

        // --------------------------------------------------------
        // Fallback: find the built-in Grappled effect.
        // --------------------------------------------------------

        const effects =
            actor.effects?.contents ?? [];

        const existing =
            effects.find(effect => {

                const statuses =
                    effect.statuses;

                return statuses?.has?.(
                    this.CONDITION_ID
                );
            });

        if (existing) {
            return;
        }

        try {

            await actor.createEmbeddedDocuments(
                "ActiveEffect",
                [
                    {
                        name: "Grappled",
                        icon:
                            "icons/svg/net.svg",
                        statuses: [
                            this.CONDITION_ID
                        ]
                    }
                ]
            );

        } catch (err) {

            this.error(
                "Could not create Grappled effect:",
                err
            );
        }
    },

    // ------------------------------------------------------------
    // Remove condition
    // ------------------------------------------------------------

    async removeGrappledCondition(
        actor
    ) {

        if (!actor) return;

        try {

            if (
                typeof actor.toggleStatusEffect ===
                "function"
            ) {

                await actor.toggleStatusEffect(
                    this.CONDITION_ID,
                    {
                        active: false
                    }
                );

                return;
            }

        } catch (err) {

            this.warn(
                "Could not toggle Grappled off:",
                err
            );
        }

        const effects =
            actor.effects?.contents ?? [];

        const removable =
            effects.filter(effect => {

                const statuses =
                    effect.statuses;

                return statuses?.has?.(
                    this.CONDITION_ID
                );
            });

        if (!removable.length) {
            return;
        }

        await actor.deleteEmbeddedDocuments(
            "ActiveEffect",
            removable.map(
                effect => effect.id
            )
        );
    },

    // ------------------------------------------------------------
    // Socket condition application
    // ------------------------------------------------------------

    async applyGrappledByUuid(
        data
    ) {

        const actor =
            await fromUuid(
                data.actorUuid
            );

        if (!actor) {

            return {
                success: false,
                error: "Actor not found."
            };
        }

        await this.applyGrappledCondition(
            actor
        );

        return {
            success: true
        };
    },

    async removeGrappledByUuid(
        data
    ) {

        const actor =
            await fromUuid(
                data.actorUuid
            );

        if (!actor) {

            return {
                success: false,
                error: "Actor not found."
            };
        }

        await this.removeGrappledCondition(
            actor
        );

        return {
            success: true
        };
    },

    // ------------------------------------------------------------
    // Relationship synchronization
    // ------------------------------------------------------------

    broadcastRelationship(
        grapplerActor,
        defenderActor
    ) {

        // The actor documents are world documents, so the
        // relationship can be rebuilt locally from the UUIDs.
        //
        // For now we also store it in flags so the relationship
        // survives page refreshes.
        //
        // This will be expanded when movement/escape is added.

        try {

            grapplerActor.setFlag(
                this.MODULE_ID,
                "grapplingTarget",
                defenderActor.uuid
            );

            defenderActor.setFlag(
                this.MODULE_ID,
                "grappledBy",
                grapplerActor.uuid
            );

        } catch (err) {

            this.warn(
                "Could not persist grapple relationship:",
                err
            );
        }
    },

    // ------------------------------------------------------------
    // Cleanup
    // ------------------------------------------------------------

    cleanupActor(
        actor
    ) {

        if (!actor) return;

        const actorId =
            actor.id;

        const targetId =
            this.grapplers.get(
                actorId
            );

        if (targetId) {

            this.grapplers.delete(
                actorId
            );

            this.grappledBy.delete(
                targetId
            );
        }

        const grapplerId =
            this.grappledBy.get(
                actorId
            );

        if (grapplerId) {

            this.grappledBy.delete(
                actorId
            );

            this.grapplers.delete(
                grapplerId
            );
        }
    },

    // ------------------------------------------------------------
    // Restore relationships
    //
    // Called after world/scene becomes ready.
    // ------------------------------------------------------------

    async restoreRelationships() {

        this.grapplers.clear();
        this.grappledBy.clear();

        for (const actor of game.actors) {

            const targetUuid =
                actor.getFlag(
                    this.MODULE_ID,
                    "grapplingTarget"
                );

            if (!targetUuid) continue;

            const target =
                await fromUuid(
                    targetUuid
                );

            if (!target) continue;

            this.grapplers.set(
                actor.id,
                target.id
            );

            this.grappledBy.set(
                target.id,
                actor.id
            );
        }

        this.log(
            "Restored grapple relationships:",
            this.grapplers
        );
    }
};

// ============================================================
// Foundry initialization
// ============================================================

Hooks.once(
    "ready",
    async () => {

        AEC_GRAPPLE.init();

        await AEC_GRAPPLE.restoreRelationships();

        // --------------------------------------------------------
        // Public API
        // --------------------------------------------------------

        globalThis.AEC_GRAPPLE =
            AEC_GRAPPLE;

        console.log(
            "%c[AEC GRAPPLE] READY",
            "color:#9b59b6;font-weight:bold;"
        );
    }
);
