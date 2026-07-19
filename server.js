const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const QRCode = require("qrcode");
const crypto = require("crypto");

const { createLobby } = require("./game/lobby");
const { ITEMS, DEFAULT_PICKUP_SOUND, getClientItems } = require("./game/items");
const { ROOMS, getClientRooms } = require("./game/rooms");
const { CHARACTERS, getClientCharacters } = require("./game/characters");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// While this game is under active development, HTML/JS files should
// always be re-fetched fresh — otherwise updates on the server can
// look like they "didn't take" on a device that already visited
// before. Images and sounds are left to cache normally: those rarely
// change once added, and re-downloading a multi-MB room background or
// sound effect on every single visit (rather than once per browser)
// would actually be the thing that makes the game feel slow,
// especially over phone data.
app.use(express.static("public", {
    // 1 day for anything else (images, sounds, fonts) — long enough
    // that a player walking back into a room they've already visited
    // doesn't even need to ask the server "has this changed?", short
    // enough that swapping out an image/sound file mid-development
    // won't stay stuck for players for more than a day.
    maxAge: 24 * 60 * 60 * 1000,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith(".html") || filePath.endsWith(".js")) {
            // Deliberately "no-cache" and NOT "no-store": the browser
            // is still allowed to keep its own copy, but must always
            // ask the server first ("has this changed since I last
            // saw it?") before using it. If nothing changed, the
            // server replies with a tiny 304 and the browser reuses
            // what it already has — so this doesn't cost a full
            // re-download every time. This check only happens once
            // per player, when the page first loads (this game is a
            // single-page app — moving between rooms never re-fetches
            // the HTML), so in practice it means "the newest version,
            // fetched once per session" rather than "constantly
            // re-downloading during play".
            res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
    }
}));

app.get("/api/game-data", (req, res) => {
    res.json({
        rooms: getClientRooms(),
        characters: getClientCharacters(),
        items: getClientItems()
    });
});

const lobbies = {};

const tvSessions = new Map();
const tvDisconnectTimers = new Map();
const emptyLobbyTimers = new Map();
const playerDisconnectTimers = new Map();

const createLog = new Map();
const COOLDOWN_MS = 30 * 1000;
const MAX_CREATES = 5;
const CREATE_WINDOW_MS = 10 * 1000;

const TV_RECONNECT_GRACE_MS = 5 * 60 * 1000;
const PLAYER_RECONNECT_GRACE_MS = 5 * 60 * 1000;
const EMPTY_WAITING_LOBBY_MS = 5 * 60 * 1000;
const MAX_LOBBY_LIFETIME_MS = 5 * 60 * 60 * 1000;

// No one — not a player on their phone, not the TV's group-accuse
// button — can start an accusation vote until this long after
// lobby.gameStartedAt (set when enterMansion fires). On top of that,
// each individual player also has their own ACCUSATION_COOLDOWN_MS
// between accusations they personally start (see player.lastAccusationAt
// in startAccusation below); that second cooldown doesn't apply to the
// TV's group-accuse button, since that isn't tied to one player.
const ACCUSATION_UNLOCK_DELAY_MS = 60 * 1000;
const ACCUSATION_COOLDOWN_MS = 60 * 1000;

function isTooSoonToAccuse(lobby) {
    return !lobby.gameStartedAt || (Date.now() - lobby.gameStartedAt) < ACCUSATION_UNLOCK_DELAY_MS;
}

// Used only for the handful of character fields that are deliberately
// kept OUT of getClientCharacters() (knifeQuestion, safeQuestion,
// dismissiveLine, hintIntroLine, revealedQuestions, badEndingText,
// goodEndingText) — these are hand-delivered by the server at the
// exact moment they're unlocked, rather than sent to every client
// up front, to prevent reading spoilers via devtools/network tab.
// Everything else (name, introLine, the standard questions array) is
// already public and translated entirely client-side instead — see
// applyLanguage() in phone/index.html.
function pickLang(obj, field, language) {
    if (!obj) return obj;
    if (language === "hr" && obj[field + "Hr"] !== undefined) {
        return obj[field + "Hr"];
    }
    return obj[field];
}

function closeLobby(code, reason = "Lobby closed") {
    const lobby = lobbies[code];
    if (!lobby) return;

    io.to(code).emit("lobbyClosed", reason);

    if (tvDisconnectTimers.has(code)) {
        clearTimeout(tvDisconnectTimers.get(code));
        tvDisconnectTimers.delete(code);
    }

    if (emptyLobbyTimers.has(code)) {
        clearTimeout(emptyLobbyTimers.get(code));
        emptyLobbyTimers.delete(code);
    }

    lobby.players.forEach(player => {
        clearPlayerDisconnectTimer(code, player.token);
    });

    if (lobby.tvSessionId) {
        tvSessions.delete(lobby.tvSessionId);
    }

    delete lobbies[code];
}

function scheduleEmptyLobbyCleanup(lobby) {
    if (!lobby || lobby.status !== "waiting") return;

    if (emptyLobbyTimers.has(lobby.code)) {
        clearTimeout(emptyLobbyTimers.get(lobby.code));
        emptyLobbyTimers.delete(lobby.code);
    }

    if (lobby.players.length !== 0) return;

    const timer = setTimeout(() => {
        const currentLobby = lobbies[lobby.code];

        if (
            currentLobby &&
            currentLobby.status === "waiting" &&
            currentLobby.players.length === 0
        ) {
            closeLobby(lobby.code, "Lobby expired because it stayed empty.");
        }
    }, EMPTY_WAITING_LOBBY_MS);

    emptyLobbyTimers.set(lobby.code, timer);
}

function clearPlayerDisconnectTimer(code, playerToken) {
    const timerKey = `${code}:${playerToken}`;

    if (playerDisconnectTimers.has(timerKey)) {
        clearTimeout(playerDisconnectTimers.get(timerKey));
        playerDisconnectTimers.delete(timerKey);
    }
}

