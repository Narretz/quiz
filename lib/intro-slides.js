/**
 * Default intro slides inserted after the quiz title/date slide.
 * German always comes first. {money} is replaced with the configurable jackpot amount.
 */

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
    style: "welcome",
    title: { text: "Pub Quiz", fontSize: 48, bold: true, color: "FFFFFF" },
    titleY: "72%",
    subtitle: [
      { text: "Anmeldung/Registration: 19:30-20:05", fontSize: 19, bold: true, color: ORANGE },
      { text: "Start: 20:05-20:15", fontSize: 19, bold: true, color: ORANGE },
    ],
    subtitleY: "86%",
    toucan: { x: 0.5, y: 0.3, w: 1.1, h: 1.7 },
  },

  // --- Slide 2: Rules & Prizes ---
  {
    id: "rules",
    style: "rules",
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
            { text: "Whiskey", color: ORANGE, underline: true, bold: true, fontSize: 21 },
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
            { text: "Whiskey", color: ORANGE, underline: true, bold: true, fontSize: 21 },
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
    defaultFontSize: 19,
    titleY: 0.2,
    sectionStartY: 0.9,
    sectionGap: 2.5,
    lineHeight: 0.4,
  },

  // --- Slide 3: Quiz Format ---
  {
    id: "format",
    style: "format",
    title: {
      text: "Quiz Format",
      fontSize: 30, bold: true, underline: true, color: null, align: "center",
    },
    sections: [
      {
        lang: "de",
        bullet: "●",
        lines: [
          { runs: [{ text: "5", bold: true }, { text: " Runden mit " }, { text: "10", bold: true }, { text: " Fragen, " }, { text: "50", bold: true }, { text: " Fragen insgesamt" }] },
          { runs: [{ text: "Deutsche und englische Antworten sind in Ordnung; Rechtschreibung ist nicht so wichtig" }] },
          { runs: [{ text: "Ihr tauscht zweimal die Blätter aus (nach 20 und 50 Fragen). Ein anderes Team wird eure Papiere korrigieren und sie mir vor der Pause übergeben. Wenn ihr Unstimmigkeiten habt, sagt Bescheid!" }] },
          { runs: [{ text: "10 min Pausen: zur Halbzeit + vor Jackpot. " }, { text: "Spielstände nach den Pausen" }] },
        ],
      },
      {
        lang: "en",
        bullet: "●",
        lines: [
          { runs: [{ text: "5", bold: true }, { text: " rounds with " }, { text: "10", bold: true }, { text: " questions, " }, { text: "50", bold: true }, { text: " questions total" }] },
          { runs: [{ text: "English and German answers are okay, correct spelling is not super important" }] },
          { runs: [{ text: "You swap papers twice during the quiz (after 20 and 50 questions). Another team will score your sheets and hand them to me before the break. If you have concerns afterwards, just let me know!" }] },
          { runs: [{ text: "10 min breaks: halftime + before Jackpot. " }, { text: "Scores after the breaks" }] },
        ],
      },
    ],
    defaultFontSize: 18,
    defaultColor: null,
    titleY: 0.2,
    sectionStartY: 0.8,
    sectionGap: 2.5,
    lineHeight: 0.35,
    contentPad: 0.2,
  },

  // --- Slide 4: Golden Rules ---
  {
    id: "golden-rules",
    style: "golden-rules",
    title: {
      text: "2 goldene Regeln ⬧ 2 golden rules",
      fontSize: 30, bold: true, underline: true, color: null, align: "center",
    },
    rules: [
      "1. Der Quizmaster hat meistens immer recht ⬧ The quizmaster is mostly always right",
      "2. Keine Handys (Taschenrechner erlaubt) ⬧ No Cell Phones (calculators are fine)",
    ],
    ruleFontSize: 23,
    ruleColor: null,
    titleY: 0.2,
    rulesStartY: 1.3,
    ruleHeight: 1.0,
  },

  // --- Slide 5: Let Us Begin ---
  {
    id: "begin",
    style: "begin",
    lines: [
      { text: "Lasst uns anfangen!", fontSize: 24, bold: true, color: null },
      { text: "Let us begin!", fontSize: 24, bold: true, color: null },
    ],
    align: "center",
  },
];

/**
 * Extra slides inserted at specific positions in the quiz flow
 * (jackpot break, prizes, no-phones, goodbye).
 * Same rendering system as INTRO_SLIDES — dispatched by `style` field.
 */
