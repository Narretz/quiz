/**
 * Shared quiz logic — no Node-specific imports.
 * Used by both CLI (parse-quiz.js, generate-pptx.js) and browser (index.html).
 */

import { INTRO_SLIDES, EXTRA_SLIDES } from "./lib/intro-slides.js";

/**
 * jackpot size when it was just cracked: 10 teams, each 5€ entry fee
 * @type {Number}
 */
export const DEFAULT_MONEY = 50;

/** Slide dimensions and font sizes — single source of truth for PPTX and preview. */
export const SLIDE_STYLE = {
  width: 10,       // inches (LAYOUT_16x9)
  height: 5.625,   // inches
  pad: 0.2,        // gap between elements (inches)
  // backgroundColor: "#FFFFFF",
  // backgroundColor: "#13700c", // classic
  backgroundColor: "#11650b", // bit darker than classic
  // textColor: "#000000",
  textColor: "#FCFCFC",
  title:    { fontSize: 40 },
  num:      { fontSize: 23 },
  question: { fontSize: 20, lineSpacing: 110 },
  answer:   { fontSize: 20, color: '#FFFFFF', backgroundColor: '#CC0000' },
};

export const AUDIO_DIMENSIONS = { width: 280, height: 80 };

/**
 * Effective click-to-reveal state for an answer slide.
 * Jackpot answer descriptors default to on (desc.jackpot); user can override via `reveals[slideKey]`.
 */
export function isRevealEffective(reveals, desc) {
  if (!desc || desc.type !== "question" || !desc.withAnswers) return false;
  const explicit = reveals?.[`${desc.id}:1`];
  return explicit == null ? !!desc.jackpot : !!explicit;
}

export function formatAnswer(q) {
  const de = (q.answers.de || "").trim();
  const en = (q.answers.en || "").trim();
  if (!de && !en) return "";
  if (!en || de === en) return de;
  if (!de) return en;
  return `${de} ⬧ ${en}`;
}


/**
 * Compute image position and text widths based on image aspect ratio.
 * Images entry: { data, width, height }.
 * Returns { mode, img: {x,y,w,h}, deW, enW, answerW } in inches.
 */
/** Contain-fit: largest size maintaining aspect ratio within a box. */
export function fit(boxW, boxH, ar) {
  return ar > boxW / boxH
    ? { w: boxW, h: boxW / ar }
    : { w: boxH * ar, h: boxH };
}

export function computeImageLayout(aspectRatio) {
  const { width: W, height: H, pad } = SLIDE_STYLE;
  const fullW = W - 2 * pad;

  if (aspectRatio < 1) {
    // Portrait: right 30%, full height
    const { w, h } = fit(W * 0.3, H - 2 * pad, aspectRatio);
    const imgX = W - pad - w;
    const textW = imgX - 2 * pad;
    return {
      mode: "portrait",
      img: { x: imgX, y: (H - h) / 2, w, h },
      deW: textW, enW: textW, answerW: textW,
    };
  }
  if (aspectRatio <= 2) {
    // Square/Landscape: bottom-right, 60% width, 50% height (60% for square)
    const boxH = aspectRatio === 1 ? H * 0.6 : H * 0.5;
    const { w, h } = fit(W * 0.6, boxH, aspectRatio);
    const imgX = W - pad - w;
    const narrowW = imgX - 2 * pad;
    return {
      mode: "landscape",
      img: { x: imgX, y: H - pad - h, w, h },
      deW: fullW, enW: narrowW, answerW: narrowW,
    };
  }
  // Ultra-wide (>2:1): bottom, full width, 30% height
  const { w, h } = fit(fullW, H * 0.3, aspectRatio);
  return {
    mode: "ultrawide",
    img: { x: (W - w) / 2, y: H - pad - h, w, h },
    deW: fullW, enW: fullW, answerW: fullW,
  };
}

/** Return [img0, img1] for a slide key, where either may be null. */
export function getSlideImages(images, slideKey) {
  return [images[slideKey] || null, images[slideKey + ":1"] || null];
}

/** Side-by-side layout for two images at bottom of slide. heightFrac controls image area (default 0.45). */
export function computeTwoImageLayout(ar0, ar1, heightFrac = 0.45) {
  const { width: W, height: H, pad } = SLIDE_STYLE;
  const fullW = W - 2 * pad;
  const gap = pad;
  const boxW = (fullW - gap) / 2;
  const boxH = H * heightFrac;
  const topY = H - pad - boxH;

  const img0 = fit(boxW, boxH, ar0);
  const img1 = fit(boxW, boxH, ar1);

  return {
    mode: "two-images",
    img0: { x: pad + (boxW - img0.w) / 2, y: topY + (boxH - img0.h) / 2, w: img0.w, h: img0.h },
    img1: { x: pad + boxW + gap + (boxW - img1.w) / 2, y: topY + (boxH - img1.h) / 2, w: img1.w, h: img1.h },
    deW: fullW, enW: fullW, answerW: fullW,
    textBottomLimit: topY - pad,
  };
}

/**
 * Returns the live round name: descriptor-edited title if present, else the
 * upload-time name from quiz.rounds, else a generic fallback.
 * `quiz` is the snapshot; edits live in `descriptors`.
 */