// Strips server-only secrets out of the lobby object before it's ever
// sent to a browser. safeCode is the important one here — without
// this, the safe combination would be readable in plain text by
// anyone inspecting WebSocket traffic in dev tools, which would
// bypass the safe puzzle entirely. Add any future "answer" fields
// here too, the same way game/characters.js keeps isMurderer etc. out
// of getClientCharacters().
function sanitizeLobbyForClient(lobby) {
    if (!lobby) return lobby;

    const { safeCode, ...clientSafeLobby } = lobby;
    return clientSafeLobby;
}

function sendLobbyUpdate(lobby) {
    if (!lobby) return;
    io.to(lobby.code).emit("lobbyUpdate", sanitizeLobbyForClient(lobby));
}

function sendPrivatePlayerUpdate(socket, lobby, playerToken) {
    const player = lobby.players.find(p => p.token === playerToken);
    if (!player) return;

    socket.emit("playerUpdate", {
        inventory: player.inventory || []
    });
}

function sendPrivateInventoryToPlayer(player) {
    if (!player?.socketId) return;

    io.to(player.socketId).emit("playerUpdate", {
        inventory: player.inventory || []
    });
}

// Small toast shown in the corner of the TV screen for notable player
// actions (picking up an item, unlocking a door/safe, etc). Broadcasts
// to the whole lobby room — the TV page listens for it and renders it;
// phones simply have no listener for this event, so it's harmless
// there.
function sendTvNotification(lobby, message) {
    if (!lobby) return;

    io.to(lobby.code).emit("tvNotification", {
        message,
        timestamp: Date.now()
    });
}

// Checks whether every currently-connected player has cast a vote in
// the active accusation, and if so, resolves it: tie (no ending —
// back to the game), or a plurality winner (game ends, good or bad
// depending on whether they picked the real murderer). Safe to call
// after every single vote; does nothing until voting is actually
// complete.
function checkAccusationComplete(lobby) {
    if (!lobby.accusation) return;

    const connectedTokens = lobby.players
        .filter(player => player.connected)
        .map(player => player.token);

    if (!connectedTokens.length) return;

    const allVoted = connectedTokens.every(
        token => Boolean(lobby.accusation.votes[token])
    );

    if (!allVoted) return;

    const tally = {};

    connectedTokens.forEach(token => {
        const choice = lobby.accusation.votes[token];
        tally[choice] = (tally[choice] || 0) + 1;
    });

    let topCharacterIds = [];
    let topCount = 0;

    Object.entries(tally).forEach(([characterId, count]) => {
        if (count > topCount) {
            topCount = count;
            topCharacterIds = [characterId];
        } else if (count === topCount) {
            topCharacterIds.push(characterId);
        }
    });

    lobby.accusation = null;

    if (topCharacterIds.length !== 1) {
        io.to(lobby.code).emit("accusationResult", { result: "tie" });
        sendLobbyUpdate(lobby);
        return;
    }

    const accusedId = topCharacterIds[0];
    const accusedCharacter = CHARACTERS[accusedId];
    const isCorrect = Boolean(accusedCharacter?.isMurderer);

    lobby.status = "ended";
    lobby.endingResult = isCorrect ? "good" : "bad";
    lobby.endingCharacterId = accusedId;

    // Persisted directly on the lobby (not just the transient event
    // below) so a player who reconnects — or joins late — after the
    // game has already ended still sees the correct ending via the
    // next joinSuccess/lobbyUpdate, which always includes the full
    // lobby object. This is only ever set once the mystery is already
    // resolved, so there's no "spoiler" concern in exposing it here,
    // unlike isMurderer/goodEndingText/badEndingText living in
    // game/characters.js, which stay hidden until this exact moment.
    // Always stored in English — see the per-player loop below for
    // where a Croatian player actually gets translated text.
    lobby.endingStoryText = isCorrect
        ? accusedCharacter?.goodEndingText
        : accusedCharacter?.badEndingText;

    lobby.endingBackgroundImage = isCorrect
        ? accusedCharacter?.goodEndingImage
        : accusedCharacter?.badEndingImage;

    // The ending narrative is exactly the kind of spoiler content kept
    // out of getClientCharacters() all game — so unlike most lobby
    // broadcasts, this one can't be a single io.to(code).emit() with
    // one shared payload. Each connected player gets their own
    // dedicated emit, personalized to their stored language; the TV
    // (which never sets a player language) always gets English.
    const englishPayload = {
        result: lobby.endingResult,
        characterName: accusedCharacter?.name || accusedId,
        storyText: lobby.endingStoryText,
        backgroundImage: lobby.endingBackgroundImage
    };

    io.to(lobby.hostSocketId).emit("accusationResult", englishPayload);

    lobby.players.forEach(p => {
        if (!p.connected || !p.socketId) return;

        const payload = p.language === "hr"
            ? {
                result: lobby.endingResult,
                characterName: pickLang(accusedCharacter, "name", "hr") || englishPayload.characterName,
                storyText: isCorrect
                    ? (accusedCharacter?.goodEndingTextHr || englishPayload.storyText)
                    : (accusedCharacter?.badEndingTextHr || englishPayload.storyText),
                backgroundImage: lobby.endingBackgroundImage
            }
            : englishPayload;

        io.to(p.socketId).emit("accusationResult", payload);
    });

    sendLobbyUpdate(lobby);
}

function findNextConnectedPlayer(lobby, playerToken) {
    const players = lobby.players || [];
    const startIndex = players.findIndex(player => player.token === playerToken);

    if (startIndex === -1 || players.length < 2) return null;

    for (let offset = 1; offset < players.length; offset++) {
        const candidate = players[(startIndex + offset) % players.length];

        if (
            candidate.token !== playerToken &&
            candidate.connected &&
            candidate.socketId
        ) {
            return candidate;
        }
    }

    return null;
}