export const EXTRA_SLIDES = {
  // --- Break 1 (after section 1 answers) ---
  "break-1": {
    id: "break-1",
    style: "begin",
    lines: [
      { text: "Pause ⬧ Break", fontSize: 40, bold: true, color: null },
      { text: "Wir sehen uns in 10 Minuten.", fontSize: 20, color: null, marginTop: 0.2 },
      { text: "See you in 10 minutes.", fontSize: 20, color: null, marginTop: 0.1 },
    ],
  },

  // --- Points (after break 1) ---
  "points": {
    id: "points",
    style: "begin",
    lines: [
      { text: "Lasst uns auf die Punkte schauen!", fontSize: 30, bold: true, color: null },
      { text: "Let us look at the points!", fontSize: 30, bold: true, color: null, marginTop: 0.15 },
    ],
  },

  // --- Break 2 / Jackpot Break (after section 2 answers) ---
  "break-2": {
    id: "break-2",
    style: "begin",
    lines: [
      { text: "Pause ⬧ Break", fontSize: 40, bold: true, color: null },
      { text: "Die letzte Chance für euch, noch einmal Wissen für den Jackpot zu sammeln oder euch Mut anzutrinken. Wir sehen uns in 10 Minuten.", fontSize: 20, color: null, marginTop: 0.2 },
      { text: "The last chance for you to collect knowledge for the jackpot once again or to take courage. See you in 10 minutes.", fontSize: 20, color: null, marginTop: 0.1 },
    ],
  },

  // --- Prizes (after jackpot break) ---
  "prizes": {
    id: "prizes",
    style: "rules",
    title: {
      text: "Preise ⬧ Prizes",
      fontSize: 30, bold: true, underline: true, color: null, align: "center",
    },
    sections: [
      {
        lang: "en",
        lines: [
          { runs: [{ text: "Give me a moment to tally the score sheets and announce a winner.", color: null }] },
          { runs: [
            { text: "First place", underline: true, color: null },
            { text: " - Bottle of ", color: null },
            { text: "Whiskey", color: ORANGE, bold: true, underline: true },
          ]},
          { runs: [
            { text: "(Almost first) ", color: null },
            { text: "Last place", underline: true, color: null },
            { text: " - Jar of ", color: null },
            { text: "pickles", color: GREEN, bold: true, underline: true },
          ]},
        ],
      },
      {
        lang: "de",
        lines: [
          { runs: [{ text: "Gebt mir einen Moment Zeit, um die Punkte zusammenzuzählen und einen Gewinner zu verkünden.", color: null }] },
          { runs: [
            { text: "Erster", underline: true, color: null },
            { text: " Platz - Flasche ", color: null },
            { text: "Whiskey", color: ORANGE, bold: true, underline: true },
          ]},
          { runs: [
            { text: "(Fast der erste) ", color: null },
            { text: "Letzter", underline: true, color: null },
            { text: " Platz - Glas ", color: null },
            { text: "Gewürzgurken", color: GREEN, bold: true, underline: true },
          ]},
        ],
      },
    ],
    defaultFontSize: 22,
    titleY: 0.2,
    sectionStartY: 0.8,
    sectionGap: 2.5,
    lineHeight: 0.5,
  },

  // --- NO PHONES! (before jackpot questions) ---
  "no-phones": {
    id: "no-phones",
    style: "begin",
    lines: [
      { text: "NO PHONES!", fontSize: 50, bold: true, color: "FF0000" },
    ],
  },

  // --- Goodbye (after jackpot answers) ---
  "goodbye": {
    id: "goodbye",
    style: "rules",
    title: {
      text: "Bis nächste Woche! ⬧ See you again next week!",
      fontSize: 30, bold: true, underline: true, color: null, align: "center",
    },
    sections: [
      {
        lang: "de",
        lines: [
          { runs: [{ text: "Wenn ihr Tipps oder Kommentare habt, gebt mir bitte Bescheid! Und wenn ihr eine Gastrunde machen möchtet, lasst es mich wissen!" }] },
        ],
      },
      {
        lang: "en",
        lines: [
          { runs: [{ text: "Do you have any comments, tips, or want to make a guest round? Let me know!" }] },
        ],
      },
      {
        lines: [
          { runs: [{ text: "Danke! ⬧ Thank you!", bold: true }] },
          { runs: [{ text: "{email}" }], showIf: "email" },
        ],
      },
    ],
    defaultFontSize: 19,
    titleY: 0.2,
    sectionStartY: 1.2,
    sectionGap: 0.8,
    lineHeight: 0.4,
  },
};
