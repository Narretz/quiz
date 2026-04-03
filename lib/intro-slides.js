/**
 * Default intro slides inserted after the quiz title/date slide.
 * German always comes first. {money} is replaced with the configurable jackpot amount.
 */

export const DEFAULT_MONEY = 140;

// Text run helpers for rich formatting in pptxgenjs
// Each run: { text, options: { bold, underline, color, fontSize } }
// null color = use SLIDE_STYLE.textColor (resolved at render time)
const ORANGE = "E69138";
const GREEN = "00FF00";
const GOLD = "FFC000";

export const INTRO_SLIDES = [
  // --- Slide 1: Welcome ---
  {
    id: "welcome",
    title: { text: "Pub Quiz", fontSize: 48, bold: true, color: null },
    subtitle: [
      { text: "Anmeldung/Registration: 19:30-20:05", fontSize: 19, bold: true, color: ORANGE },
      { text: "Start: 20:05-20:15", fontSize: 19, bold: true, color: ORANGE },
    ],
    images: true, // handled specially — logo + two toucans
  },

  // --- Slide 2: Rules & Prizes ---
  {
    id: "rules",
    title: {
      text: "Quiz Regeln und Preise ⬧ Quiz Rules and Prizes",
      fontSize: 30, bold: true, underline: true, color: null, align: "center",
    },
    sections: [
      {
        lang: "de",
        lines: [
          { runs: [{ text: "5 Euro pro Team für die Anmeldung. Sag mir Bescheid, wenn ihr nicht registriert seid!", color: null }] },
          { runs: [
            { text: "5 Fragerunden = ", color: null },
            { text: "Whisky", color: ORANGE, underline: true, fontSize: 21 },
            { text: " und ", color: null },
            { text: "Gewürzgurken", color: GREEN, bold: true, underline: true, fontSize: 19 },
            { text: " als Preis", color: null },
          ]},
          { runs: [{ text: "+", color: null }] },
          { runs: [
            { text: "4 Jackpot-Fragen = ca. ", color: null },
            { text: "{money} € + Geld von heute!", color: GOLD, bold: true, fontSize: 20 },
          ]},
        ],
      },
      {
        lang: "en",
        lines: [
          { runs: [{ text: "5 Euros per team to register. Let me know if you're not registered!", color: null }] },
          { runs: [
            { text: "5 Rounds of questions = ", color: null },
            { text: "Whiskey", color: ORANGE, underline: true, fontSize: 21 },
            { text: " and ", color: null },
            { text: "pickles", color: GREEN, bold: true, underline: true, fontSize: 21 },
            { text: " prize", color: null },
          ]},
          { runs: [{ text: "+", color: null }] },
          { runs: [
            { text: "4 Jackpot questions = ca. ", color: null },
            { text: "{money} € + money from today!", color: GOLD, bold: true, fontSize: 20 },
          ]},
        ],
      },
    ],
    defaultFontSize: 18,
  },

  // --- Slide 3: Quiz Format ---
  {
    id: "format",
    title: {
      text: "Quiz Format",
      fontSize: 32, underline: true, color: null, align: "center", fontFace: "Impact",
    },
    sections: [
      {
        lang: "de",
        bullet: "●",
        lines: [
          { runs: [{ text: "5", bold: true }, { text: " Runden mit " }, { text: "10", bold: true }, { text: " Fragen" }] },
          { runs: [{ text: "50", bold: true }, { text: " Fragen insgesamt" }] },
          { runs: [{ text: "Deutsche und englische Antworten sind in Ordnung; Rechtschreibung ist nicht so wichtig" }] },
          { runs: [{ text: "Spielstände nach den Pausen" }] },
          { runs: [{ text: "10 min Pausen: zur Halbzeit + vor Jackpot" }] },
          { runs: [{ text: "Ihr tauscht zweimal die Blätter aus (nach 20 und 50 Fragen). Ein anderes Team wird eure Papiere bewerten und sie mir vor der Pause übergeben. Wenn ihr Unstimmigkeiten habt, sagt Bescheid!" }] },
        ],
      },
      {
        lang: "en",
        bullet: "●",
        lines: [
          { runs: [{ text: "5", bold: true }, { text: " rounds with " }, { text: "10", bold: true }, { text: " questions" }] },
          { runs: [{ text: "50", bold: true }, { text: " questions total" }] },
          { runs: [{ text: "English and German answers are okay, correct spelling is not super important" }] },
          { runs: [{ text: "Scores after the breaks" }] },
          { runs: [{ text: "10 min breaks: halftime + before Jackpot" }] },
          { runs: [{ text: "You swap papers twice during the quiz (after 20 and 50 questions). Another team will score your sheets and hand them to me before the break. If you have concerns afterwards, just let me know!" }] },
        ],
      },
    ],
    defaultFontSize: 18,
    defaultColor: null,
  },

  // --- Slide 4: Golden Rules ---
  {
    id: "golden-rules",
    title: {
      text: "2 goldene Regeln ⬧ 2 golden rules",
      fontSize: 30, bold: true, underline: true, color: null, align: "center",
    },
    rules: [
      { de: "1. Der Quizmaster hat immer recht", en: "1. The quizmaster is always right" },
      { de: "2. Keine Handys", en: "2. No Cell Phones" },
    ],
    ruleFontSize: 24,
    ruleColor: null,
  },

  // --- Slide 5: Let Us Begin ---
  {
    id: "begin",
    lines: [
      { text: "Lasst uns anfangen!", fontSize: 24, bold: true, color: null },
      { text: "Let us begin!", fontSize: 24, bold: true, color: null },
    ],
    align: "center",
  },
];
