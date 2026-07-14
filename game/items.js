// ============================================================
// ITEM REGISTRY
// ============================================================
// This is the single source of truth for every item in the game.
//
// TO ADD A NEW ITEM:
//   1. Add an entry to ITEMS below (id, name, icon, description).
//      `popupImage` is optional — it's the bigger picture shown when a
//      player taps the item in their inventory. If you don't set one,
//      it just reuses `icon`.
//      `pickupSound` is also optional — the sound played when this
//      item is picked up. If you don't set one, it falls back to
//      DEFAULT_PICKUP_SOUND below. Set it to give a specific item its
//      own distinct pickup sound.
//   2. Add one entry to ITEM_PLACEMENTS saying which room it spawns in
//      and which item id it points to.
//   3. Add a matching itemHotspot to that room in game/rooms.js so
//      players have something to click on.
//
// You should NOT need to touch server.js at all for a normal
// "find this item in this room" item — the generic pickup handler
// reads everything it needs from this file.
// ============================================================

// Played on pickup for any item that doesn't set its own pickupSound.
const DEFAULT_PICKUP_SOUND = "/sounds/pickupitemsound.mp3";

const ITEMS = {
    "basement-key": {
        id: "basement-key",
        name: "Basement Key",
        icon: "/images/items/basement-key.png",
        // No popupImage set, so tapping it in the inventory will just
        // show a bigger version of the icon above.
        description: "An old iron key. It may unlock the basement."
        // No pickupSound set, so this plays DEFAULT_PICKUP_SOUND.
    },

    flashlight: {
        id: "flashlight",
        name: "Flashlight",
        icon: "/images/items/flashlight.png",
        description: "A working flashlight. You'll need it to see in any pitch-dark room."
    },

    skull: {
        id: "skull",
        name: "Skull",
        icon: "/images/items/skull.png",
        description: "A small carved skull. Strange energy seems to radiate from it."
    }

    // Example of how a future item with its own pickup sound would
    // look — just uncomment and edit:
    // "silver-locket": {
    //     id: "silver-locket",
    //     name: "Silver Locket",
    //     icon: "/images/items/silver-locket.png",
    //     popupImage: "/images/items/silver-locket-large.png",
    //     description: "A tarnished locket with a faded photo inside.",
    //     pickupSound: "/sounds/locket-pickup.mp3"
    // }
};

// Each placement is one physical copy of an item sitting in a room,
// waiting to be picked up. `placementId` must be unique across ALL
// placements (even if two placements use the same item id), and it's
// what the room's itemHotspot will reference.
const ITEM_PLACEMENTS = [
    {
        placementId: "library-basement-key",
        itemId: "basement-key",
        room: "library"
    },
    {
        placementId: "kitchen-flashlight",
        itemId: "flashlight",
        room: "kitchen"
    },
    {
        placementId: "attic-skull",
        itemId: "skull",
        room: "attic"
    }

    // Example of a future placement:
    // {
    //     placementId: "dining-silver-locket",
    //     itemId: "silver-locket",
    //     room: "dining"
    // }
];

// Builds the fresh per-lobby item state (nobody has picked anything up
// yet). Called once whenever a new lobby is created.
function createItemState() {
    const items = {};

    ITEM_PLACEMENTS.forEach((placement) => {
        items[placement.placementId] = {
            id: placement.placementId,
            itemId: placement.itemId,
            room: placement.room,
            takenBy: null
        };
    });

    return items;
}

// Sent to the client via /api/game-data so it can look up an item's
// icon/name/description — e.g. for rendering an itemHotspot as the
// item's actual icon image (see `iconHotspot` in game/rooms.js)
// instead of a plain text button, or for the inventory popup. Nothing
// here is secret, unlike character data — everything is safe to send
// as-is.
function getClientItems() {
    const clientItems = {};

    for (const [id, item] of Object.entries(ITEMS)) {
        clientItems[id] = {
            id: item.id,
            name: item.name,
            icon: item.icon,
            popupImage: item.popupImage || item.icon,
            description: item.description
        };
    }

    return clientItems;
}

module.exports = { ITEMS, ITEM_PLACEMENTS, createItemState, DEFAULT_PICKUP_SOUND, getClientItems };