export function getRoundName(descriptors, quiz, ri) {
  const desc = descriptors?.find((d) => d.id === `title-r${ri}`);
  const edited = desc?.text?.de?.trim();
  if (edited) return edited;
  const original = quiz?.rounds?.[ri]?.name?.trim();
  if (original) return original;
  return `Round ${ri + 1}`;
}

/**
 * Count question slides and how many have content on the question / answer side.
 * Question side: text OR media on the question slide.
 * Answer side: text OR media distinct from the question side (mere auto-linked
 * copies don't count, matching the validator's ANSWER_NO_TEXT_NO_DISTINCT_MEDIA
 * logic).
 * Each question has two descriptors (question-phase + answer-phase), counted once.
 */
export function getQuizStats(descriptors, questions, images) {
  let total = 0;
  let questionsFilled = 0;
  let answersFilled = 0;
  for (const d of descriptors) {
    if (d.type !== "question" || d.withAnswers) continue;
    total++;
    const q = questions?.[d.id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
    const qKey = `${d.id}:0`;
    const aKey = `${d.id}:1`;
    const qHasText = !!(q.text?.de?.trim() || q.text?.en?.trim());
    const qHasMedia = !!(images?.[qKey] || images?.[`${qKey}:1`]);
    if (qHasText || qHasMedia) questionsFilled++;
    const aHasText = !!(q.answers?.de?.trim() || q.answers?.en?.trim());
    const a0 = images?.[aKey]?.data;
    const a1 = images?.[`${aKey}:1`]?.data;
    const q0 = images?.[qKey]?.data;
    const q1 = images?.[`${qKey}:1`]?.data;
    const aHasDistinctMedia = (a0 && a0 !== q0) || (a1 && a1 !== q1);
    if (aHasText || aHasDistinctMedia) answersFilled++;
  }
  return { total, questionsFilled, answersFilled };
}

export function extractQuestions(quiz) {
  const questions = {};
  quiz.rounds.forEach((round, ri) => {
    round.questions.forEach((q, qi) => {
      questions[`r${ri}q${qi}`] = { text: { ...q.text }, answers: { ...q.answers } };
    });
  });
  return questions;
}

export function mergeAudioIntoImages(images, audio) {
  if (!audio || !Object.keys(audio).length) return images;
  const merged = { ...images };
  for (const [key, audioData] of Object.entries(audio)) {
    if (!merged[key]) {
      merged[key] = { ...audioData, ...AUDIO_DIMENSIONS, type: "audio" };
    } else if (!merged[key + ":1"]) {
      merged[key + ":1"] = { ...audioData, ...AUDIO_DIMENSIONS, type: "audio" };
    }
  }
  return merged;
}

export function normalizeSavedQuiz(saved) {
  const questions = saved.questions || extractQuestions(saved.quiz);
  const descriptors = saved.descriptors
    ? saved.descriptors.map((d) => {
        if (d.type === "question" && d.id?.startsWith("r5q") && !("jackpot" in d))
          return { ...d, jackpot: true };
        if (d.type === "title" && typeof d.text === "string")
          return {
            ...d,
            text: { de: d.text, en: "" },
            subtitle: typeof d.subtitle === "string" ? { de: d.subtitle, en: "" } : d.subtitle,
          };
        return d;
      })
    : buildSlideDescriptors(saved.quiz);
  const style = saved.style ? {
    fontSize: saved.style.fontSize,
    lineSpacing: saved.style.lineSpacing,
    backgroundColor: saved.style.backgroundColor || "#FFFFFF",
    textColor: saved.style.textColor || "#000000",
  } : null;
  const images = mergeAudioIntoImages(saved.images || {}, saved.audio);
  return {
    quiz: saved.quiz,
    images,
    questions,
    manualOverrides: saved.manualOverrides || {},
    reveals: saved.reveals || {},
    descriptors,
    style,
    jackpotSize: saved.jackpotSize || 0,
    email: saved.email || "",
    showValidation: !!saved.showValidation,
  };
}

/**
 * Validates a parsed quiz has the expected 6-round shape and fills each round
 * up to its target question count with empty questions. Having fewer questions
 * than expected is fine (they get filled). Having MORE than the target is an
 * error the user must fix in the xlsx. Call after astToQuiz on upload; the
 * parser itself stays pure so unit tests can check isolated parsing behaviors
 * with smaller fixtures.
 *
 * Target question counts:
 *   rounds 1-4: 10
 *   round 5 (Name 10): 1
 *   round 6 (Jackpot): 4
 */
export function normalizeQuizStructure(quiz) {
  const rounds = quiz?.rounds || [];
  if (rounds.length !== 6) {
    const summary = rounds.map((r) => `"${r.name}" (${r.questions.length} q)`).join(", ") || "(none)";
    throw new Error(
      `Expected 6 rounds, found ${rounds.length}: ${summary}. ` +
      `Check that each round starts with a bold title row.`
    );
  }
  const targets = [10, 10, 10, 10, 1, 4];
  for (let i = 0; i < 6; i++) {
    const r = rounds[i];
    const n = r.questions.length;
    const target = targets[i];
    if (n > target) {
      throw new Error(
        `Round ${i + 1} ("${r.name}") has ${n} questions; expected at most ${target}.`
      );
    }
    while (r.questions.length < target) {
      r.questions.push({ text: { de: "", en: "" }, answers: { de: "", en: "" } });
    }
  }
}

export function astToQuiz(ast) {
  const sheet =
    ast.content.find((s) => s.metadata.sheetName === "Tabelle1") ??
    ast.content[0];

  let date = null;
  const rounds = [];
  let currentRound = null;

  for (const row of sheet.children) {
    const cells = row.children;
    const firstCell = cells[0];
    const firstText = firstCell?.text?.trim() ?? "";
    const firstIsBold = firstCell?.children?.some(
      (n) => n.formatting?.bold
    );

    if (!firstText) continue;

    if (date === null && firstIsBold && cells.length === 1) {
      const serial = parseInt(firstText, 10);
      if (!isNaN(serial)) {
        const epoch = new Date(1899, 11, 30);
        date = new Date(epoch.getTime() + serial * 86400000)
          .toISOString()
          .split("T")[0];
        continue;
      }
    }

    const hasAnswerCols = cells.some(
      (c) => c.metadata.col >= 2 && c.text?.trim()
    );
    if (firstIsBold && !hasAnswerCols) {
      currentRound = { name: firstText, description: { de: "", en: "" }, questions: [] };
      rounds.push(currentRound);
      continue;
    }

    if (!currentRound) continue;

    if (!hasAnswerCols) {
      const dePart = firstText;
      const enPart =
        cells.find((c) => c.metadata.col === 1)?.text?.trim() ?? "";
      const d = currentRound.description;
      d.de = d.de ? d.de + "\n" + dePart : dePart;
      if (enPart) d.en = d.en ? d.en + "\n" + enPart : enPart;
      continue;
    }

    const de = firstText;
    const en = cells.find((c) => c.metadata.col === 1)?.text?.trim() ?? "";
    const deAnswer =
      (cells.find((c) => c.metadata.col === 2)?.text?.trim() ?? "").replace(/\n/g, " ");
    const enAnswer =
      (cells.find((c) => c.metadata.col === 3)?.text?.trim() || deAnswer).replace(/\n/g, " ");

    currentRound.questions.push({
      text: { de, en },
      answers: { de: deAnswer, en: enAnswer },
    });
  }

  // "Name 10" penultimate round: ignore answers (teams write 10 things, no single correct answer)
  if (rounds.length >= 2) {
    const penultimate = rounds[rounds.length - 2];
    if (/^name\s*10$/i.test(penultimate.name)) {
      for (const q of penultimate.questions) {
        q.answers = { de: "", en: "" };
      }
    }
  }

  // Last round is always the Jackpot round
  if (rounds.length > 1 && rounds.at(-1).questions.length === 4) {
    rounds.at(-1).name = "Jackpot!";
  }

  return { date, rounds };
}

/**
 * Returns a flat list of slide descriptors with stable IDs.
 * Used by both the preview and the PPTX builder.
 */
export function buildSlideDescriptors(quiz) {
  const slides = [];
  const ANTWORTEN_TEXT = { de: "Antworten", en: "Answers" };
  const ANTWORTEN_SUB = { de: "Bitte tauscht eure Papiere mit einem anderen Team aus.", en: "Please swap your papers with another team." };

  function addTitle(text, subtitle, id) {
    slides.push({ type: "title", text, subtitle: subtitle || null, id: id || null });
  }

  function addRoundQuestions(rounds, roundOffset, withAnswers) {
    for (let r = 0; r < rounds.length; r++) {
      const ri = roundOffset + r;
      const round = rounds[r];
      addTitle({ de: round.name, en: "" }, null, withAnswers ? `title-r${ri}-ans` : `title-r${ri}`);
      if (!withAnswers && round.description?.de) {
        slides.push({ type: "description", text: round.description, id: `desc-r${ri}` });
      }
      const count = round.questions.length === 0 ? 10 : round.questions.length;
      for (let i = 0; i < count; i++) {
        slides.push({ type: "question", id: `r${ri}q${i}`, num: i + 1, withAnswers });
      }
    }
  }

  function addExtra(id) {
    slides.push({ type: "intro", data: EXTRA_SLIDES[id], id });
  }

  // --- 5 intro slides ---
  for (let i = 0; i < INTRO_SLIDES.length; i++) {
    slides.push({ type: "intro", introIndex: i, data: INTRO_SLIDES[i], id: `intro-${i}` });
  }

  // --- Section 1: Rounds 0-1 ---
  addRoundQuestions(quiz.rounds.slice(0, 2), 0, false);
  addTitle(ANTWORTEN_TEXT, ANTWORTEN_SUB, "antworten-s0");
  addRoundQuestions(quiz.rounds.slice(0, 2), 0, true);
  addExtra("break-1");
  addExtra("points");

  // --- Section 2: Rounds 2-4 ---
  addRoundQuestions(quiz.rounds.slice(2, 5), 2, false);
  addTitle(ANTWORTEN_TEXT, ANTWORTEN_SUB, "antworten-s1");
  addRoundQuestions(quiz.rounds.slice(2, 5), 2, true);
  addExtra("break-2");
  addExtra("prizes");

  // --- Jackpot section: Round 5 ---
  const jr = quiz.rounds[5];
  if (jr) {
    const jri = 5;
    addTitle({ de: jr.name, en: "" }, null, `title-r${jri}`);
    addExtra("no-phones");
    const count = jr.questions.length || 4;
    for (let i = 0; i < count; i++) {
      slides.push({ type: "question", id: `r${jri}q${i}`, num: i + 1, withAnswers: false, jackpot: true });
    }
    // No Antworten divider for jackpot
    addTitle({ de: jr.name, en: "" }, null, `title-r${jri}-ans`);
    for (let i = 0; i < count; i++) {
      slides.push({ type: "question", id: `r${jri}q${i}`, num: i + 1, withAnswers: true, jackpot: true });
    }
    addExtra("goodbye");
  }

  return slides;
}

function replaceVars(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, key) => key in vars ? String(vars[key]) : m);
}

