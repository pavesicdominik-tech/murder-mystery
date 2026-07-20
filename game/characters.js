// ============================================================
// CHARACTER REGISTRY
// ============================================================
// Defines every NPC in the game: their name, the small image that
// stands in a room (clickable), the bigger close-up shown in the
// dialogue popup, an intro line, and a list of questions the player
// can ask.
//
// TO ADD A NEW CHARACTER:
//   1. Add an entry to CHARACTERS below.
//   2. Add a matching characterHotspot to whichever room they stand
//      in, in game/rooms.js (same pattern as itemHotspots).
//   3. Add their images to public/images/characters/.
//   4. Add their ending: `badEndingText` + `badEndingImage` (or, only
//      for the true murderer, `goodEndingText` + `goodEndingImage`) —
//      shown on the ending screen if this character is accused. See
//      server.js's checkAccusationComplete, which reads these.
//
// This is purely cosmetic/dialogue content — nothing here affects
// game state, so no server.js changes are needed to add a character.
//
// isMurderer marks the correct answer for the end-game accusation.
// It is INTENTIONALLY never sent to the browser — see
// getClientCharacters() below, which strips it out. Exactly one
// character should have isMurderer: true.
//
// goodEndingText/goodEndingImage (murderer only) and
// badEndingText/badEndingImage (everyone else accusable) are ALSO
// intentionally left out of getClientCharacters() — same reasoning as
// isMurderer. The browser only learns them through the actual
// accusationResult event once the game has already ended, not through
// the general room/character data available throughout the game
// (which would let someone peek at who's guilty by reading which
// character has "good" ending text in the page's network traffic).
//
// excludeFromSuspects marks a character who should NEVER appear on
// the accusation suspect list, no matter how many times players talk
// to them (see the mysterious-person entry below). server.js's
// interactWithCharacter handler checks this and simply never adds
// them to lobby.interactedCharacters.
// ============================================================

