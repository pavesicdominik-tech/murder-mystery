const { createItemState } = require("./items");

function generateCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ123456789";
    let code = "";

    for (let i = 0; i < 5; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
}

function createLobby() {
    return {
        code: generateCode(),
        players: [],
        maxPlayers: 6,
        status: "waiting",

        // Shared game progress.
        basementUnlocked: false,

        // Safe puzzle progress.
        basementPictureMoved: false,
        safeUnlocked: false,

        // Change this code whenever you want.
        safeCode: "1987",

        // Piano puzzle in the library — see game/rooms.js (library.piano)
        // for the correct note sequence.
        libraryPianoSolved: false,

        // Tracks which rooms ANY player has ever walked into, for
        // rooms marked `hiddenUntilVisited` in game/rooms.js (e.g. the
        // Backyard) — { [roomId]: true }. Filters the "Choose a room"
        // dropdown, same shared/lobby-wide pattern as
        // interactedCharacters below.
        visitedRooms: {},

        // The Mysterious Person (Backyard) — null until someone gives
        // him the Skull item, then the giving player's token. Only
        // that player gets his hint from then on; everyone else always
        // gets his dismissive line. See interactWithMysteriousPerson
        // in server.js.
        skullGivenBy: null,

        // Shared items. Once one player takes an item, it is gone for everyone.
        // Built automatically from game/items.js — add new items there, not here.
        items: createItemState(),

        // Tracks which characters ANY player has talked to at least
        // once (shared across the whole lobby) — { [characterId]: true }.
        // This is what filters the accusation suspect list on both the
        // phone and TV.
        interactedCharacters: {},

        // Null when no accusation is in progress. While one is active:
        // { accuserToken, accuserName, votes: { [playerToken]: characterId } }
        accusation: null,

        // Set once the game ends via an accusation: "good" or "bad".
        // lobby.status becomes "ended" at the same time. endingCharacterId/
        // endingStoryText/endingBackgroundImage are filled in from
        // whichever character was accused (see checkAccusationComplete
        // in server.js) — kept on the lobby so a reconnecting/late
        // player still sees the correct ending.
        endingResult: null,
        endingCharacterId: null,
        endingStoryText: null,
        endingBackgroundImage: null
    };
}

module.exports = {
    createLobby
};