function resolveColor(c) {
  return (c || SLIDE_STYLE.textColor).replace("#", "");
}

/** Add an image below text, contain-fit to remaining slide space. */
function addImageBelowText(slide, entry, textBottom) {
  const { pad, width: W, height: H } = SLIDE_STYLE;
  const imgTop = textBottom + pad;
  const boxW = W - 2 * pad;
  const boxH = H - pad - imgTop;
  if (boxH <= 0) return;
  const ar = entry.width / entry.height;
  const { w, h } = fit(boxW, boxH, ar);
  slide.addImage({
    data: entry.data,
    x: (W - w) / 2, y: imgTop, w, h,
    sizing: { type: "contain", w, h },
  });
}

/** Add two images side-by-side below text, contain-fit to remaining slide space. */
function addTwoImagesBelowText(slide, entry0, entry1, textBottom) {
  const { pad, width: W, height: H } = SLIDE_STYLE;
  const imgTop = textBottom + pad;
  const fullW = W - 2 * pad;
  const boxH = H - pad - imgTop;
  if (boxH <= 0) return;
  const gap = pad;
  const boxW = (fullW - gap) / 2;
  for (const [entry, xOff] of [[entry0, pad], [entry1, pad + boxW + gap]]) {
    const ar = entry.width / entry.height;
    const { w, h } = fit(boxW, boxH, ar);
    slide.addImage({
      data: entry.data,
      x: xOff + (boxW - w) / 2, y: imgTop + (boxH - h) / 2, w, h,
      sizing: { type: "contain", w, h },
    });
  }
}

