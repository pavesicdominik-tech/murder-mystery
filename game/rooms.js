// ============================================================
// ROOM REGISTRY
// ============================================================
// This is the single source of truth for every room in the game:
// its label, its background image, the doors that connect it to
// other rooms, and (for the TV map) where its marker sits.
//
// TO ADD A NEW ROOM:
//   1. Add an entry below with a unique id.
//   2. Add a `doors` entry on it (and on whichever room should link
//      back to it) so players can walk between them.
//   3. Add its image to public/images/rooms/, sized 1408x768 (see
//      DEFAULT_ASPECT_RATIO below) — every room image is standardized
//      to that size, so you don't need to set imageAspectRatio at all
//      unless a specific room's photo is a genuinely different shape.
//   4. Set `mapZone` to roughly where it should sit on your
//      mansion-map.png (x/y are percentages of the map image).
//   5. If it should start locked, add `requiresFlag` pointing at a
//      lobby flag (e.g. "basementUnlocked") that becomes true once
//      players solve whatever unlocks it.
//   6. Want an NPC standing in the room? Add a `characterHotspots`
//      entry pointing at a character id from game/characters.js —
//      see the library room below for an example.
//   7. Want the room pitch dark (only visible through a flashlight
//      circle that follows the player's finger) and blocked without
//      a specific item? Add `dark: true` and
//      `requiresItem: "<item id from game/items.js>"`. Trying to
//      enter without that item shows `missingItemMessage` (or the
//      default "Room is too dark to enter." if you don't set one).
//      See basement and attic below for an example. `requiresItem` is
//      independent from `requiresFlag` — a room can use either, both,
//      or neither.
//   9. Want the room hidden from the "Choose a room" dropdown until
//      someone actually walks into it (rather than until a puzzle
//      flag is set)? Add `hiddenUntilVisited: true`. Unlike
//      `requiresFlag`, this never blocks entry — only the dropdown
//      option's visibility — since the whole point is that a door
//      hotspot in another room is what reveals it. See backyard below.
//
// A `doors` entry can also have its own `requiresFlag`, independent
// from the room-level one — that only controls whether that specific
// door hotspot is shown, not whether the destination room can be
// entered (see the library's passage to the attic below).
//
// An `itemHotspots` entry can add `iconHotspot: true` to render as
// the item's actual icon image instead of a plain text button — see
// the attic's skull below.
//
// server.js reads this file to validate movement and lock checks —
// you should not need to touch server.js to add a plain room.
// ============================================================

// The standard size for every room photo: 1408x768. Used for any room
// that doesn't set its own imageAspectRatio. Keeping every room image
// this exact size/ratio is what makes hotspots line up correctly on
// every screen size — see the big comment above sizeRoomCanvas() in
// phone/index.html for why.
const DEFAULT_ASPECT_RATIO = 1408 / 768;

