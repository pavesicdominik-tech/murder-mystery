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
//
// ============================================================
// EXTRA (HIDDEN) QUESTIONS
// ============================================================
// Several characters below have one or two extra questions beyond
// their standard three — these only appear once a specific "unlock"
// condition has happened *somewhere* in the lobby (not necessarily to
// the asking player themselves — this game's suspect list/safe
// question/knife question all already work the same cooperative way:
// once anyone on the team makes progress, everyone benefits from it).
// Each extra question is kept OUT of getClientCharacters()'s
// whitelist, same reasoning as knifeQuestion/safeQuestion below — the
// answer is only ever delivered through its own dedicated server.js
// event, once the unlock condition is actually met, so it can't be
// read early via devtools/network tab.
//
// A couple of these also have a SECOND possible answer depending on
// whether the specific asking player currently holds a particular
// item — same mechanic as the Cook's existing knifeQuestion, just
// applied to a new set of questions. server.js picks which variant to
// send at the moment of asking; the client never receives both.
// ============================================================

const CHARACTERS = {
    butler: {
        id: "butler",
        name: "Mr. Higgins, the Butler",
        nameHr: "Gospodin Higgins, batler",
        roomSprite: "/images/characters/butler-room.png",
        closeupImage: "/images/characters/butler-closeup.png",

        introLine: "\"I've served this house for thirty years. Ask what you must, but be quick about it.\"",
        introLineHr: "\"Služim u ovoj kući trideset godina. Pitajte što morate, ali požurite.\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"I was serving tea to the master when I heard a loud noise in the hallway. I found him downstairs. I tried to help, but it was too late.\""
            },
            {
                id: "victim-relation",
                question: "What was your relationship with the victim?",
                answer: "\"I was loyal to the master. He always treated me with respect.\""
            },
            {
                id: "suspicions",
                question: "Did anything unusual happen last night?",
                answer: "\"The master insisted on dining alone. I assume he and the missus had an argument.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Posluživao sam gospodaru čaj kad sam začuo glasan zvuk u hodniku. Pronašao sam ga dolje. Pokušao sam pomoći, ali bilo je prekasno.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Bio sam odan gospodaru. Uvijek me tretirao s poštovanjem.\""
            },
            {
                id: "suspicions",
                question: "Je li se sinoć dogodilo nešto neobično?",
                answer: "\"Gospodar je inzistirao da večera sam. Pretpostavljam da su se on i gospođa posvađali.\""
            }
        ],

        // Unlocked lobby-wide the moment the safe is discovered — i.e.
        // once the basement boxes have been moved aside, reusing
        // lobby.basementPictureMoved rather than a new flag.
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
                answer: "\"I was in the kitchen, preparing the master's dinner.\""
            },
            {
                id: "victim-relation",
                question: "What was your relationship with the victim?",
                answer: "\"I only cooked for him and his family. Mrs. Ashworth usually tells me what to prepare for their meals.\""
            },
            {
                id: "suspicions",
                question: "Did anything unusual happen last night?",
                answer: "\"I heard the maid crying before dinner.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Bio sam u kuhinji, pripremao sam gospodarovu večeru.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Kuhao sam samo za njega i njegovu obitelj. Gospođa Ashworth mi obično kaže što da pripremim za njihove obroke.\""
            },
            {
                id: "suspicions",
                question: "Je li se sinoć dogodilo nešto neobično?",
                answer: "\"Čuo sam sobaricu kako plače prije večere.\""
            }
        ],

        // Only askable by a player who currently has the Kitchen Knife
        // in their inventory.
        knifeQuestion: {
            question: "Why is this knife bloody?",
            answer: "\"Oh, that? I prepared a steak for the master earlier tonight. Nothing more sinister than supper, I assure you.\""
        },
        knifeQuestionHr: {
            question: "Zašto je ovaj nož krvav?",
            answer: "\"Oh, to? Pripremao sam odrezak za gospodara ranije večeras. Ništa zlokobnije od večere, uvjeravam vas.\""
        },

        // Unlocked lobby-wide once anyone has given the Mysterious
        // Person the skull (see lobby.skullGivenBy in server.js) —
        // "talking to" him only really becomes a conversation once
        // he's actually revealed something, which requires the skull.
        backyardWatcherQuestion: {
            question: "Did you see anyone going into the backyard?",
            answer: "\"I was in the kitchen all night. I didn't see anyone go into the backyard.\""
        },
        backyardWatcherQuestionHr: {
            question: "Jeste li vidjeli nekoga kako ulazi u dvorište?",
            answer: "\"Bio sam u kuhinji cijelu noć. Nisam vidio nikoga da ulazi u dvorište.\""
        },

        // Unlocked lobby-wide once the Wife has confessed (to anyone)
        // that she was in the backyard with the cook — see
        // lobby.wifeConfessedAboutCook, set in server.js the moment
        // that confession is actually given.
        wifeInBackyardQuestion: {
            question: "What were you doing in the backyard with Mrs. Ashworth?",
            answer: "\"We just talked, as we usually do. Mr. Ashworth didn't treat her right. She deserves a better husband.\""
        },
        wifeInBackyardQuestionHr: {
            question: "Što ste radili u dvorištu s gospođom Ashworth?",
            answer: "\"Samo smo razgovarali, kao i inače. Gospodin Ashworth se nije lijepo ponašao prema njoj. Zaslužuje boljeg muža.\""
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
                answer: "\"I was dusting the library.\""
            },
            {
                id: "victim-relation",
                question: "What was your relationship with the victim?",
                answer: "\"I had only been working for him for a couple of weeks. I didn't know him very well.\""
            },
            {
                id: "suspicions",
                question: "Did anything unusual happen last night?",
                answer: "\"After dinner, he lay down and said he wasn't feeling well.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Brisala sam prašinu u knjižnici.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Radila sam za njega tek nekoliko tjedana. Nisam ga dobro poznavala.\""
            },
            {
                id: "suspicions",
                question: "Je li se sinoć dogodilo nešto neobično?",
                answer: "\"Nakon večere je legao i rekao da se ne osjeća dobro.\""
            }
        ],

        // Unlocked lobby-wide once anyone has talked to the Cook.
        cryingQuestion: {
            question: "Why were you crying last night?",
            answer: "\"The master told me he was going to fire me. Apparently, he wasn't satisfied with how well I'd been cleaning the rooms.\""
        },
        cryingQuestionHr: {
            question: "Zašto ste sinoć plakali?",
            answer: "\"Gospodar mi je rekao da će me otpustiti. Očito nije bio zadovoljan koliko dobro čistim sobe.\""
        },

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
        introLine: "\"I just needed to freshen up, this was a terrible accident.\"",
        introLineHr: "\"Samo sam se trebala osvježiti, ovo je bila užasna nesreća.\"",

        questions: [
            {
                id: "alibi",
                question: "Where were you last night?",
                answer: "\"I was in the backyard. I needed some time alone.\""
            },
            {
                id: "victim-relation",
                question: "What was your relationship with the victim?",
                answer: "\"He was my husband. The spark between us had long faded, but I would never wish him any harm.\""
            },
            {
                id: "suspicions",
                question: "Did anything unusual happen last night?",
                answer: "\"My husband stormed out of our son's bedroom, looking furious.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"Bila sam u dvorištu. Trebala sam malo vremena za sebe.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Bio je moj muž. Iskra među nama odavno je izblijedjela, ali nikad mu ne bih poželjela zlo.\""
            },
            {
                id: "suspicions",
                question: "Je li se sinoć dogodilo nešto neobično?",
                answer: "\"Moj muž je izjurio iz sinove sobe, izgledao je bijesno.\""
            }
        ],

        // Unlocked lobby-wide once anyone has talked to the Butler.
        argumentQuestion: {
            question: "What did you argue about with your husband?",
            answer: "\"He mentioned divorce. I didn't agree with it.\""
        },
        argumentQuestionHr: {
            question: "Oko čega ste se posvađali sa suprugom?",
            answer: "\"Spomenuo je razvod. Nisam se s time slagala.\""
        },

        // Unlocked lobby-wide once anyone has given the Mysterious
        // Person the skull. The answer itself has two variants — see
        // askWifeAboutBackyard in server.js, which checks whether the
        // ASKING player currently holds the Burned Note.
        backyardCompanionQuestion: {
            question: "Who were you with in the backyard?",
            answer: "\"M-Me? No one. I told you, I was alone.\""
        },
        backyardCompanionQuestionHr: {
            question: "S kim ste bili u dvorištu?",
            answer: "\"J-Ja? Nitko. Rekla sam vam, bila sam sama.\""
        },
        backyardCompanionConfession: "\"Fine, I was with the cook, talking. At least he listens and understands me.\"",
        backyardCompanionConfessionHr: "\"Dobro, bila sam s kuharom, razgovarali smo. Barem me on sluša i razumije.\"",

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
                answer: "\"In my room, reading.\""
            },
            {
                id: "victim-relation",
                question: "What was your relationship with the victim?",
                answer: "\"He was a difficult man, but he was still my father.\""
            },
            {
                id: "suspicions",
                question: "Did anything unusual happen last night?",
                answer: "\"I heard a noise outside my room. When I looked, I saw my father lying downstairs with the butler beside him.\""
            }
        ],

        questionsHr: [
            {
                id: "alibi",
                question: "Gdje ste bili sinoć?",
                answer: "\"U svojoj sobi, čitao sam.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je bio vaš odnos sa žrtvom?",
                answer: "\"Bio je težak čovjek, ali ipak mi je bio otac.\""
            },
            {
                id: "suspicions",
                question: "Je li se sinoć dogodilo nešto neobično?",
                answer: "\"Čuo sam buku ispred svoje sobe. Kad sam pogledao, vidio sam oca kako leži dolje, a batler je bio pored njega.\""
            }
        ],

        // Unlocked lobby-wide once anyone has talked to the Wife. The
        // answer itself has two variants — see askSonAboutFather in
        // server.js, which checks whether the ASKING player currently
        // holds the Wrinkled Note (the debt notice from his bedroom).
        fatherArgumentQuestion: {
            question: "Why did your father storm out of your room?",
            answer: "\"We had an argument. He threatened to remove me from his will, then left my room.\""
        },
        fatherArgumentQuestionHr: {
            question: "Zašto je vaš otac izjurio iz vaše sobe?",
            answer: "\"Posvađali smo se. Prijetio je da će me izbrisati iz oporuke, a zatim je izašao iz moje sobe.\""
        },
        fatherArgumentConfession: "\"My father found out about my debt. He threatened to remove me from his will, then left my room.\"",
        fatherArgumentConfessionHr: "\"Moj je otac saznao za moj dug. Prijetio je da će me izbrisati iz oporuke, a zatim je izašao iz moje sobe.\"",

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

        roomSpriteAfterSkull: "/images/characters/mysterious-person-room-revealed.png",
        closeupImageAfterSkull: "/images/characters/mysterious-person-closeup-revealed.png",

        excludeFromSuspects: true,

        introLine: "\"The manor lord lets me walk his backyard at night. Oh, the things I see...\"",
        introLineHr: "\"Gospodar dvorca dopušta mi da noću šećem njegovim dvorištem. Ah, stvari koje vidim...\"",

        dismissiveLine: "\"I'm not in the mood to talk.\"",
        dismissiveLineHr: "\"Nisam raspoložen za razgovor.\"",

        hintIntroLine: "\"...You brought me a gift. Very well, ask what you wish.\"",
        hintIntroLineHr: "\"...Donijeli ste mi dar. Vrlo dobro, pitajte što želite.\"",

        revealedQuestions: [
            {
                id: "what-doing-here",
                question: "What are you doing here?",
                answer: "\"Listening to the creatures of the night. It's a full moon — maybe you should go back in the house.\""
            },
            {
                id: "victim-relation",
                question: "What is your relation to the victim?",
                answer: "\"Mr. Ashworth let me walk around his backyard at night. I'm not interested in entering his house, though.\""
            },
            {
                id: "unusual-night",
                question: "Did you see anything unusual last night?",
                answer: "\"You see many strange things when wandering at night, like seeing Mrs. Ashworth with some man at midnight.\""
            }
        ],

        revealedQuestionsHr: [
            {
                id: "what-doing-here",
                question: "Što radite ovdje?",
                answer: "\"Slušam noćna stvorenja. Pun je mjesec — možda biste se trebali vratiti u kuću.\""
            },
            {
                id: "victim-relation",
                question: "Kakav je vaš odnos sa žrtvom?",
                answer: "\"Gospodin Ashworth mi je dopuštao da šećem njegovim dvorištem noću. Ipak, ne zanima me ulazak u njegovu kuću.\""
            },
            {
                id: "unusual-night",
                question: "Jeste li sinoć vidjeli nešto neobično?",
                answer: "\"Čovjek vidi mnogo čudnih stvari dok luta noću, poput gospođe Ashworth s nekim muškarcem u ponoć.\""
            }
        ],

        questions: []
    }
};

function getClientCharacters() {
    const clientCharacters = {};

    for (const [id, character] of Object.entries(CHARACTERS)) {
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