function renderIntroSlide(slide, data, assets, desc, images, money, email) {
  if (!data) return;
  const { width: W, height: H, pad } = SLIDE_STYLE;
  const style = data.style || data.id; // migration fallback for old saves
  const slideKey = desc?.id ? `${desc.id}:0` : null;
  const [imgEntry, imgEntry1] = slideKey && images ? getSlideImages(images, slideKey) : [null, null];
  const hasTwoImages = imgEntry && imgEntry1;

  if (style === "welcome") {
    // Background logo — full slide, cover
    if (assets.logo) {
      // Contain-fit: calculate dimensions to maintain aspect ratio within slide
      const logoAr = 504 / 360; // tipperary-logo.gif native aspect ratio
      const { w: lw, h: lh } = fit(W, H, logoAr);
      slide.addImage({ data: assets.logo, x: (W - lw) / 2, y: (H - lh) / 2, w: lw, h: lh });
    }
    // Title
    slide.addText(data.title.text, {
      x: 0, y: data.titleY, w: "100%", h: "15%",
      fontSize: data.title.fontSize, bold: true, color: resolveColor(data.title.color),
      align: "center", valign: "middle",
    });
    // Subtitle lines
    const subtitleRuns = data.subtitle.map((l) => ({
      text: l.text + "\n", options: { fontSize: l.fontSize, bold: l.bold, color: resolveColor(l.color) },
    }));
    slide.addText(subtitleRuns, { x: 0, y: data.subtitleY, w: "100%", h: "25%", align: "center", valign: "top" });
    // Toucans — positions from config
    const t = data.toucan;
    if (assets.toucan && t) {
      slide.addImage({ data: assets.toucan, x: t.x, y: t.y, w: t.w, h: t.h });
      slide.addImage({ data: assets.toucan, x: W - t.x - t.w, y: t.y, w: t.w, h: t.h });
    }
    return;
  }

  if (style === "rules") {
    const vars = { money, email };
    const sections = data.sections.filter((sec) => !sec.showIf || vars[sec.showIf]);
    const titleY = imgEntry ? pad : data.titleY;
    let sectionStartY = imgEntry ? pad + 0.6 : data.sectionStartY;
    slide.addText(data.title.text, {
      x: 0, y: titleY, w: "100%", h: 0.6,
      fontSize: data.title.fontSize, bold: true, underline: true, color: resolveColor(data.title.color), align: "center",
    });
    let textBottom = sectionStartY;
    sections.forEach((sec, si) => {
      let y = sectionStartY + si * data.sectionGap;
      for (const line of sec.lines) {
        if (line.showIf && !vars[line.showIf]) continue;
        const runs = line.runs.map((r) => ({
          text: replaceVars(r.text, vars),
          options: {
            fontSize: r.fontSize || data.defaultFontSize,
            bold: r.bold || false,
            underline: r.underline || false,
            color: resolveColor(r.color),
          },
        }));
        slide.addText(runs, { x: pad, y, w: W - 2 * pad, h: data.lineHeight, align: "center" });
        y += data.lineHeight;
        textBottom = Math.max(textBottom, y);
      }
    });
    if (imgEntry) {
      if (hasTwoImages) addTwoImagesBelowText(slide, imgEntry, imgEntry1, textBottom);
      else addImageBelowText(slide, imgEntry, textBottom);
    }
    return;
  }

  if (style === "format") {
    const cp = data.contentPad || 0;
    slide.addText(data.title.text, {
      x: 0, y: data.titleY, w: "100%", h: 0.6,
      fontSize: data.title.fontSize, bold: !!data.title.bold, underline: true, color: resolveColor(data.title.color),
      align: "center", fontFace: data.title.fontFace,
    });
    data.sections.forEach((sec, si) => {
      const y = data.sectionStartY + si * data.sectionGap;
      const allRuns = [];
      for (const line of sec.lines) {
        const runs = line.runs.map((r) => ({
          text: r.text,
          options: {
            fontSize: r.fontSize || data.defaultFontSize,
            bold: r.bold || false,
            color: resolveColor(r.color || data.defaultColor),
          },
        }));
        runs[0].text = sec.bullet + " " + runs[0].text;
        allRuns.push(...runs, { text: "\n" });
      }
      const sectionH = data.sectionGap || (H - y);
      slide.addText(allRuns, { x: pad + cp, y, w: W - 2 * pad - 2 * cp, h: sectionH, valign: "top" });
    });
    return;
  }

  if (style === "golden-rules") {
    const titleY = imgEntry ? pad : data.titleY;
    const rulesY = imgEntry ? pad + 0.6 : data.rulesStartY;
    slide.addText(data.title.text, {
      x: 0, y: titleY, w: "100%", h: 0.6,
      fontSize: data.title.fontSize, bold: true, underline: true, color: resolveColor(data.title.color), align: "center",
    });
    const rH = data.ruleHeight || 1.0;
    data.rules.forEach((rule, ri) => {
      slide.addText(rule, {
        x: 0, y: rulesY + ri * rH, w: "100%", h: rH,
        fontSize: data.ruleFontSize, color: resolveColor(data.ruleColor), align: "center", valign: "middle",
      });
    });
    if (imgEntry) {
      const textBottom = rulesY + data.rules.length * rH;
      if (hasTwoImages) addTwoImagesBelowText(slide, imgEntry, imgEntry1, textBottom);
      else addImageBelowText(slide, imgEntry, textBottom);
    }
    return;
  }

  if (style === "begin") {
    // Split lines into groups separated by marginTop gaps
    const lineH = (pts) => (pts / 72) * 1.2;
    const groups = []; // [{ y, runs, h }]
    let y = imgEntry ? pad : null; // absolute positioning for image layout, null for centered
    for (const l of data.lines) {
      if (l.marginTop && y != null) y += l.marginTop;
      const lh = lineH(l.fontSize || 20);
      const run = { text: l.text + "\n", options: { fontSize: l.fontSize, bold: !!l.bold, color: resolveColor(l.color) } };
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && !l.marginTop) {
        lastGroup.runs.push(run);
        lastGroup.h += lh;
      } else {
        groups.push({ y, runs: [run], h: lh });
      }
      if (y != null) y += lh;
    }
    if (imgEntry) {
      for (const g of groups) {
        slide.addText(g.runs, { x: pad, y: g.y, w: W - 2 * pad, h: g.h, align: "center", valign: "top" });
      }
      if (hasTwoImages) addTwoImagesBelowText(slide, imgEntry, imgEntry1, y);
      else addImageBelowText(slide, imgEntry, y);
    } else if (groups.length === 1) {
      slide.addText(groups[0].runs, { x: pad, y: 0, w: W - 2 * pad, h: "100%", align: "center", valign: "middle" });
    } else {
      // Multiple groups with gaps — center the whole block vertically
      const totalH = groups.reduce((sum, g) => sum + g.h, 0) + data.lines.reduce((sum, l) => sum + (l.marginTop || 0), 0);
      let cy = (H - totalH) / 2;
      for (let gi = 0; gi < groups.length; gi++) {
        const g = groups[gi];
        // Find marginTop of first line in this group
        const lineIdx = groups.slice(0, gi).reduce((sum, gg) => sum + gg.runs.length, 0);
        const firstLine = data.lines[lineIdx];
        if (firstLine?.marginTop) cy += firstLine.marginTop;
        slide.addText(g.runs, { x: pad, y: cy, w: W - 2 * pad, h: g.h, align: "center", valign: "top" });
        cy += g.h;
      }
    }
    return;
  }
}

