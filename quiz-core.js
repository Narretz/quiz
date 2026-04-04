/**
 * Shared quiz logic — no Node-specific imports.
 * Used by both CLI (parse-quiz.js, generate-pptx.js) and browser (index.html).
 */

import { INTRO_SLIDES, EXTRA_SLIDES, DEFAULT_MONEY } from "./lib/intro-slides.js";

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
      cells.find((c) => c.metadata.col === 2)?.text?.trim() ?? "";
    const enAnswer =
      cells.find((c) => c.metadata.col === 3)?.text?.trim() || deAnswer;

    currentRound.questions.push({
      text: { de, en },
      answers: { de: deAnswer, en: enAnswer },
    });
  }

  // "Name 10" penultimate round: ignore answers (teams write 10 things, no single correct answer)
  if (rounds.length >= 2) {
    const penultimate = rounds[rounds.length - 2];
    if (/^name\s*10$/i.test(penultimate.name)) {
      penultimate.noAnswerText = true;
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
  const ANTWORTEN_TEXT = "Antworten ⬧ Answers";
  const ANTWORTEN_SUB = "Bitte tauscht eure Papiere mit einem anderen Team aus.\nPlease swap your papers with another team.";

  function addTitle(text, subtitle, id) {
    slides.push({ type: "title", text, subtitle: subtitle || null, id: id || null });
  }

  function addRoundQuestions(rounds, roundOffset, withAnswers) {
    for (let r = 0; r < rounds.length; r++) {
      const ri = roundOffset + r;
      const round = rounds[r];
      addTitle(round.name, null, withAnswers ? `title-r${ri}-ans` : `title-r${ri}`);
      if (!withAnswers && round.description?.de) {
        slides.push({ type: "description", text: round.description, id: `desc-r${ri}` });
      }
      const count = round.questions.length === 0 ? 10 : round.questions.length;
      for (let i = 0; i < count; i++) {
        slides.push({ type: "question", id: `r${ri}q${i}`, num: i + 1, withAnswers, noAnswerText: !!round.noAnswerText });
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
    addTitle(jr.name, null, `title-r${jri}`);
    addExtra("no-phones");
    const count = jr.questions.length || 4;
    for (let i = 0; i < count; i++) {
      slides.push({ type: "question", id: `r${jri}q${i}`, num: i + 1, withAnswers: false });
    }
    // No Antworten divider for jackpot
    addTitle(jr.name, null, `title-r${jri}-ans`);
    for (let i = 0; i < count; i++) {
      slides.push({ type: "question", id: `r${jri}q${i}`, num: i + 1, withAnswers: true });
    }
    addExtra("goodbye");
  }

  return slides;
}

function replaceMoney(text, money) {
  return text.replace("{money}", String(money));
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

function renderIntroSlide(slide, data, assets, desc, images) {
  if (!data) return;
  const money = DEFAULT_MONEY;
  const { width: W, height: H, pad } = SLIDE_STYLE;
  const style = data.style || data.id; // migration fallback for old saves
  const slideKey = desc?.id ? `${desc.id}:0` : null;
  const imgEntry = slideKey && images?.[slideKey];

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
    const titleY = imgEntry ? pad : data.titleY;
    let sectionStartY = imgEntry ? pad + 0.6 : data.sectionStartY;
    slide.addText(data.title.text, {
      x: 0, y: titleY, w: "100%", h: 0.6,
      fontSize: data.title.fontSize, bold: true, underline: true, color: resolveColor(data.title.color), align: "center",
    });
    let textBottom = sectionStartY;
    data.sections.forEach((sec, si) => {
      let y = sectionStartY + si * data.sectionGap;
      for (const line of sec.lines) {
        const runs = line.runs.map((r) => ({
          text: replaceMoney(r.text, money),
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
      addImageBelowText(slide, imgEntry, textBottom);
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
    data.rules.forEach((rule, ri) => {
      slide.addText(rule, {
        x: 0, y: rulesY + ri * 0.5, w: "100%", h: 0.5,
        fontSize: data.ruleFontSize, color: resolveColor(data.ruleColor), align: "center", valign: "middle",
      });
    });
    if (imgEntry) {
      const textBottom = rulesY + data.rules.length * 0.5;
      addImageBelowText(slide, imgEntry, textBottom);
    }
    return;
  }

  if (style === "begin") {
    // Split lines into groups separated by marginTop gaps
    const groups = []; // [{ y, runs, h }]
    let y = imgEntry ? pad : null; // absolute positioning for image layout, null for centered
    for (const l of data.lines) {
      if (l.marginTop && y != null) y += l.marginTop;
      const run = { text: l.text + "\n", options: { fontSize: l.fontSize, bold: !!l.bold, color: resolveColor(l.color) } };
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && !l.marginTop) {
        lastGroup.runs.push(run);
        lastGroup.h += 0.5;
      } else {
        groups.push({ y, runs: [run], h: 0.5 });
      }
      if (y != null) y += 0.5;
    }
    if (imgEntry) {
      for (const g of groups) {
        slide.addText(g.runs, { x: pad, y: g.y, w: W - 2 * pad, h: g.h, align: "center", valign: "top" });
      }
      addImageBelowText(slide, imgEntry, y);
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
 */
export function buildPptx(descriptors, PptxGenJS, images = {}, overrides = {}, audio = {}, introAssets = {}, questions = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  pptx.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };
  const { pad, height: H, backgroundColor } = SLIDE_STYLE;
  const W = SLIDE_STYLE.width;
  const fullW = W - 2 * pad;
  const bgColor = backgroundColor.replace("#", "");
  const fgColor = SLIDE_STYLE.textColor.replace("#", "");

  // Add image/audio to any slide by its ID
  function addSlideMedia(slide, desc, { skipImage = false } = {}) {
    const slideKey = desc.id ? `${desc.id}:0` : null;
    if (!slideKey) return;
    if (!skipImage) {
      const imgEntry = images[slideKey];
      if (imgEntry) {
        slide.addImage({
          data: imgEntry.data,
          x: 0, y: 0, w: W, h: H,
          sizing: { type: "contain", w: W, h: H },
        });
      }
    }
    const audioEntry = audio[slideKey];
    if (audioEntry) {
      const audioData = audioEntry.data.replace(/^data:/, "").replace(/^audio\/mpeg/, "audio/mp3");
      slide.addMedia({
        type: "audio", data: audioData,
        x: (W - 0.5) / 2, y: (H - 0.5) / 2, w: 0.5, h: 0.5,
      });
    }
  }

  for (const desc of descriptors) {
    const slide = pptx.addSlide();
    slide.background = { color: bgColor };

    if (desc.type === "title") {
      const slideKey = desc.id ? `${desc.id}:0` : null;
      const hasImg = slideKey && images[slideKey];
      if (hasImg) {
        // Image mode: text at top, image below
        const textH = desc.subtitle ? 1.8 : 1.0;
        slide.addText(desc.text, {
          x: 0, y: pad, w: "100%", h: textH * 0.6,
          fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "top", color: fgColor,
        });
        if (desc.subtitle) {
          slide.addText(desc.subtitle, {
            x: 0.5, y: pad + textH * 0.6, w: W - 1, h: textH * 0.4,
            fontSize: SLIDE_STYLE.question.fontSize, align: "center", valign: "top", color: fgColor,
          });
        }
        addImageBelowText(slide, hasImg, pad + textH);
      } else {
        // No image: centered
        slide.addText(desc.text, {
          x: 0, y: desc.subtitle ? 0.5 : 0, w: "100%", h: desc.subtitle ? "50%" : "100%",
          fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "middle", color: fgColor,
        });
        if (desc.subtitle) {
          slide.addText(desc.subtitle, {
            x: 0.5, y: "55%", w: 9, h: "40%",
            fontSize: SLIDE_STYLE.question.fontSize, align: "center", valign: "top", color: fgColor,
          });
        }
      }
      addSlideMedia(slide, desc, { skipImage: true });
      continue;
    }

    if (desc.type === "intro") {
      renderIntroSlide(slide, desc.data || INTRO_SLIDES[desc.introIndex], introAssets, desc, images);
      addSlideMedia(slide, desc, { skipImage: true });
      continue;
    }

    if (desc.type === "description") {
      const descSlideKey = desc.id ? `${desc.id}:0` : null;
      const descImg = descSlideKey && images[descSlideKey];
      let deW = fullW, enW = fullW;
      if (descImg) {
        const layout = computeImageLayout(descImg.width / descImg.height);
        deW = layout.deW;
        enW = layout.enW;
        slide.addImage({
          data: descImg.data,
          x: layout.img.x, y: layout.img.y, w: layout.img.w, h: layout.img.h,
          sizing: { type: "contain", w: layout.img.w, h: layout.img.h },
        });
      }
      slide.addText(desc.text.de, {
        x: pad, y: pad, w: deW, h: 2.2,
        fontSize: SLIDE_STYLE.question.fontSize, valign: "top", color: fgColor,
        lineSpacing: SLIDE_STYLE.question.fontSize * SLIDE_STYLE.question.lineSpacing / 100,
      });
      if (desc.text.en) {
        slide.addText(desc.text.en, {
          x: pad, y: 2.5, w: enW, h: 2,
          fontSize: SLIDE_STYLE.question.fontSize, valign: "top", color: fgColor,
          lineSpacing: SLIDE_STYLE.question.fontSize * SLIDE_STYLE.question.lineSpacing / 100,
        });
      }
      addSlideMedia(slide, desc, { skipImage: true });
      continue;
    }

    const { num, withAnswers, id, noAnswerText } = desc;
    const q = (noAnswerText && withAnswers) ? null : (questions[id] || desc.q); // desc.q fallback for old saves
    const slideKey = id ? `${id}:${withAnswers ? 1 : 0}` : null;
    const imgEntry = slideKey && images[slideKey];

    // No question text, no answer bar — image fills the slide
    const hasQuestionText = q && (q.text.de || q.text.en);
    if (!hasQuestionText && !withAnswers && imgEntry) {
      const ar = imgEntry.width / imgEntry.height;
      const { w, h } = fit(W - 2 * pad, H - 2 * pad, ar);
      slide.addImage({
        data: imgEntry.data,
        x: (W - w) / 2, y: (H - h) / 2, w, h,
        sizing: { type: "contain", w, h },
      });
      slide.addText(String(num), {
        x: pad, y: pad, w: 0.8, h: 0.5, fontSize: SLIDE_STYLE.num.fontSize, bold: true, color: fgColor,
      });
      continue;
    }

    let deW = fullW, enW = fullW;
    const override = overrides[`${id}:${withAnswers ? 1 : 0}`];

    // Bottom limit for text
    let bottomLimit = H - pad;
    if (withAnswers) bottomLimit = H - 0.7 - pad; // leave room for answer bar

    // Answer slides without question text: images handled in answer bar block below
    // Answer slides with question text: use computeImageLayout (same as question slides)
    if (imgEntry && (!withAnswers || hasQuestionText)) {
      if (override?.imgLayout) {
        // Compact layout from browser fitting pass
        deW = override.deW ?? fullW;
        enW = override.enW ?? fullW;
        const il = override.imgLayout;
        slide.addImage({
          data: imgEntry.data,
          x: il.x, y: il.y, w: il.w, h: il.h,
          sizing: { type: "contain", w: il.w, h: il.h },
        });
      } else {
        const layout = computeImageLayout(imgEntry.width / imgEntry.height);
        deW = layout.deW;
        enW = layout.enW;
        if (layout.mode === "ultrawide") {
          bottomLimit = Math.min(bottomLimit, layout.img.y - pad);
        }
        slide.addImage({
          data: imgEntry.data,
          x: layout.img.x, y: layout.img.y,
          w: layout.img.w, h: layout.img.h,
          sizing: { type: "contain", w: layout.img.w, h: layout.img.h },
        });
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
        slide.addText(q.text.en, {
          x: pad, y: enY, w: enW, h: enH, fontSize: qFontSize, valign: "top", color: fgColor,
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
        const answerLines = Math.ceil(answer.length / 40); // ~40 chars per line at fontSize 20
        const answerH = Math.max(0.5, Math.min(1.5, answerLines * 0.35));
        const answerY = H - answerH;
        slide.addText(answer, {
          x: 0, y: answerY, w: W, h: answerH,
          fontSize: SLIDE_STYLE.answer.fontSize, bold: true, align: "center", valign: "middle",
          color: SLIDE_STYLE.answer.color.replace("#", ""),
          fill: { color: SLIDE_STYLE.answer.backgroundColor.replace("#", "") },
                 });
        // Image above answer bar (only when no question text — otherwise already placed)
        if (imgEntry && !hasQuestionText) {
          const imgTop = pad + 0.5;
          const imgBoxH = answerY - imgTop - pad;
          if (imgBoxH > 0) {
            const ar = imgEntry.width / imgEntry.height;
            const { w: iw, h: ih } = fit(fullW, imgBoxH, ar);
            slide.addImage({
              data: imgEntry.data,
              x: (W - iw) / 2, y: imgTop, w: iw, h: ih,
              sizing: { type: "contain", w: iw, h: ih },
            });
          }
        }
      } else if (imgEntry && !hasQuestionText) {
        // No answer, no question text — image fills slide (below number)
        const ar = imgEntry.width / imgEntry.height;
        const { w: iw, h: ih } = fit(W - 2 * pad, H - 2 * pad, ar);
        slide.addImage({
          data: imgEntry.data,
          x: (W - iw) / 2, y: (H - ih) / 2, w: iw, h: ih,
          sizing: { type: "contain", w: iw, h: ih },
        });
      }
    }

    // Embed audio if present
    const audioEntry = slideKey && audio[slideKey];
    if (audioEntry) {
      // Strip "data:" prefix and normalize MIME — pptxgenjs derives extension from subtype
      const audioData = audioEntry.data.replace(/^data:/, "").replace(/^audio\/mpeg/, "audio/mp3");
      slide.addMedia({
        type: "audio",
        data: audioData,
        x: (W - 0.5) / 2, y: (H - 0.5) / 2, w: 0.5, h: 0.5,
      });
    }
  }

  return pptx;
}