function transferInventoryFromPlayer(lobby, playerToken) {
    if (!lobby) return;

    const player = lobby.players.find(p => p.token === playerToken);
    if (!player) return;

    const inventory = Array.isArray(player.inventory)
        ? player.inventory
        : [];

    if (inventory.length === 0) return;

    const recipient = findNextConnectedPlayer(lobby, playerToken);

    if (!recipient) {
        Object.values(lobby.items || {}).forEach(item => {
            if (item.takenBy === playerToken) {
                item.takenBy = null;
            }
        });

        player.inventory = [];
        sendPrivateInventoryToPlayer(player);
        return;
    }

    recipient.inventory = Array.isArray(recipient.inventory)
        ? recipient.inventory
        : [];

    inventory.forEach(item => {
        if (!recipient.inventory.some(existingItem => existingItem.id === item.id)) {
            recipient.inventory.push(item);
        }
    });

    Object.values(lobby.items || {}).forEach(item => {
        if (item.takenBy === playerToken) {
            item.takenBy = recipient.token;
        }
    });

    function sendPlayerMessage(player, message) {
    if (!player?.socketId) return;

    io.to(player.socketId).emit("gameMessage", message);
}

    player.inventory = [];

    sendPrivateInventoryToPlayer(player);
    sendPrivateInventoryToPlayer(recipient);
}