const ROOMS = {
    lobby: {
        id: "lobby",
        label: "Lobby",
        labelHr: "Predvorje",
        image: "/images/rooms/lobby.jpg",
        mapZone: { x: 53, y: 64 },
        doors: [
            { target: "dining", label: "Dining Room", left: "3%", top: "9%", width: "9%", height: "55%", invisible: true },
            { target: "powder-room", label: "Powder Room", left: "77%", top: "20%", width: "5%", height: "35%", invisible: true },
            // Placed top-middle, side by side, per request.
            { target: "basement-stairway", label: "Stairway to the Basement", left: "89%", top: "13%", width: "8%", height: "50%", invisible: true },
            { target: "hallway", label: "Hallway", left: "42%", top: "6%", width: "17%", height: "51%", invisible: true }
        ]
    },

    library: {
        id: "library",
        label: "Library",
        labelHr: "Knjižnica",
        image: "/images/rooms/library.jpg",
        mapZone: { x: 67, y: 22 },
        doors: [
            // Was "Lobby"; now leads to the Bedroom instead — the
            // library/lobby connection no longer exists in either
            // direction (see lobby.doors above, which no longer
            // targets library either).
            { target: "bedroom", label: "Bedroom", left: "88%", top: "28%", width: "8%", height: "55%", invisible: true },

            // Only shown once the piano puzzle is solved (see `piano`
            // below). requiresFlag on a DOOR (unlike on a room) only
            // controls whether this specific door is shown — it's a
            // client-side rendering concern, not a movement rule. The
            // destination room's own requiresFlag/requiresItem (attic's
            // flashlight requirement) still applies regardless of which
            // door was used to get there.
            { target: "attic", label: "Hidden Passage", left: "43%", top: "31%", width: "15%", height: "39%", requiresFlag: "libraryPianoSolved", invisible: true },

            { target: "hallway", label: "Hallway", left: "4%", top: "27%", width: "8%", height: "57%", invisible: true }
        ],
        itemHotspots: [
            { placementId: "library-basement-key", label: "Take key", left: "51%", top: "73%", width: "3%", height: "4%", iconHotspot: true }
        ],
        characterHotspots: [
            // left/top/width/height position this character's roomSprite
            // image in this specific room. The same character could
            // appear in a different room with different coordinates.
            { characterId: "butler", left: "33%", top: "36%", width: "12%", height: "50%" }
        ],

        // Shown instead of `image` once libraryPianoSolved is true —
        // e.g. a version of the room with a bookshelf swung open. Must
        // also be 1408x768 like every other room image.
        altImage: "/images/rooms/library-open.jpg",
        altImageFlag: "libraryPianoSolved",

        // The piano minigame: 8 keys (C D E F G A B C), played by
        // clicking a hotspot in this room (#pianoHotspot in
        // phone/index.html — bespoke, like the basement/safe puzzle
        // hotspots, since it opens a whole custom mini-game UI rather
        // than a plain door/item). `sequence` is checked both
        // client-side (for instant key-by-key feedback) and
        // server-side (authoritative) in submitPianoSequence — see
        // server.js. Each entry is a key id from PIANO_KEYS in
        // phone/index.html ("c1".."c2" spanning one octave).
        piano: {
            sequence: ["c1", "e1", "g1", "c2"]
        }
    },

    kitchen: {
        id: "kitchen",
        label: "Kitchen",
        labelHr: "Kuhinja",
        image: "/images/rooms/kitchen.jpg",
        mapZone: { x: 16, y: 49 },
        doors: [
            { target: "dining", label: "Dining", left: "87%", top: "28%", width: "11%", height: "65%", invisible: true },
            { target: "backyard", label: "Backyard", left: "16%", top: "28%", width: "5%", height: "29%", invisible: true }
        ],
        itemHotspots: [
            { placementId: "kitchen-knife", label: "Take knife", left: "8%", top: "56%", width: "48%", height: "8%", iconHotspot: true }
        ],
        characterHotspots: [
            { characterId: "cook", left: "45%", top: "39%", width: "14%", height: "55%" }
        ],

        // Shown instead of `image` once the fireplace hotspot has been
        // used to douse the fire with the glass of water (see
        // clickFireHotspot in server.js, and #fireHotspot in
        // phone/index.html). Same altImage/altImageFlag mechanism as
        // the library's bookshelf passage above.
        altImage: "/images/rooms/kitchen-fire-out.jpg",
        altImageFlag: "kitchenFireExtinguished"
    },

    dining: {
        id: "dining",
        label: "Dining Room",
        labelHr: "Blagovaonica",
        image: "/images/rooms/dining.jpg",
        mapZone: { x: 35, y: 53 },
        doors: [
            { target: "kitchen", label: "Kitchen", left: "6%", top: "30%", width: "7%", height: "54%", invisible: true },
            { target: "lobby", label: "Lobby", left: "87%", top: "30%", width: "7%", height: "54%", invisible: true }
        ]
    },

    bedroom: {
        id: "bedroom",
        label: "Bedroom",
        labelHr: "Spavaća soba",
        image: "/images/rooms/bedroom.jpg",
        mapZone: { x: 85, y: 22 },
        doors: [
            // Bedroom's only connection now — the hallway door has
            // been removed (Bedroom is reachable only via Library).
            { target: "library", label: "Library", left: "6%", top: "28%", width: "5%", height: "43%", invisible: true }
        ],
        characterHotspots: [
            { characterId: "maid", left: "28%", top: "40%", width: "13%", height: "52%" }
        ]
    },

    hallway: {
        id: "hallway",
        label: "Hallway",
        labelHr: "Hodnik",
        image: "/images/rooms/hallway.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 70, y: 55 },
        doors: [
            { target: "son-bedroom", label: "Son's Bedroom", labelHr: "Sinova soba", left: "42%", top: "20%", width: "16%", height: "40%" },
            { target: "library", label: "Library", labelHr: "Knjižnica", left: "8%", top: "35%", width: "16%", height: "32%" },
            { target: "lobby", label: "Lobby", labelHr: "Predvorje", left: "76%", top: "35%", width: "16%", height: "32%" }
        ],
        characterHotspots: [
            { characterId: "son", left: "58%", top: "20%", width: "13%", height: "55%" }
        ]
    },

    "son-bedroom": {
        id: "son-bedroom",
        label: "Son's Bedroom",
        labelHr: "Sinova soba",
        image: "/images/rooms/son-bedroom.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 38, y: 21 },
        doors: [
            { target: "hallway", label: "Hallway", left: "91%", top: "18%", width: "9%", height: "69%", invisible: true }
        ],

        itemHotspots: [
            { placementId: "son-bedroom-wrinkled-note", label: "Take note", left: "46%", top: "76%", width: "8%", height: "12%", iconHotspot: true }
        ],

        // Bespoke — not a generic itemHotspot or characterHotspot, since
        // it doesn't give an item or open dialogue. It's a click-counted
        // easter egg: stays clickable forever, but only makes noise the
        // first `maxClicks` times per player (see clickCatHotspot in
        // server.js, and renderCatHotspot() in phone/index.html). `sound`
        // plays for clicks before the last one; `finalSound` plays on the
        // maxClicks-th click; nothing plays after that, ever, for that
        // player.
        catHotspot: {
            image: "/images/props/cat.png",
            left: "15%",
            top: "54%",
            width: "12%",
            height: "14%",
            maxClicks: 5,
            sound: "/sounds/meow.mp3",
            finalSound: "/sounds/hiss.mp3"
        }
    },

    "powder-room": {
        id: "powder-room",
        label: "Powder Room",
        labelHr: "Toaletna soba",
        image: "/images/rooms/powder-room.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 74, y: 50 },
        doors: [
            // Was "Hallway"; now leads directly to the Lobby instead
            // (matches lobby.doors above, which now has a direct door
            // here too).
            { target: "lobby", label: "Lobby", left: "90%", top: "18%", width: "12%", height: "78%", invisible: true }
        ],
        itemHotspots: [
            { placementId: "powder-room-glass-of-water", label: "Take glass of water", left: "62%", top: "60%", width: "9%", height: "14%", iconHotspot: true }
        ],
        characterHotspots: [
            { characterId: "wife", left: "49%", top: "27%", width: "13%", height: "74%" }
        ]
    },

    "basement-stairway": {
        id: "basement-stairway",
        label: "Stairway to the Basement",
        labelHr: "Stubište za podrum",
        image: "/images/rooms/basement-stairway.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 57, y: 72 },
        doors: [
            // Was "Back Upstairs" -> bedroom; now leads directly to the
            // Lobby instead (matches lobby.doors above).
            { target: "lobby", label: "Lobby", left: "22%", top: "66%", width: "55%", height: "32%", invisible: true }
        ]
    },

    basement: {
        id: "basement",
        label: "Basement",
        labelHr: "Podrum",
        image: "/images/rooms/basement.jpg",
        requiresFlag: "basementUnlocked",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 76, y: 75 },
        doors: [
            { target: "basement-stairway", label: "Leave Basement", left: "3%", top: "10%", width: "21%", height: "74%", invisible: true }
        ],

        // Shown instead of `image` once the safe has been opened (see
        // openSafe/submitSafeCode in server.js). Opening the safe no
        // longer moves the player into a separate room — it just pops
        // up #safePopupOverlay in phone/index.html — so this is purely
        // a background change to reflect that the safe now stands
        // open in the basement.
        altImage: "/images/rooms/basement2.jpg",
        altImageFlag: "safeUnlocked"
    },

    attic: {
        id: "attic",
        label: "Attic",
        labelHr: "Tavan",
        image: "/images/rooms/attic.jpg",
        // No image yet — will use the standard 1408x768 ratio once added.
        requiresItem: "flashlight",

        // Reusing the room-level requiresFlag mechanism here does two
        // things at once: hides "Attic" from the room dropdown until
        // solved (same as basement), AND blocks entry via
        // the dropdown even if someone bypasses the library's door —
        // so the only real way in is through the library passage.
        requiresFlag: "libraryPianoSolved",

        dark: true,
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 86, y: 50 },
        doors: [
            // The only way back down — matches the library being the
            // only way up.
            { target: "library", label: "Library", left: "56%", top: "79%", width: "15%", height: "9%", invisible: true }
        ],
        itemHotspots: [
            // iconHotspot: true renders this as the item's actual icon
            // image sitting in the room, rather than a plain dashed
            // text button — see renderItemHotspots() in phone/index.html.
            { placementId: "attic-skull", label: "Take skull", left: "33%", top: "21%", width: "3%", height: "4%", iconHotspot: true, opacity: 0.5 }
        ]
    },

    backyard: {
        id: "backyard",
        label: "Backyard",
        labelHr: "Dvorište",
        image: "/images/rooms/backyard.jpg",
        // No image yet — will use the standard 1408x768 ratio once added.

        // Hidden from the room dropdown until a player actually walks
        // in through the kitchen's door — see hiddenUntilVisited in
        // the docs above.
        hiddenUntilVisited: true,

        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 16, y: 17 },
        doors: [
            { target: "kitchen", label: "Kitchen", left: "8%", top: "35%", width: "18%", height: "32%" }
        ],
        characterHotspots: [
            { characterId: "mysterious-person", left: "55%", top: "25%", width: "14%", height: "55%" }
        ]
    }

    // Example of how a future room would look — just uncomment and edit:
    // attic2: {
    //     id: "attic2",
    //     label: "Second Attic",
    //     image: "/images/rooms/attic2.jpg",
    //     imageAspectRatio: 1600 / 1200,
    //     mapZone: { x: 50, y: 10 },
    //     doors: [
    //         { target: "bedroom", label: "Downstairs", left: "8%", top: "35%", width: "18%", height: "32%" }
    //     ]
    // }
};

// Strips out anything server-only before sending room data to the
// browser (currently everything here is safe to send, but this keeps
// a clean boundary in case that changes later).
function getClientRooms() {
    const clientRooms = {};

    for (const [id, room] of Object.entries(ROOMS)) {
        clientRooms[id] = {
            id: room.id,
            label: room.label,
            labelHr: room.labelHr || null,
            image: room.image,
            imageAspectRatio: room.imageAspectRatio || DEFAULT_ASPECT_RATIO,
            mapZone: room.mapZone || null,
            requiresFlag: room.requiresFlag || null,
            requiresItem: room.requiresItem || null,
            hiddenUntilVisited: Boolean(room.hiddenUntilVisited),
            missingItemMessage: room.missingItemMessage || "Room is too dark to enter.",
            dark: Boolean(room.dark),
            doors: room.doors || [],
            itemHotspots: room.itemHotspots || [],
            characterHotspots: room.characterHotspots || [],
            altImage: room.altImage || null,
            altImageFlag: room.altImageFlag || null,
            piano: room.piano || null,
            catHotspot: room.catHotspot || null
        };
    }

    return clientRooms;
}

module.exports = { ROOMS, getClientRooms, DEFAULT_ASPECT_RATIO };