/**
 * @param {object} quiz
 * @param {function} PptxGenJS - constructor
 * @param {Record<string, {data:string, width:number, height:number}>} [images]
 * @param {Record<string, {fontSize:number, lineSpacing:number, enY:number}>} [overrides]
 * @param {Record<string, {data:string, name:string}>} [audio]
 * @param {object} [introAssets] - { logo: base64, toucan: base64 }
 * @param {Record<string, {text:{de:string,en:string}, answers:{de:string,en:string}}>} [questions]
 * @param {Record<string, boolean>} [reveals] - per-slide-key explicit click-to-reveal toggle
 */
export function buildPptx(descriptors, PptxGenJS, images = {}, overrides = {}, audio = {}, introAssets = {}, questions = {}, options = {}) {
  images = mergeAudioIntoImages(images, audio);
  const money = options.jackpotSize ?? 0;
  const email = options.email || "";
  const reveals = options.reveals || {};
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  const { pad, height: H, backgroundColor } = SLIDE_STYLE;
  const W = SLIDE_STYLE.width;
  const fullW = W - 2 * pad;
  const bgColor = backgroundColor.replace("#", "");
  const fgColor = SLIDE_STYLE.textColor.replace("#", "");

  function addMediaEntry(slide, entry, x, y, w, h) {
    const type = entry.type || "image";
    if (type === "audio") {
      const audioData = entry.data.replace(/^data:/, "").replace(/^audio\/mpeg/, "audio/mp3");
      slide.addMedia({
        type: "audio", data: audioData,
        x: x + (w - 0.5) / 2, y: y + (h - 0.5) / 2, w: 0.5, h: 0.5,
      });
    } else if (type === "video") {
      const videoData = entry.data.replace(/^data:/, "");
      const opts = { type: "video", data: videoData, x, y, w, h };
      if (entry.cover) opts.cover = entry.cover;
      slide.addMedia(opts);
    } else {
      slide.addImage({ data: entry.data, x, y, w, h, sizing: { type: "contain", w, h } });
    }
  }

  function addSlideMedia(slide, desc, { skipImage = false } = {}) {
    const slideKey = desc.id ? `${desc.id}:0` : null;
    if (!slideKey) return;
    const [entry0, entry1] = getSlideImages(images, slideKey);
    if (!skipImage) {
      if (entry0) addMediaEntry(slide, entry0, 0, 0, W, H);
      if (entry1) addMediaEntry(slide, entry1, W / 2, 0, W / 2, H);
    }
  }

  for (const desc of descriptors) {
    const slide = pptx.addSlide();
    slide.background = { color: bgColor };

    if (desc.type === "title") {
      const slideKey = desc.id ? `${desc.id}:0` : null;
      const [img0, img1] = slideKey ? getSlideImages(images, slideKey) : [null, null];
      const titleDe = desc.text.de || "";
      const titleEn = desc.text.en || "";
      const isJackpotTitle = titleDe === "Jackpot!";
      const jackpotSubtitle = isJackpotTitle && `ca. ${money + DEFAULT_MONEY} €`;
      const subtitleDe = desc.subtitle?.de || "";
      const subtitleEn = desc.subtitle?.en || "";
      const hasSubtitle = subtitleDe || subtitleEn || jackpotSubtitle;
      const hasEn = titleEn || subtitleEn;
      if (img0) {
        // Image mode: text at top, image below — stack elements and derive textBottom
        const lineH = (pts) => (pts / 72) * 1.2;
        const titleLineH = lineH(SLIDE_STYLE.title.fontSize);
        let nextY = pad;
        slide.addText(titleDe, {
          x: 0, y: nextY, w: "100%", h: titleLineH,
          fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "top", color: fgColor,
        });
        nextY += titleLineH;
        if (titleEn) {
          slide.addText(titleEn, {
            x: 0, y: nextY, w: "100%", h: titleLineH,
            fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "top", color: fgColor,
          });
          nextY += titleLineH;
        }
        if (subtitleDe || subtitleEn) {
          const subText = subtitleEn ? `${subtitleDe}\n${subtitleEn}` : subtitleDe;
          const subLines = subtitleEn ? 2 : 1;
          const subH = lineH(SLIDE_STYLE.question.fontSize) * subLines;
          slide.addText(subText, {
            x: 0.5, y: nextY, w: W - 1, h: subH,
            fontSize: SLIDE_STYLE.question.fontSize, align: "center", valign: "top", color: fgColor,
          });
          nextY += subH;
        } else if (jackpotSubtitle) {
          const jpH = lineH(28);
          slide.addText(jackpotSubtitle, {
            x: 0.5, y: nextY, w: W - 1, h: jpH,
            fontSize: 28, bold: true, color: "FFC000", align: "center", valign: "top",
          });
          nextY += jpH;
        }
        if (img1) {
          addTwoImagesBelowText(slide, img0, img1, nextY);
        } else {
          addImageBelowText(slide, img0, nextY);
        }
      } else {
        // No image: centered
        const totalParts = 1 + (titleEn ? 1 : 0) + (hasSubtitle ? 1 : 0);
        const blockH = totalParts <= 1 ? 1.0 : totalParts * 0.7;
        const startY = (H - blockH) / 2;
        slide.addText(titleDe, {
          x: 0, y: startY, w: "100%", h: 0.7,
          fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "middle", color: fgColor,
        });
        let nextY = startY + 0.7;
        if (titleEn) {
          slide.addText(titleEn, {
            x: 0, y: nextY, w: "100%", h: 0.6,
            fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "middle", color: fgColor,
          });
          nextY += 0.6;
        }
        if (subtitleDe || subtitleEn) {
          const subText = subtitleEn ? `${subtitleDe}\n${subtitleEn}` : subtitleDe;
          slide.addText(subText, {
            x: 0.5, y: nextY, w: 9, h: 0.8,
            fontSize: SLIDE_STYLE.question.fontSize, align: "center", valign: "top", color: fgColor,
          });
        } else if (jackpotSubtitle) {
          slide.addText(jackpotSubtitle, {
            x: 0.5, y: nextY, w: 9, h: 0.8,
            fontSize: 28, bold: true, color: "FFC000", align: "center", valign: "top",
          });
        }
      }
      addSlideMedia(slide, desc, { skipImage: true });
      continue;
    }

    if (desc.type === "intro") {
      renderIntroSlide(slide, desc.data || INTRO_SLIDES[desc.introIndex], introAssets, desc, images, money, email);
      addSlideMedia(slide, desc, { skipImage: true });
      continue;
    }

    if (desc.type === "description") {
      const descSlideKey = desc.id ? `${desc.id}:0` : null;
      const [descImg, descImg1] = descSlideKey ? getSlideImages(images, descSlideKey) : [null, null];
      let deW = fullW, enW = fullW;
      if (descImg && descImg1) {
        const layout = computeTwoImageLayout(descImg.width / descImg.height, descImg1.width / descImg1.height);
        deW = layout.deW;
        enW = layout.enW;
        for (const [entry, img] of [[descImg, layout.img0], [descImg1, layout.img1]]) {
          slide.addImage({ data: entry.data, x: img.x, y: img.y, w: img.w, h: img.h, sizing: { type: "contain", w: img.w, h: img.h } });
        }
      } else if (descImg) {
        const layout = computeImageLayout(descImg.width / descImg.height);
        deW = layout.deW;
        enW = layout.enW;
        slide.addImage({
          data: descImg.data,
          x: layout.img.x, y: layout.img.y, w: layout.img.w, h: layout.img.h,
          sizing: { type: "contain", w: layout.img.w, h: layout.img.h },
        });
      }
      const descOverride = descSlideKey ? overrides[descSlideKey] : null;
      const descEnY = descOverride?.enY ?? 2.5;
      const descDeH = descEnY - pad;
      const descEnH = H - pad - descEnY;
      slide.addText(desc.text.de, {
        x: pad, y: pad, w: deW, h: descDeH,
        fontSize: SLIDE_STYLE.question.fontSize, valign: "top", color: fgColor,
        lineSpacing: SLIDE_STYLE.question.fontSize * SLIDE_STYLE.question.lineSpacing / 100,
      });
      if (desc.text.en) {
        slide.addText(desc.text.en, {
          x: pad, y: descEnY, w: enW, h: descEnH,
          fontSize: SLIDE_STYLE.question.fontSize, valign: "top", color: fgColor,
          lineSpacing: SLIDE_STYLE.question.fontSize * SLIDE_STYLE.question.lineSpacing / 100,
        });
      }
      addSlideMedia(slide, desc, { skipImage: true });
      continue;
    }

    const { num, withAnswers, id } = desc;
    const q = questions[id] || desc.q; // desc.q fallback for old saves
    const slideKey = id ? `${id}:${withAnswers ? 1 : 0}` : null;
    const [imgEntry, imgEntry1] = slideKey ? getSlideImages(images, slideKey) : [null, null];
    const hasTwoImages = imgEntry && imgEntry1;

    // No question text, no answer bar — image fills the slide
    const hasQuestionText = q && (q.text.de || q.text.en);
    if (!hasQuestionText && !withAnswers && imgEntry) {
      if (hasTwoImages) {
        const gap = pad;
        const boxW = (W - 2 * pad - gap) / 2, boxH = H - 2 * pad;
        for (const [entry, xOff] of [[imgEntry, pad], [imgEntry1, pad + boxW + gap]]) {
          const ar = entry.width / entry.height;
          const { w: iw, h: ih } = fit(boxW, boxH, ar);
          addMediaEntry(slide, entry, xOff + (boxW - iw) / 2, (H - ih) / 2, iw, ih);
        }
      } else {
        const ar = imgEntry.width / imgEntry.height;
        const { w, h } = fit(W - 2 * pad, H - 2 * pad, ar);
        addMediaEntry(slide, imgEntry, (W - w) / 2, (H - h) / 2, w, h);
      }
      slide.addText(String(num), {
        x: pad, y: pad, w: 0.8, h: 0.5, fontSize: SLIDE_STYLE.num.fontSize, bold: true, color: fgColor,
      });
      continue;
    }

    let deW = fullW, enW = fullW;
    const override = overrides[`${id}:${withAnswers ? 1 : 0}`];

    // Bottom limit for text
    let bottomLimit = H - pad;
    if (withAnswers) bottomLimit = H - (override?.answerH || 0.7) - pad; // leave room for answer bar

    // Answer slides without question text: images handled in answer bar block below
    // Answer slides with question text: use computeImageLayout (same as question slides)
    if (imgEntry && (!withAnswers || hasQuestionText)) {
      if (hasTwoImages) {
        const frac = override?.twoImageFrac || 0.45;
        const layout = computeTwoImageLayout(imgEntry.width / imgEntry.height, imgEntry1.width / imgEntry1.height, frac);
        deW = layout.deW;
        enW = layout.enW;
        bottomLimit = Math.min(bottomLimit, layout.textBottomLimit);
        for (const [entry, img] of [[imgEntry, layout.img0], [imgEntry1, layout.img1]]) {
          addMediaEntry(slide, entry, img.x, img.y, img.w, img.h);
        }
      } else if (override?.imgLayout) {
        // Compact layout from browser fitting pass
        deW = override.deW ?? fullW;
        enW = override.enW ?? fullW;
        const il = override.imgLayout;
        addMediaEntry(slide, imgEntry, il.x, il.y, il.w, il.h);
      } else {
        const layout = computeImageLayout(imgEntry.width / imgEntry.height);
        deW = layout.deW;
        enW = layout.enW;
        if (layout.mode === "ultrawide") {
          bottomLimit = Math.min(bottomLimit, layout.img.y - pad);
        }
        addMediaEntry(slide, imgEntry, layout.img.x, layout.img.y, layout.img.w, layout.img.h);
      }
    }
    const qFontSize = override?.fontSize ?? SLIDE_STYLE.question.fontSize;
    const qLineSpacing = override?.lineSpacing ?? SLIDE_STYLE.question.lineSpacing;
    const enY = override?.enY ?? 2.5;
    const deH = enY - pad;
    const enH = bottomLimit - enY;

    if (hasQuestionText) {
      slide.addText([
        { text: `${num}  `, options: { fontSize: SLIDE_STYLE.num.fontSize, bold: true, color: fgColor } },
        { text: q.text.de, options: { fontSize: qFontSize, color: fgColor } },
      ], {
        x: pad, y: pad, w: deW, h: deH, valign: "top",
        lineSpacing: qFontSize * qLineSpacing / 100,
      });
      if (q.text.en) {
        slide.addText([
          { text: `${num}  `, options: { fontSize: SLIDE_STYLE.num.fontSize, bold: true, color: fgColor } },
          { text: q.text.en, options: { fontSize: qFontSize, color: fgColor } },
        ], {
          x: pad, y: enY, w: enW, h: enH, valign: "top",
          lineSpacing: qFontSize * qLineSpacing / 100,
        });
      }
    } else {
      slide.addText(String(num), {
        x: pad, y: pad, w: 0.8, h: 0.5, fontSize: SLIDE_STYLE.num.fontSize, bold: true, color: fgColor,
      });
    }

    if (withAnswers) {
      const answer = q ? formatAnswer(q) : "";
      if (answer) {
        const measuredH = override?.answerH;
        const answerH = measuredH || Math.max(0.5, Math.min(1.5, Math.ceil(answer.length / 40) * 0.35));
        const answerY = H - answerH;
        const answerOpts = {
          x: 0, y: answerY, w: W, h: answerH,
          fontSize: SLIDE_STYLE.answer.fontSize, bold: true, align: "center", valign: "top",
          color: SLIDE_STYLE.answer.color.replace("#", ""),
          fill: { color: SLIDE_STYLE.answer.backgroundColor.replace("#", "") },
          paraSpaceBefore: 5,
        };
        if (isRevealEffective(reveals, desc)) answerOpts.objectName = "reveal-answer";
        slide.addText(answer, answerOpts);
        // Image above answer bar (only when no question text — otherwise already placed)
        if (imgEntry && !hasQuestionText) {
          const imgTop = pad + 0.5;
          const imgBoxH = answerY - imgTop - pad;
          if (imgBoxH > 0) {
            if (hasTwoImages) {
              const gap = pad;
              const boxW = (fullW - gap) / 2;
              for (const [entry, xOff] of [[imgEntry, pad], [imgEntry1, pad + boxW + gap]]) {
                const ar = entry.width / entry.height;
                const { w: iw, h: ih } = fit(boxW, imgBoxH, ar);
                addMediaEntry(slide, entry, xOff + (boxW - iw) / 2, imgTop + (imgBoxH - ih) / 2, iw, ih);
              }
            } else {
              const ar = imgEntry.width / imgEntry.height;
              const { w: iw, h: ih } = fit(fullW, imgBoxH, ar);
              addMediaEntry(slide, imgEntry, (W - iw) / 2, imgTop, iw, ih);
            }
          }
        }
      } else if (imgEntry && !hasQuestionText) {
        // No answer, no question text — image fills slide (below number)
        if (hasTwoImages) {
          const gap = pad;
          const boxW = (W - 2 * pad - gap) / 2, boxH = H - 2 * pad;
          for (const [entry, xOff] of [[imgEntry, pad], [imgEntry1, pad + boxW + gap]]) {
            const ar = entry.width / entry.height;
            const { w: iw, h: ih } = fit(boxW, boxH, ar);
            addMediaEntry(slide, entry, xOff + (boxW - iw) / 2, (H - ih) / 2, iw, ih);
          }
        } else {
          const ar = imgEntry.width / imgEntry.height;
          const { w: iw, h: ih } = fit(W - 2 * pad, H - 2 * pad, ar);
          addMediaEntry(slide, imgEntry, (W - iw) / 2, (H - ih) / 2, iw, ih);
        }
      }
    }

  }

  return pptx;
}