// A socket gets muted (its events silently dropped) if it sends more
// than this many messages within the window — a generous ceiling for
// legitimate rapid clicking, but enough to stop one spamming
// connection from flooding the server or everyone else's TV/phone
// notifications. See the socket.on wrapper below.
const SOCKET_RATE_LIMIT_MAX_EVENTS = 20;
const SOCKET_RATE_LIMIT_WINDOW_MS = 1000;

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    // Every socket gets its own counter (like each player having their
    // own walkie-talkie) — one noisy connection can't use up another
    // player's allowance. Wrapping socket.on here, before any handlers
    // are registered below, means every socket.on("eventName", ...)
    // call in this file is automatically covered without having to
    // edit each one individually.
    socket.data.rateLimitWindowStart = Date.now();
    socket.data.rateLimitCount = 0;

    const registerSocketHandler = socket.on.bind(socket);
    socket.on = (eventName, handler) => {
        // "disconnect" is Socket.io's own lifecycle event, not
        // attacker-controllable input — always let cleanup logic run,
        // even for a socket that's currently muted.
        if (eventName === "disconnect") {
            return registerSocketHandler(eventName, handler);
        }

        return registerSocketHandler(eventName, (...args) => {
            const now = Date.now();

            if (now - socket.data.rateLimitWindowStart >= SOCKET_RATE_LIMIT_WINDOW_MS) {
                socket.data.rateLimitWindowStart = now;
                socket.data.rateLimitCount = 0;
            }

            socket.data.rateLimitCount += 1;

            if (socket.data.rateLimitCount > SOCKET_RATE_LIMIT_MAX_EVENTS) {
                // Over the limit for this second — quietly drop the
                // event. No error sent back, since a flooding
                // connection doesn't deserve more traffic in response,
                // and a legitimate player who briefly double-clicks
                // something shouldn't see a scary error message.
                return;
            }

            handler(...args);
        });
    };

    socket.on("join", ({ type, tvSessionId }) => {
        socket.data.type = type;

        if (type !== "tv" || !tvSessionId) return;

        socket.data.tvSessionId = tvSessionId;

        const existingLobbyCode = tvSessions.get(tvSessionId);
        const existingLobby = lobbies[existingLobbyCode];

        if (!existingLobby) return;

        existingLobby.hostSocketId = socket.id;
        existingLobby.hostConnected = true;

        socket.data.activeLobbyCode = existingLobby.code;
        socket.join(existingLobby.code);

        if (tvDisconnectTimers.has(existingLobby.code)) {
            clearTimeout(tvDisconnectTimers.get(existingLobby.code));
            tvDisconnectTimers.delete(existingLobby.code);
        }

        socket.emit("lobbyCreated", sanitizeLobbyForClient(existingLobby));
        sendLobbyUpdate(existingLobby);
    });

    socket.on("createLobby", async () => {
        const now = Date.now();

        const oldTimes = createLog.get(socket.id) || [];
        const recentTimes = oldTimes.filter(t => now - t < CREATE_WINDOW_MS);

        if (socket.data.cooldownUntil && now < socket.data.cooldownUntil) {
            const secondsLeft = Math.ceil(
                (socket.data.cooldownUntil - now) / 1000
            );

            socket.emit(
                "lobbyError",
                `Too many lobbies created. Try again in ${secondsLeft} seconds.`
            );
            return;
        }

        recentTimes.push(now);
        createLog.set(socket.id, recentTimes);

        if (recentTimes.length > MAX_CREATES) {
            socket.data.cooldownUntil = now + COOLDOWN_MS;

            socket.emit(
                "lobbyError",
                "Too many lobbies created. Please wait 30 seconds."
            );
            return;
        }

        const tvSessionId = socket.data.tvSessionId;

        if (!tvSessionId) {
            socket.emit("lobbyError", "TV session was not initialized.");
            return;
        }

        const oldLobbyCode = tvSessions.get(tvSessionId);

        if (oldLobbyCode && lobbies[oldLobbyCode]) {
            socket.leave(oldLobbyCode);
            closeLobby(oldLobbyCode, "Replaced by new game.");
        }

        const lobby = createLobby();

        lobby.players = [];
        lobby.createdAt = now;
        lobby.status = "waiting";
        lobby.hostSocketId = socket.id;
        lobby.hostConnected = true;
        lobby.tvSessionId = tvSessionId;

        lobbies[lobby.code] = lobby;
        tvSessions.set(tvSessionId, lobby.code);

        socket.data.activeLobbyCode = lobby.code;
        socket.join(lobby.code);

        const host = socket.handshake.headers.host || "localhost:3000";
        const protocol = socket.handshake.secure ? "https" : "http";
        const joinLink = `${protocol}://${host}/phone/?code=${lobby.code}`;
        const qr = await QRCode.toDataURL(joinLink);

        socket.emit("lobbyCreated", {
            ...sanitizeLobbyForClient(lobby),
            qr
        });

        scheduleEmptyLobbyCleanup(lobby);

        setTimeout(() => {
            if (lobbies[lobby.code]) {
                closeLobby(lobby.code, "Expired after 5 hours.");
            }
        }, MAX_LOBBY_LIFETIME_MS);
    });

    socket.on("joinLobby", ({ code, name, playerToken, language }) => {
        const lobby = lobbies[code];

        if (!lobby) {
            socket.emit("joinError", "Lobby not found.");
            return;
        }

        const token = playerToken || crypto.randomUUID();
        const cleanName = (name || "Player").trim().slice(0, 10) || "Player";
        // Only "hr" is ever treated as non-English — anything else
        // (missing, unrecognized) safely defaults to English.
        const cleanLanguage = language === "hr" ? "hr" : "en";

        let player = lobby.players.find(p => p.token === token);

        if (!player) {
            if (lobby.players.length >= lobby.maxPlayers) {
                socket.emit("joinError", "Lobby is full.");
                return;
            }

            player = {
                token,
                name: cleanName,
                language: cleanLanguage,
                connected: true,
                socketId: socket.id,
                currentRoom: "lobby",
                inventory: [],
                // How many times this player has triggered the Son's
                // Bedroom cat hotspot — see clickCatHotspot below. This
                // is per-player (not shared), so it lives on the player
                // object rather than the lobby.
                catClicks: 0
            };

            lobby.players.push(player);
        } else {
            player.name = cleanName;
            player.language = cleanLanguage;
            player.connected = true;
            player.socketId = socket.id;

            if (!Array.isArray(player.inventory)) {
                player.inventory = [];
            }
        }

        socket.join(lobby.code);

        socket.data.lobbyCode = lobby.code;
        socket.data.playerToken = token;

        // Cancel any pending "give up inventory" timer from a previous
        // disconnect — they made it back within the grace window.
        clearPlayerDisconnectTimer(lobby.code, token);

        socket.emit("joinSuccess", {
            ...sanitizeLobbyForClient(lobby),
            playerToken: token
        });

        sendPrivatePlayerUpdate(socket, lobby, token);
        sendLobbyUpdate(lobby);
    });

    socket.on("movePlayer", ({ code, playerToken, room }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const roomConfig = ROOMS[room];
        if (!roomConfig) return;

        if (roomConfig.requiresFlag && !lobby[roomConfig.requiresFlag]) {
            socket.emit("moveError", `The ${roomConfig.label} is still locked.`);
            return;
        }

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player) return;

        if (player.socketId !== socket.id) return;

        if (roomConfig.requiresItem) {
            const hasItem = (player.inventory || []).some(
                item => item.id === roomConfig.requiresItem
            );

            if (!hasItem) {
                socket.emit(
                    "moveError",
                    roomConfig.missingItemMessage || "Room is too dark to enter."
                );
                return;
            }
        }

        player.currentRoom = room;

        if (roomConfig.hiddenUntilVisited) {
            lobby.visitedRooms = lobby.visitedRooms || {};
            lobby.visitedRooms[room] = true;
        }

        sendLobbyUpdate(lobby);
    });

    socket.on("pickupItem", ({ code, playerToken, itemId: placementId }) => {
        const lobby = lobbies[code];

        if (!lobby) {
            socket.emit("pickupError", "Lobby not found.");
            return;
        }

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) {
            socket.emit("pickupError", "You cannot pick up items for another player.");
            return;
        }

        const placement = lobby.items?.[placementId];

        if (!placement) {
            socket.emit("pickupError", "That item does not exist.");
            return;
        }

        if (placement.takenBy) {
            socket.emit("pickupError", "Someone already picked up that item.");
            return;
        }

        if (player.currentRoom !== placement.room) {
            socket.emit("pickupError", "You need to be in the right room to take that.");
            return;
        }

        const itemDetails = ITEMS[placement.itemId];

        if (!itemDetails) {
            socket.emit("pickupError", "That item is not configured correctly.");
            return;
        }

        player.inventory = player.inventory || [];

        if (player.inventory.some(inventoryItem => inventoryItem.id === itemDetails.id)) {
            socket.emit("pickupError", "You already have that item.");
            return;
        }

        placement.takenBy = playerToken;

        player.inventory.push({
            id: itemDetails.id,
            name: itemDetails.name,
            icon: itemDetails.inventoryIcon || itemDetails.icon,
            popupImage: itemDetails.popupImage || itemDetails.icon,
            description: itemDetails.description
        });

        socket.emit("pickupSuccess", {
            placementId,
            id: itemDetails.id,
            name: itemDetails.name,
            icon: itemDetails.icon,
            sound: itemDetails.pickupSound || DEFAULT_PICKUP_SOUND
        });

        sendTvNotification(
            lobby,
            `${player.name} has picked up a ${itemDetails.name} in the ${ROOMS[placement.room]?.label || placement.room}.`
        );

        sendPrivatePlayerUpdate(socket, lobby, playerToken);
        sendLobbyUpdate(lobby);
    });

    // Lets a player hand an item from their own inventory to another
    // player in the same lobby. Both players get their inventory
    // refreshed privately, and the receiving player (if connected)
    // gets a one-off notification.
    socket.on("giveItem", ({ code, playerToken, itemId, toPlayerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const giver = lobby.players.find(p => p.token === playerToken);

        if (!giver || giver.socketId !== socket.id) {
            socket.emit("gameMessage", "You cannot give that item.");
            return;
        }

        if (playerToken === toPlayerToken) {
            socket.emit("gameMessage", "You already have that item.");
            return;
        }

        const receiver = lobby.players.find(p => p.token === toPlayerToken);

        if (!receiver) {
            socket.emit("gameMessage", "That player is no longer in the game.");
            return;
        }

        giver.inventory = giver.inventory || [];

        const itemIndex = giver.inventory.findIndex(item => item.id === itemId);

        if (itemIndex === -1) {
            socket.emit("gameMessage", "You don't have that item anymore.");
            return;
        }

        const [item] = giver.inventory.splice(itemIndex, 1);

        receiver.inventory = receiver.inventory || [];
        receiver.inventory.push(item);

        sendPrivateInventoryToPlayer(giver);
        sendPrivateInventoryToPlayer(receiver);

        socket.emit("gameMessage", `You gave ${receiver.name} the ${item.name}.`);
        socket.emit("itemRemoved", { sound: DEFAULT_PICKUP_SOUND });

        if (receiver.socketId) {
            io.to(receiver.socketId).emit("itemReceived", {
                fromName: giver.name,
                itemId: item.id,
                itemName: item.name,
                sound: DEFAULT_PICKUP_SOUND
            });
        }
    });

    // Marks a character as "known" lobby-wide the first time ANY
    // player opens their dialogue popup. This is what unlocks that
    // character as a possible suspect in the end-game accusation, on
    // both the phone and the TV.
    socket.on("interactWithCharacter", ({ code, playerToken, characterId }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        const character = CHARACTERS[characterId];
        if (!character) return;

        // Some characters (e.g. the Mysterious Person) should never
        // become an accusable suspect, no matter how many times
        // players talk to them.
        if (character.excludeFromSuspects) return;

        lobby.interactedCharacters = lobby.interactedCharacters || {};

        if (!lobby.interactedCharacters[characterId]) {
            lobby.interactedCharacters[characterId] = true;
            sendLobbyUpdate(lobby);
        }
    });

    // The Mysterious Person (Backyard) has a fully bespoke interaction,
    // driven entirely by whether THIS player has ever given him the
    // Skull item — not the generic intro-line + questions dialogue.
    //
    //   - Already the giver (lobby.skullGivenBy === this player): his
    //     unlocked intro line again, PLUS the real question list — only
    //     this player ever sees revealedQuestions.
    //   - Someone ELSE already gave it: his dismissive line, no
    //     questions, every time — even if THIS player later finds
    //     their own skull, there's only ever one to give (it's
    //     consumed on first use).
    //   - Nobody has given it yet, and this player doesn't have it:
    //     his public teaser intro line, no questions.
    //   - Nobody has given it yet, and this player DOES have it: it's
    //     taken (consumed — gone from their inventory for good), they
    //     become the recorded giver, and they immediately get the
    //     unlocked intro + questions.
    socket.on("interactWithMysteriousPerson", ({ code, playerToken, language }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        if (player.currentRoom !== "backyard") return;

        const character = CHARACTERS["mysterious-person"];
        if (!character) return;

        const revealedQuestions = language === "hr"
            ? (character.revealedQuestionsHr || character.revealedQuestions || [])
            : (character.revealedQuestions || []);

        if (lobby.skullGivenBy === playerToken) {
            socket.emit("mysteriousPersonDialogue", {
                line: pickLang(character, "hintIntroLine", language),
                gaveSkull: false,
                questions: revealedQuestions
            });
            return;
        }

        if (lobby.skullGivenBy) {
            socket.emit("mysteriousPersonDialogue", {
                line: pickLang(character, "dismissiveLine", language),
                gaveSkull: false,
                questions: null
            });
            return;
        }

        player.inventory = player.inventory || [];
        const skullIndex = player.inventory.findIndex(item => item.id === "skull");

        if (skullIndex === -1) {
            socket.emit("mysteriousPersonDialogue", {
                line: pickLang(character, "introLine", language),
                gaveSkull: false,
                questions: null
            });
            return;
        }

        const [skullItem] = player.inventory.splice(skullIndex, 1);
        lobby.skullGivenBy = playerToken;

        socket.emit("mysteriousPersonDialogue", {
            line: pickLang(character, "hintIntroLine", language),
            gaveSkull: true,
            skullIcon: skullItem.icon,
            questions: revealedQuestions
        });

        socket.emit("itemRemoved", { sound: DEFAULT_PICKUP_SOUND });

        sendPrivatePlayerUpdate(socket, lobby, playerToken);
        sendLobbyUpdate(lobby);
    });

    // Kicks off the end-game accusation vote. The accusing player must
    // be in the Lobby room, and can only accuse a character someone has
    // actually talked to. Their chosen suspect immediately counts as
    // their own vote.
    socket.on("startAccusation", ({ code, playerToken, characterId }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) {
            socket.emit("gameMessage", "You cannot start an accusation.");
            return;
        }

        if (isTooSoonToAccuse(lobby)) {
            socket.emit("gameMessage", "It's too soon to accuse.");
            return;
        }

        if (player.lastAccusationAt && Date.now() - player.lastAccusationAt < ACCUSATION_COOLDOWN_MS) {
            socket.emit("gameMessage", "Wait till you can accuse again.");
            return;
        }

        if (player.currentRoom !== "lobby") {
            socket.emit("gameMessage", "You need to be in the Lobby to make an accusation.");
            return;
        }

        if (lobby.accusation) {
            socket.emit("gameMessage", "A vote is already underway.");
            return;
        }

        if (!CHARACTERS[characterId]) return;

        if (!lobby.interactedCharacters?.[characterId]) {
            socket.emit("gameMessage", "No one has any reason to suspect them yet.");
            return;
        }

        player.lastAccusationAt = Date.now();

        lobby.accusation = {
            accuserToken: playerToken,
            accuserName: player.name,
            votes: {
                [playerToken]: characterId
            }
        };

        sendLobbyUpdate(lobby);
        checkAccusationComplete(lobby);
    });

    // Casts (or changes) a player's vote in the currently active
    // accusation. Any player can vote for any known/interacted
    // character, regardless of who was originally accused.
    socket.on("castVote", ({ code, playerToken, characterId }) => {
        const lobby = lobbies[code];
        if (!lobby || !lobby.accusation) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        if (!CHARACTERS[characterId]) return;
        if (!lobby.interactedCharacters?.[characterId]) return;

        lobby.accusation.votes[playerToken] = characterId;

        sendLobbyUpdate(lobby);
        checkAccusationComplete(lobby);
    });

    socket.on("useBasementDoor", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) {
            socket.emit("basementDoorError", "You cannot use this door.");
            return;
        }

        if (player.currentRoom !== "basement-stairway") {
            socket.emit("basementDoorError", "You need to be at the basement door.");
            return;
        }

        if (lobby.basementUnlocked) {
            player.currentRoom = "basement";
            socket.emit("basementEntered");
            sendLobbyUpdate(lobby);
            return;
        }

        player.inventory = player.inventory || [];

        const keyIndex = player.inventory.findIndex(
            item => item.id === "basement-key"
        );

        if (keyIndex === -1) {
            socket.emit(
                "basementDoorError",
                "Doors are locked, you need a key."
            );
            return;
        }

        player.inventory.splice(keyIndex, 1);
        lobby.basementUnlocked = true;

        socket.emit("basementUnlocked");
        sendTvNotification(lobby, `${player.name} has unlocked the basement door.`);
        sendPrivatePlayerUpdate(socket, lobby, playerToken);
        sendLobbyUpdate(lobby);
    });


        socket.on("moveBasementPicture", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) {
            socket.emit("gameMessage", "You cannot move that.");
            return;
        }

        if (player.currentRoom !== "basement") {
            socket.emit("gameMessage", "You need to be in the basement.");
            return;
        }

        if (lobby.basementPictureMoved) {
            socket.emit("gameMessage", "The picture has already been moved.");
            return;
        }

        lobby.basementPictureMoved = true;

        socket.emit(
            "gameMessage",
            "The picture shifts aside, revealing a hidden safe."
        );

        sendLobbyUpdate(lobby);
    });

    // Validates the piano puzzle in the library. Client-side already
    // does key-by-key matching against the same sequence (from
    // ROOMS.library.piano, sent via /api/game-data) for instant
    // feedback — this is the authoritative check that actually flips
    // the shared libraryPianoSolved flag once a full correct sequence
    // is submitted.
    socket.on("submitPianoSequence", ({ code, playerToken, sequence }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) return;

        if (player.currentRoom !== "library") {
            socket.emit("gameMessage", "You need to be in the Library to do that.");
            return;
        }

        if (lobby.libraryPianoSolved) return;

        const target = ROOMS.library?.piano?.sequence || [];

        const matches =
            Array.isArray(sequence) &&
            sequence.length === target.length &&
            sequence.every((note, index) => note === target[index]);

        if (!matches) {
            socket.emit("pianoSequenceWrong");
            return;
        }

        lobby.libraryPianoSolved = true;

        socket.emit("pianoSequenceCorrect");

        socket.emit(
            "gameMessage",
            "A bookshelf moves, revealing a passage."
        );

        sendTvNotification(lobby, `${player.name} found a hidden passage in the Library.`);

        sendLobbyUpdate(lobby);
    });

    // Son's Bedroom cat hotspot — a per-player click counter, not
    // shared lobby state. Reads position on maxClicks/sound/finalSound
    // from ROOMS["son-bedroom"].catHotspot (game/rooms.js) so those are
    // easy to tweak without touching this handler. Stays clickable
    // forever — it just stops making noise after maxClicks, silently,
    // for that specific player only.
    socket.on("clickCatHotspot", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        if (player.currentRoom !== "son-bedroom") return;

        const catConfig = ROOMS["son-bedroom"]?.catHotspot;
        if (!catConfig) return;

        player.catClicks = player.catClicks || 0;

        const maxClicks = catConfig.maxClicks || 5;

        if (player.catClicks >= maxClicks) {
            socket.emit("catHotspotSound", { sound: null });
            return;
        }

        player.catClicks++;

        const sound = player.catClicks >= maxClicks
            ? catConfig.finalSound
            : catConfig.sound;

        socket.emit("catHotspotSound", { sound: sound || null });
    });

    // Kitchen fireplace hotspot — a small multi-step puzzle, lobby-wide
    // (like the basement picture/safe), not per-player:
    //   1. lobby.kitchenFireExtinguished is false, player has no glass
    //      of water: just a flavor message, nothing happens.
    //   2. lobby.kitchenFireExtinguished is false, player HAS a glass
    //      of water: the water is consumed, the flag flips (which
    //      swaps the kitchen's image via altImage/altImageFlag in
    //      game/rooms.js, same mechanism as the library's piano
    //      passage), and a message confirms it.
    //   3. lobby.kitchenFireExtinguished is true, nobody has claimed
    //      the note yet: this click gives the clicking player a
    //      "burned-note" item (reusing the normal pickupSuccess event
    //      so the client gets the same fly-to-inventory animation/
    //      sound as any other item pickup) and permanently flips
    //      kitchenBurnedNoteTaken, which is what hides the hotspot for
    //      everyone from then on (see updateFireHotspot() in
    //      phone/index.html).
    socket.on("clickFireHotspot", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        if (player.currentRoom !== "kitchen") return;
        if (lobby.kitchenBurnedNoteTaken) return;

        player.inventory = player.inventory || [];

        if (!lobby.kitchenFireExtinguished) {
            const waterIndex = player.inventory.findIndex(
                item => item.id === "glass-of-water"
            );

            if (waterIndex === -1) {
                socket.emit(
                    "gameMessage",
                    "There's something in the fire but I can't reach it."
                );
                return;
            }

            const [waterItem] = player.inventory.splice(waterIndex, 1);
            lobby.kitchenFireExtinguished = true;

            socket.emit("gameMessage", "You've extinguished the fire.");

            // Dedicated event (rather than the generic "itemRemoved")
            // so the client can play water.mp3 specifically and
            // animate the glass of water flying from the inventory to
            // the fireplace hotspot — see socket.on("waterUsedOnFire")
            // in phone/index.html.
            socket.emit("waterUsedOnFire", {
                icon: waterItem.icon
            });

            sendTvNotification(lobby, `${player.name} extinguished the fire in the Kitchen.`);
            sendPrivatePlayerUpdate(socket, lobby, playerToken);
            sendLobbyUpdate(lobby);
            return;
        }

        const noteDetails = ITEMS["burned-note"];
        if (!noteDetails) return;

        if (player.inventory.some(item => item.id === noteDetails.id)) {
            lobby.kitchenBurnedNoteTaken = true;
            sendLobbyUpdate(lobby);
            return;
        }

        player.inventory.push({
            id: noteDetails.id,
            name: noteDetails.name,
            icon: noteDetails.inventoryIcon || noteDetails.icon,
            popupImage: noteDetails.popupImage || noteDetails.icon,
            description: noteDetails.description
        });

        lobby.kitchenBurnedNoteTaken = true;

        socket.emit("pickupSuccess", {
            placementId: "kitchen-burned-note",
            id: noteDetails.id,
            name: noteDetails.name,
            icon: noteDetails.icon,
            sound: DEFAULT_PICKUP_SOUND
        });

        sendTvNotification(lobby, `${player.name} found a burned note in the Kitchen.`);
        sendPrivatePlayerUpdate(socket, lobby, playerToken);
        sendLobbyUpdate(lobby);
    });

    // The Cook has one extra, hidden question — only askable by a
    // player who currently has the Kitchen Knife in their inventory.
    // Same reasoning as the Mysterious Person's revealedQuestions in
    // game/characters.js: the answer text lives in a field
    // getClientCharacters() never sends to the browser, so it can only
    // ever be learned through this round trip, not by reading page
    // data in dev tools.
    socket.on("askCookAboutKnife", ({ code, playerToken, language }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        const hasKnife = (player.inventory || []).some(
            item => item.id === "kitchen-knife"
        );
        if (!hasKnife) return;

        const knifeQuestion = CHARACTERS.cook?.knifeQuestion;
        if (!knifeQuestion) return;

        const knifeQuestionHr = CHARACTERS.cook?.knifeQuestionHr;

        socket.emit(
            "cookKnifeAnswer",
            language === "hr" && knifeQuestionHr ? knifeQuestionHr : knifeQuestion
        );
    });

    // Unlike the Cook's knife question (gated on the asking player's
    // own inventory), this is gated on lobby-wide state: any player can
    // ask it, as soon as anyone has moved the basement picture aside
    // and revealed the safe.
    socket.on("askButlerAboutSafe", ({ code, playerToken, language }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);
        if (!player || player.socketId !== socket.id) return;

        if (!lobby.basementPictureMoved) return;

        const safeQuestion = CHARACTERS.butler?.safeQuestion;
        if (!safeQuestion) return;

        const safeQuestionHr = CHARACTERS.butler?.safeQuestionHr;

        socket.emit(
            "butlerSafeAnswer",
            language === "hr" && safeQuestionHr ? safeQuestionHr : safeQuestion
        );
    });

    // The TV builds the actual intro story text (it has the host's own
    // clock, and the player list) and hands it to the server once, so
    // every phone can show byte-identical text instead of each device
    // trying to recompute it (and disagreeing on the time). Cached on
    // the lobby so late joiners get it too via the normal lobby object.
    socket.on("introStoryReady", ({ code, story }) => {
        const lobby = lobbies[code];
        if (!lobby) return;
        if (socket.id !== lobby.hostSocketId) return;
        if (typeof story !== "string" || !story.trim()) return;

        lobby.introStory = story.slice(0, 4000);
        io.to(code).emit("introStory", lobby.introStory);
    });

    socket.on("openSafe", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) {
            socket.emit("safeError", "You cannot use that safe.");
            return;
        }

        if (player.currentRoom !== "basement") {
            socket.emit("safeError", "You need to be in the basement.");
            return;
        }

        if (!lobby.basementPictureMoved) {
            socket.emit("safeError", "Something is blocking the safe.");
            return;
        }

        if (lobby.safeUnlocked) {
            socket.emit("safeEntered");
            return;
        }

        socket.emit("showSafeKeypad");
    });

    socket.on("submitSafeCode", ({ code, playerToken, enteredCode }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const player = lobby.players.find(p => p.token === playerToken);

        if (!player || player.socketId !== socket.id) {
            socket.emit("safeError", "You cannot use that safe.");
            return;
        }

        if (player.currentRoom !== "basement") {
            socket.emit("safeError", "You need to be in the basement.");
            return;
        }

        if (!lobby.basementPictureMoved) {
            socket.emit("safeError", "Something is blocking the safe.");
            return;
        }

        if (String(enteredCode) !== String(lobby.safeCode)) {
            socket.emit("safeCodeWrong");
            return;
        }

        lobby.safeUnlocked = true;

        socket.emit("safeCodeCorrect");
        socket.emit("safeEntered");

        socket.emit(
            "gameMessage",
            "A heavy mechanism unlocks somewhere in the basement."
        );

        sendTvNotification(
            lobby,
            `${player.name} has unlocked the safe in the ${ROOMS.basement.label}.`
        );

        sendLobbyUpdate(lobby);
    });

    socket.on("leaveLobby", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        socket.leave(code);

        clearPlayerDisconnectTimer(code, playerToken);
        transferInventoryFromPlayer(lobby, playerToken);

        lobby.players = lobby.players.filter(p => p.token !== playerToken);

        sendLobbyUpdate(lobby);
        scheduleEmptyLobbyCleanup(lobby);
    });

    socket.on("removePlayer", ({ code, playerToken }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        if (socket.id !== lobby.hostSocketId) return;

        const removedPlayer = lobby.players.find(p => p.token === playerToken);

        clearPlayerDisconnectTimer(code, playerToken);
        transferInventoryFromPlayer(lobby, playerToken);

        if (removedPlayer?.socketId) {
            io.to(removedPlayer.socketId).emit(
                "removedFromLobby",
                "You were removed from the game."
            );
        }

        lobby.players = lobby.players.filter(p => p.token !== playerToken);

        sendLobbyUpdate(lobby);
        scheduleEmptyLobbyCleanup(lobby);
    });

    socket.on("startGame", ({ code }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        if (socket.id !== lobby.hostSocketId) return;

        if (lobby.players.length < 1) {
            socket.emit(
                "lobbyError",
                "At least one player must join before starting."
            );
            return;
        }

        lobby.status = "intro";
        io.to(code).emit("gameStarted", sanitizeLobbyForClient(lobby));
        sendLobbyUpdate(lobby);
    });

    socket.on("enterMansion", ({ code }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        if (lobby.status === "playing") return;

        lobby.status = "playing";
        lobby.gameStartedAt = Date.now();
        io.to(code).emit("mansionEntered", sanitizeLobbyForClient(lobby));
        sendLobbyUpdate(lobby);
    });

    socket.on("endGame", ({ code, tvSessionId }) => {
        const lobby = lobbies[code];

        if (!lobby) {
            socket.emit("lobbyError", "Game no longer exists.");
            return;
        }

        if (
            socket.id !== lobby.hostSocketId ||
            tvSessionId !== lobby.tvSessionId
        ) {
            socket.emit("lobbyError", "Only the host can end this game.");
            return;
        }

        closeLobby(code, "The host ended the game.");
    });

    // Lets the TV itself kick off an accusation vote (via the "Accuse"
    // button), rather than a specific player. Unlike a player-started
    // accusation, this seeds zero votes — every player, including
    // whoever might otherwise have been the "accuser", votes fresh.
    socket.on("startGroupAccusation", ({ code, tvSessionId }) => {
        const lobby = lobbies[code];

        if (!lobby) {
            socket.emit("lobbyError", "Game no longer exists.");
            return;
        }

        if (
            socket.id !== lobby.hostSocketId ||
            tvSessionId !== lobby.tvSessionId
        ) {
            return;
        }

        if (isTooSoonToAccuse(lobby)) {
            socket.emit("lobbyError", "It's too soon to accuse.");
            return;
        }

        if (lobby.accusation) {
            socket.emit("lobbyError", "A vote is already underway.");
            return;
        }

        const hasSuspects = Object.values(lobby.interactedCharacters || {}).some(Boolean);

        if (!hasSuspects) {
            socket.emit("lobbyError", "No suspects yet.");
            return;
        }

        lobby.accusation = {
            accuserToken: null,
            accuserName: "Group",
            votes: {}
        };

        sendLobbyUpdate(lobby);
    });

    // Cancels the currently active accusation with no ending — the
    // exact same outcome as a tied vote ("Group hasn't decided who the
    // suspect is."). Usable by any connected player in the lobby, or
    // by the TV host.
    socket.on("cancelAccusation", ({ code, playerToken, tvSessionId }) => {
        const lobby = lobbies[code];
        if (!lobby || !lobby.accusation) return;

        const isPlayer = Boolean(
            playerToken &&
            lobby.players.some(p => p.token === playerToken && p.socketId === socket.id)
        );

        const isHost = Boolean(
            tvSessionId &&
            socket.id === lobby.hostSocketId &&
            tvSessionId === lobby.tvSessionId
        );

        if (!isPlayer && !isHost) return;

        lobby.accusation = null;

        io.to(lobby.code).emit("accusationResult", { result: "tie" });
        sendLobbyUpdate(lobby);
    });

    // The "End Game" button on the ending screen (phone and TV both
    // use this). Unlike the mid-game "Exit Game" in the TV settings
    // menu (which stays host-only via the existing endGame handler),
    // this is deliberately open to any player too — by the time this
    // button is visible, the mystery is already resolved, so there's
    // no game-integrity reason to restrict who can close things out.
    socket.on("endGameSession", ({ code, playerToken, tvSessionId }) => {
        const lobby = lobbies[code];
        if (!lobby) return;

        const isPlayer = Boolean(
            playerToken &&
            lobby.players.some(p => p.token === playerToken && p.socketId === socket.id)
        );

        const isHost = Boolean(
            tvSessionId &&
            socket.id === lobby.hostSocketId &&
            tvSessionId === lobby.tvSessionId
        );

        if (!isPlayer && !isHost) return;

        closeLobby(code, "The game has ended.");
    });

    socket.on("disconnect", () => {
        if (socket.data.type === "tv") {
            const code = socket.data.activeLobbyCode;
            const lobby = lobbies[code];

            if (lobby && lobby.hostSocketId === socket.id) {
                lobby.hostConnected = false;

                const timer = setTimeout(() => {
                    const currentLobby = lobbies[code];

                    if (currentLobby && !currentLobby.hostConnected) {
                        closeLobby(code, "Host did not return.");
                    }
                }, TV_RECONNECT_GRACE_MS);

                tvDisconnectTimers.set(code, timer);
            }
        }

        const code = socket.data.lobbyCode;
        const token = socket.data.playerToken;
        const lobby = lobbies[code];

        if (lobby && token) {
            const player = lobby.players.find(p => p.token === token);

            // Critical guard: only act if THIS socket is still the one
            // on file for the player. If they already reconnected with
            // a new socket (which updates player.socketId in joinLobby)
            // before this disconnect event was processed, `socket.id`
            // here refers to the OLD, now-dead connection — acting on
            // it would incorrectly wipe out the valid, newer socketId
            // and leave the player unable to do anything (every action
            // checks player.socketId === socket.id). This race is rare
            // on localhost (disconnect/reconnect happen almost
            // instantly) but much more likely on a real host, where
            // network latency/ping-timeout detection can delay the old
            // socket's disconnect event until well after the new one
            // has already reconnected.
            if (player && player.socketId === socket.id) {
                // Mark them offline immediately (so the TV map / other
                // phones see it right away), but do NOT touch their
                // inventory yet — a refresh or a dropped signal looks
                // identical to closing the tab, and we don't want to
                // punish a refresh. They get PLAYER_RECONNECT_GRACE_MS
                // to come back before we give their items away.
                player.connected = false;
                player.socketId = null;
                sendLobbyUpdate(lobby);

                clearPlayerDisconnectTimer(code, token);

                const timerKey = `${code}:${token}`;

                const timer = setTimeout(() => {
                    playerDisconnectTimers.delete(timerKey);

                    const currentLobby = lobbies[code];
                    if (!currentLobby) return;

                    const currentPlayer = currentLobby.players.find(
                        p => p.token === token
                    );

                    // If they're gone entirely (left/kicked) or they
                    // reconnected in the meantime, there's nothing to do.
                    if (!currentPlayer || currentPlayer.connected) return;

                    transferInventoryFromPlayer(currentLobby, token);
                    sendLobbyUpdate(currentLobby);
                }, PLAYER_RECONNECT_GRACE_MS);

                playerDisconnectTimers.set(timerKey, timer);
            }
        }
    });
});

server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});