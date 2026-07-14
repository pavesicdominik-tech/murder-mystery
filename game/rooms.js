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
        image: "/images/rooms/lobby.jpg",
        mapZone: { x: 50, y: 24 },
        doors: [
            { target: "library", label: "Library", left: "9%", top: "42%", width: "17%", height: "26%" }
        ]
    },

    library: {
        id: "library",
        label: "Library",
        image: "/images/rooms/library.jpg",
        mapZone: { x: 21, y: 25 },
        doors: [
            { target: "lobby", label: "Lobby", left: "76%", top: "33%", width: "16%", height: "34%" },

            // Only shown once the piano puzzle is solved (see `piano`
            // below). requiresFlag on a DOOR (unlike on a room) only
            // controls whether this specific door is shown — it's a
            // client-side rendering concern, not a movement rule. The
            // destination room's own requiresFlag/requiresItem (attic's
            // flashlight requirement) still applies regardless of which
            // door was used to get there.
            { target: "attic", label: "Hidden Passage", left: "42%", top: "22%", width: "18%", height: "48%", requiresFlag: "libraryPianoSolved" }
        ],
        itemHotspots: [
            { placementId: "library-basement-key", label: "Take key", left: "64%", top: "58%" }
        ],
        characterHotspots: [
            // left/top/width/height position this character's roomSprite
            // image in this specific room. The same character could
            // appear in a different room with different coordinates.
            { characterId: "butler", left: "30%", top: "22%", width: "12%", height: "55%" }
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
        image: "/images/rooms/kitchen.jpg",
        mapZone: { x: 79, y: 25 },
        doors: [
            { target: "dining", label: "Dining", left: "5%", top: "38%", width: "18%", height: "30%" },
            { target: "backyard", label: "Backyard", left: "88%", top: "30%", width: "10%", height: "40%" }
        ],
        itemHotspots: [
            { placementId: "kitchen-flashlight", label: "Take flashlight", left: "50%", top: "60%" }
        ],
        characterHotspots: [
            { characterId: "cook", left: "62%", top: "20%", width: "14%", height: "55%" }
        ]
    },

    dining: {
        id: "dining",
        label: "Dining Room",
        image: "/images/rooms/dining.jpg",
        mapZone: { x: 21, y: 72 },
        doors: [
            { target: "kitchen", label: "Kitchen", left: "76%", top: "36%", width: "17%", height: "30%" }
        ]
    },

    bedroom: {
        id: "bedroom",
        label: "Bedroom",
        image: "/images/rooms/bedroom.jpg",
        mapZone: { x: 79, y: 72 },
        doors: [
            // Was "Downstairs" -> basement-stairway; now leads to the
            // Library instead. The attic is only reachable through the
            // library's hidden passage now (see library.doors above).
            { target: "library", label: "Library", left: "8%", top: "35%", width: "18%", height: "32%" },
            { target: "hallway", label: "Hallway", left: "45%", top: "10%", width: "16%", height: "24%" }
        ],
        characterHotspots: [
            { characterId: "maid", left: "25%", top: "22%", width: "13%", height: "55%" }
        ]
    },

    hallway: {
        id: "hallway",
        label: "Hallway",
        image: "/images/rooms/hallway.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 63, y: 55 },
        doors: [
            { target: "bedroom", label: "Bedroom", left: "8%", top: "35%", width: "16%", height: "32%" },
            { target: "son-bedroom", label: "Son's Bedroom", left: "42%", top: "20%", width: "16%", height: "40%" },
            { target: "powder-room", label: "Powder Room", left: "76%", top: "35%", width: "16%", height: "32%" }
        ],
        characterHotspots: [
            { characterId: "son", left: "58%", top: "20%", width: "13%", height: "55%" }
        ]
    },

    "son-bedroom": {
        id: "son-bedroom",
        label: "Son's Bedroom",
        image: "/images/rooms/son-bedroom.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 42, y: 40 },
        doors: [
            { target: "hallway", label: "Hallway", left: "8%", top: "35%", width: "16%", height: "32%" }
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
            left: "55%",
            top: "50%",
            width: "12%",
            height: "20%",
            maxClicks: 5,
            sound: "/sounds/meow.mp3",
            finalSound: "/sounds/hiss.mp3"
        }
    },

    "powder-room": {
        id: "powder-room",
        label: "Powder Room",
        image: "/images/rooms/powder-room.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 84, y: 40 },
        doors: [
            { target: "hallway", label: "Hallway", left: "8%", top: "35%", width: "16%", height: "32%" }
        ],
        characterHotspots: [
            { characterId: "wife", left: "45%", top: "22%", width: "13%", height: "55%" }
        ]
    },

    "basement-stairway": {
        id: "basement-stairway",
        label: "Stairway to the Basement",
        image: "/images/rooms/basement-stairway.jpg",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 50, y: 72 },
        doors: [
            { target: "bedroom", label: "Back Upstairs", left: "8%", top: "35%", width: "18%", height: "32%" }
        ]
    },

    basement: {
        id: "basement",
        label: "Basement",
        image: "/images/rooms/basement.jpg",
        requiresFlag: "basementUnlocked",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 50, y: 86 },
        doors: [
            { target: "basement-stairway", label: "Leave Basement", left: "8%", top: "35%", width: "18%", height: "32%" }
        ]
    },

    "safe-room": {
        id: "safe-room",
        label: "Inside the Safe",
        image: "/images/rooms/safe-room.jpg",
        // No image yet — will use the standard 1408x768 ratio once added.
        requiresFlag: "safeUnlocked",
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 50, y: 92 },
        doors: [
            { target: "basement", label: "Leave Safe", left: "8%", top: "35%", width: "18%", height: "32%" }
        ]
    },

    attic: {
        id: "attic",
        label: "Attic",
        image: "/images/rooms/attic.jpg",
        // No image yet — will use the standard 1408x768 ratio once added.
        requiresItem: "flashlight",

        // Reusing the room-level requiresFlag mechanism here does two
        // things at once: hides "Attic" from the room dropdown until
        // solved (same as basement/safe-room), AND blocks entry via
        // the dropdown even if someone bypasses the library's door —
        // so the only real way in is through the library passage.
        requiresFlag: "libraryPianoSolved",

        dark: true,
        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 79, y: 50 },
        doors: [
            // The only way back down — matches the library being the
            // only way up.
            { target: "library", label: "Library", left: "8%", top: "50%", width: "18%", height: "32%" }
        ],
        itemHotspots: [
            // iconHotspot: true renders this as the item's actual icon
            // image sitting in the room, rather than a plain dashed
            // text button — see renderItemHotspots() in phone/index.html.
            { placementId: "attic-skull", label: "Take skull", left: "50%", top: "45%", width: "10%", height: "18%", iconHotspot: true }
        ]
    },

    backyard: {
        id: "backyard",
        label: "Backyard",
        image: "/images/rooms/backyard.jpg",
        // No image yet — will use the standard 1408x768 ratio once added.

        // Hidden from the room dropdown until a player actually walks
        // in through the kitchen's door — see hiddenUntilVisited in
        // the docs above.
        hiddenUntilVisited: true,

        // Placeholder position — move this to match your mansion-map.png.
        mapZone: { x: 95, y: 25 },
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