const CHARACTERS = {
    butler: {
        id: "butler",
        name: "Mr. Higgins, the Butler",
        nameHr: "Gospodin Higgins, batler",

        // The small image standing in the room, tappable to open the
        // dialogue popup. Positioned per-room in game/rooms.js.
        roomSprite: "/images/characters/butler-room.png",

        // The bigger portrait shown once the dialogue popup is open.
        closeupImage: "/images/characters/butler-closeup.png",

        introLine: "\"I've served this house for thirty years. Ask what you must, but be quick about it.\"",
        introLineHr: "\"Služim u ovoj kući trideset godina. Pitajte što morate, ali požurite.\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"In the kitchen, polishing the silver until well past midnight. The cook can vouch for me.\""
            },
            {
                id: "victim-relation",
                question: "What was your relation to the victim?",
                answer: "\"I served him breakfast every morning for a decade. He always took his tea black, no sugar.\""
            },
            {
                id: "suspicions",
                question: "Do you suspect anyone in this house?",
                answer: "\"I couldn't possibly say. But the family has always kept... complicated company.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"U kuhinji, glancao sam srebrninu do duboko iza ponoći. Kuharica to može potvrditi.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Posluživao sam mu doručak svako jutro deset godina. Uvijek je pio čaj crn, bez šećera.\""
            },
            {
                id: "suspicions",
                question: "Sumnjate li na nekoga u ovoj kući?",
                answer: "\"Ne bih to mogao reći. Ali obitelj je oduvijek imala... složeno društvo.\""
            }
        ],

        // Unlocked lobby-wide (for every player, not just whoever found
        // it) the moment the safe is discovered — i.e. once the
        // basement picture has been moved aside, reusing
        // lobby.basementPictureMoved rather than a new flag. Kept out
        // of getClientCharacters() below like the Cook's knifeQuestion,
        // so the answer is only ever delivered through the dedicated
        // askButlerAboutSafe round trip.
        safeQuestion: {
            question: "What do you know about the safe?",
            answer: "\"The safe? That would be the master's. I imagine he kept his important documents in there. I don't know the combination myself, but... he always did like to set his numbers to something easy to remember.\""
        },
        safeQuestionHr: {
            question: "Što znate o sefu?",
            answer: "\"Sef? To je gospodarov. Pretpostavljam da je u njemu držao važne dokumente. Ja sam ne znam kombinaciju, ali... uvijek je volio postaviti brojeve koje je lako zapamtiti.\""
        },

        badEndingImage: "/images/endings/butler-ending.png",
        badEndingText: "The household turns as one against Mr. Higgins. He protests his innocence to the very end, but no one is listening anymore. As he is led away in chains, a shadow lingers in the dark halls of the manor — the true killer, still free, still watching.",
        badEndingTextHr: "Cijelo se kućanstvo okreće protiv gospodina Higginsa. Do posljednjeg trena tvrdi da je nevin, ali ga više nitko ne sluša. Dok ga u lancima odvode, sjena se zadržava u tamnim hodnicima dvorca — pravi ubojica, još uvijek slobodan, još uvijek promatra."
    },

    cook: {
        id: "cook",
        name: "Mr. Thomas Ardell, the Cook",
        nameHr: "Gospodin Thomas Ardell, kuhar",
        roomSprite: "/images/characters/cook-room.png",
        closeupImage: "/images/characters/cook-closeup.png",

        // The murderer. Never exposed to the client — see
        // getClientCharacters() below.
        isMurderer: true,

        introLine: "\"Busy night in this kitchen. What do you want to know?\"",
        introLineHr: "\"Naporna večer u ovoj kuhinji. Što želite znati?\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"Right here, same as always. Ask the butler, he was in and out all evening.\""
            },
            {
                id: "victim-relation",
                question: "What was your relation to the victim?",
                answer: "\"I fed the man for fifteen years. Don't read anything into that.\""
            },
            {
                id: "suspicions",
                question: "Do you suspect anyone in this house?",
                answer: "\"I keep to my kitchen. Whatever happens in the rest of this house is none of my concern.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Ovdje, kao i uvijek. Pitajte batlera, cijelu je večer ulazio i izlazio.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Hranio sam tog čovjeka petnaest godina. Nemojte u tome tražiti ništa posebno.\""
            },
            {
                id: "suspicions",
                question: "Sumnjate li na nekoga u ovoj kući?",
                answer: "\"Ja se držim svoje kuhinje. Što god se događa u ostatku kuće, mene se ne tiče.\""
            }
        ],

        // Only askable by a player who currently has the Kitchen Knife
        // in their inventory (see #cookKnifeQuestion in
        // phone/index.html and askCookAboutKnife in server.js).
        // Intentionally left out of getClientCharacters() below, same
        // reasoning as the Mysterious Person's revealedQuestions — the
        // answer is only ever delivered through that dedicated event,
        // not the general character data available all game.
        knifeQuestion: {
            question: "Why is this knife bloody?",
            answer: "\"Oh, that? I prepared a steak for the master earlier tonight. Nothing more sinister than supper, I assure you.\""
        },
        knifeQuestionHr: {
            question: "Zašto je ovaj nož krvav?",
            answer: "\"Oh, to? Pripremao sam odrezak za gospodara ranije večeras. Ništa zlokobnije od večere, uvjeravam vas.\""
        },

        goodEndingImage: "/images/endings/good-ending.png",
        goodEndingText: "The final piece falls into place. Mr. Ardell had been dosing the master's nightly tea for weeks — a slow, deliberate cruelty born of a secret affair with the master's wife, and the fortune that would follow his death. Confronted with the truth, he does not deny it. Justice, at last, is served.",
        goodEndingTextHr: "Zadnji dio slagalice sjeda na svoje mjesto. Gospodin Ardell je tjednima trovao gospodarov večernji čaj — spora, smišljena okrutnost rođena iz tajne veze s gospodarovom suprugom, i bogatstva koje bi uslijedilo nakon njegove smrti. Suočen s istinom, ne poriče. Pravda je, napokon, zadovoljena."
    },

    maid: {
        id: "maid",
        name: "Eliza, the Maid",
        nameHr: "Eliza, sobarica",
        roomSprite: "/images/characters/maid-room.png",
        closeupImage: "/images/characters/maid-closeup.png",
        introLine: "\"I don't have time for questions, I've rooms to clean.\"",
        introLineHr: "\"Nemam vremena za pitanja, moram počistiti sobe.\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"Turning down beds upstairs, same as every night.\""
            },
            {
                id: "victim-relation",
                question: "What was your relation to the victim?",
                answer: "\"I cleaned his room. That's all. He barely knew my name.\""
            },
            {
                id: "suspicions",
                question: "Do you suspect anyone in this house?",
                answer: "\"The cook's been odd lately. Quieter than usual. Make of that what you will.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Namještala sam krevete na katu, kao i svake večeri.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Čistila sam njegovu sobu. To je sve. Jedva je znao moje ime.\""
            },
            {
                id: "suspicions",
                question: "Sumnjate li na nekoga u ovoj kući?",
                answer: "\"Kuharica je u zadnje vrijeme čudna. Tiša nego inače. Zaključite sami što to znači.\""
            }
        ],

        badEndingImage: "/images/endings/maid-ending.png",
        badEndingText: "Eliza weeps as she is dragged from the manor, insisting again and again that she touched nothing but linens and dust. No one believes her. Somewhere in the house, the real murderer breathes a quiet sigh of relief.",
        badEndingTextHr: "Eliza plače dok je izvode iz dvorca, iznova i iznova tvrdeći da nije dirala ništa osim posteljine i prašine. Nitko joj ne vjeruje. Negdje u kući, pravi ubojica tiho odahne od olakšanja."
    },

    wife: {
        id: "wife",
        name: "Mrs. Eleanor Ashworth, the Wife",
        nameHr: "Gospođa Eleanor Ashworth, supruga",
        roomSprite: "/images/characters/wife-room.png",
        closeupImage: "/images/characters/wife-closeup.png",
        introLine: "\"I've buried my husband and now I must entertain questions? Ask them, then, and be done.\"",
        introLineHr: "\"Pokopala sam muža, a sada moram odgovarati na pitanja? Onda pitajte, i završimo s tim.\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"In my room, alone, nursing a headache. No one can vouch for me, if that's what you're really asking.\""
            },
            {
                id: "victim-relation",
                question: "What was your relation to the victim?",
                answer: "\"He was my husband of twenty years. Whatever you think you know about this marriage, you know nothing.\""
            },
            {
                id: "suspicions",
                question: "Do you suspect anyone in this house?",
                answer: "\"This house has always run on secrets. I'd start with whoever handled his food and drink.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"U svojoj sobi, sama, s glavoboljom. Nitko me ne može potvrditi, ako je to ono što zapravo pitate.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Bio je moj muž dvadeset godina. Što god mislite da znate o ovom braku, ne znate ništa.\""
            },
            {
                id: "suspicions",
                question: "Sumnjate li na nekoga u ovoj kući?",
                answer: "\"Ova je kuća oduvijek živjela od tajni. Ja bih počela s onim tko je pripremao njegovu hranu i piće.\""
            }
        ],

        badEndingImage: "/images/endings/wife-ending.png",
        badEndingText: "Mrs. Ashworth is stunned into silence as the accusation lands. Whatever grief she carried for her husband curdles into fury as she's led away. The true killer remains in the house, free to pour another cup of poisoned tea.",
        badEndingTextHr: "Gospođa Ashworth zanijemi kad optužba padne. Kakva god tuga za mužem u njoj tinjala, sada se pretvara u bijes dok je odvode. Pravi ubojica ostaje u kući, slobodan naliti još jednu šalicu otrovanog čaja."
    },

    son: {
        id: "son",
        name: "Charles Ashworth, the Son",
        nameHr: "Charles Ashworth, sin",
        roomSprite: "/images/characters/son-room.png",
        closeupImage: "/images/characters/son-closeup.png",
        introLine: "\"Careful with your questions. This is still my family's house, whatever happens next.\"",
        introLineHr: "\"Pazite s pitanjima. Ovo je i dalje kuća moje obitelji, što god se dalje dogodilo.\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"Out. Does it matter where? I wasn't here, and I certainly wasn't in the kitchen.\""
            },
            {
                id: "victim-relation",
                question: "What was your relation to the victim?",
                answer: "\"He was my father. We didn't agree on much, especially not money, but he was still my father.\""
            },
            {
                id: "suspicions",
                question: "Do you suspect anyone in this house?",
                answer: "\"Everyone in this house had a reason to want him gone. Myself included, if we're being honest.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Vani. Je li bitno gdje? Nisam bio ovdje, a sigurno nisam bio u kuhinji.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Bio je moj otac. Nismo se slagali oko mnogo toga, pogotovo ne oko novca, ali ipak mi je bio otac.\""
            },
            {
                id: "suspicions",
                question: "Sumnjate li na nekoga u ovoj kući?",
                answer: "\"Svatko u ovoj kući imao je razlog željeti da nestane. Uključujući i mene, ako smo iskreni.\""
            }
        ],

        badEndingImage: "/images/endings/son-ending.png",
        badEndingText: "The young heir barely has time to protest before he's seized. His inheritance, once his by right, is the very thing that now condemns him in the eyes of the room. Meanwhile, the actual murderer slips quietly out the back door.",
        badEndingTextHr: "Mladi nasljednik jedva stigne prosvjedovati prije nego što ga uhvate. Njegovo nasljedstvo, nekad njegovo po pravu, sada je upravo ono što ga osuđuje u očima svih. U međuvremenu, pravi ubojica tiho izmiče kroz stražnja vrata."
    },

    "mysterious-person": {
        id: "mysterious-person",
        name: "Mysterious Person",
        nameHr: "Tajanstvena osoba",
        roomSprite: "/images/characters/mysterious-person-room.png",
        closeupImage: "/images/characters/mysterious-person-closeup.png",

        // Shown lobby-wide (everyone, not just the giver) once the
        // skull has been given to him — his appearance itself changes.
        // Safe to send in the general character payload (see
        // getClientCharacters below), since it's just alternate art,
        // not spoiler content — unlike the fields further down.
        roomSpriteAfterSkull: "/images/characters/mysterious-person-room-revealed.png",
        closeupImageAfterSkull: "/images/characters/mysterious-person-closeup-revealed.png",

        // Never appears on the accusation suspect list, no matter how
        // many times players talk to him.
        excludeFromSuspects: true,

        // Shown to ANY player, any number of times, until someone has
        // given him the skull.
        introLine: "\"The manor lord lets me walk his backyard at night. Oh, the things I see...\"",
        introLineHr: "\"Gospodar dvorca dopušta mi da noću šećem njegovim dvorištem. Ah, stvari koje vidim...\"",

        // Shown to any OTHER player once the skull has already been
        // given to someone (i.e. every player except the giver).
        dismissiveLine: "\"I'm not in the mood to talk.\"",
        dismissiveLineHr: "\"Nisam raspoložen za razgovor.\"",

        // ---- Everything below is intentionally NEVER included in
        // getClientCharacters()'s whitelist — only delivered directly
        // to the giver via the mysteriousPersonDialogue event in
        // server.js, once they've actually given him the skull. This
        // is what stops a player from reading the real clue in advance
        // via devtools/network tab. The Hr variants below follow the
        // exact same rule — server.js picks which language to send at
        // the moment of delivery, never both at once. ----

        // The giver's new intro line, replacing the teaser above —
        // followed immediately by the question list below.
        hintIntroLine: "\"...You brought me a gift. Very well, ask what you wish.\"",
        hintIntroLineHr: "\"...Donijeli ste mi dar. Vrlo dobro, pitajte što želite.\"",

        revealedQuestions: [
            {
                id: "victim-relation",
                question: "What do you know about the murder?",
                answer: "\"Ask the cook where they really were the night the master died. The kitchen was dark that night. No candles burned.\""
            },
            {
                id: "who-are-you",
                question: "Who are you, really?",
                answer: "\"Just a wanderer who's seen more of this house's secrets than its own family has.\""
            },
            {
                id: "why-here",
                question: "Why do you linger in this backyard?",
                answer: "\"Old habits. I watched this house long before the killing started, and I'll watch it long after.\""
            }
        ],

        revealedQuestionsHr: [
            {
                id: "victim-relation",
                question: "Što znate o ubojstvu?",
                answer: "\"Pitajte kuharicu gdje je zapravo bila one noći kad je gospodar umro. Kuhinja je te noći bila mračna. Nijedna svijeća nije gorjela.\""
            },
            {
                id: "who-are-you",
                question: "Tko ste vi, zapravo?",
                answer: "\"Samo lutalica koja je vidjela više tajni ove kuće nego njena vlastita obitelj.\""
            },
            {
                id: "why-here",
                question: "Zašto se zadržavate u ovom dvorištu?",
                answer: "\"Stare navike. Promatrao sam ovu kuću davno prije nego što je ubojstvo počelo, i promatrat ću je dugo nakon.\""
            }
        ],

        // Unused (his public dialogue is fully bespoke, driven by the
        // fields above) — kept only so this entry has the same shape
        // as every other character.
        questions: []
    }
};

function getClientCharacters() {
    const clientCharacters = {};

    for (const [id, character] of Object.entries(CHARACTERS)) {
        // isMurderer, excludeFromSuspects, dismissiveLine, hintIntroLine,
        // revealedQuestions, and every ending field are all
        // deliberately left out here — the browser only ever learns
        // them through the actual gameplay events that reveal them
        // (interactWithMysteriousPerson's response, or the
        // accusationResult once the game has ended), not the general
        // room/character data available throughout the game.
        clientCharacters[id] = {
            id: character.id,
            name: character.name,
            nameHr: character.nameHr || null,
            roomSprite: character.roomSprite,
            closeupImage: character.closeupImage,
            roomSpriteAfterSkull: character.roomSpriteAfterSkull || null,
            closeupImageAfterSkull: character.closeupImageAfterSkull || null,
            introLine: character.introLine,
            introLineHr: character.introLineHr || null,
            questions: character.questions,
            questionsHr: character.questionsHr || null
        };
    }

    return clientCharacters;
}

module.exports = { CHARACTERS, getClientCharacters };

