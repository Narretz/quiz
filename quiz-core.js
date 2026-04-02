/**
 * Shared quiz logic — no Node-specific imports.
 * Used by both CLI (parse-quiz.js, generate-pptx.js) and browser (index.html).
 */

/** Slide dimensions and font sizes — single source of truth for PPTX and preview. */
export const SLIDE_STYLE = {
  width: 10,       // inches (LAYOUT_16x9)
  height: 5.625,   // inches
  pad: 0.2,        // gap between elements (inches)
  title:    { fontSize: 40 },
  num:      { fontSize: 23 },
  question: { fontSize: 20, lineSpacing: 110 },
  answer:   { fontSize: 20 },
};

export function formatAnswer(q) {
  return q.answers.de === q.answers.en
    ? q.answers.de
    : `${q.answers.de} ⬧ ${q.answers.en}`;
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
      currentRound = { name: firstText, description: "", questions: [] };
      rounds.push(currentRound);
      continue;
    }

    if (!currentRound) continue;

    if (!hasAnswerCols) {
      const dePart = firstText;
      const enPart =
        cells.find((c) => c.metadata.col === 1)?.text?.trim() ?? "";
      const desc = enPart ? `${dePart}\n${enPart}` : dePart;
      currentRound.description = currentRound.description
        ? currentRound.description + "\n" + desc
        : desc;
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

  return { date, rounds };
}

/**
 * Returns a flat list of slide descriptors with stable IDs.
 * Used by both the preview and the PPTX builder.
 */
export function buildSlideDescriptors(quiz) {
  const slides = [];

  function addTitle(text) {
    slides.push({ type: "title", text, id: null });
  }

  function addQuestions(rounds, withAnswers) {
    for (const round of rounds) {
      addTitle(round.name);
      const questions = round.questions;
      const count = questions.length === 0 ? 10 : questions.length;
      for (let i = 0; i < count; i++) {
        const q = questions[i];
        // ID ties question and answer slides together for image sharing
        const id = `${round.name}:${i}`;
        const s = { type: "question", id, num: i + 1, q, withAnswers };
        slides.push(s);
      }
    }
  }

  function addSection(rounds) {
    addQuestions(rounds, false);
    addTitle("Break");
    addTitle("Answers");
    addQuestions(rounds, true);
  }

  addTitle(quiz.date);
  addSection(quiz.rounds.slice(0, 2));
  addSection(quiz.rounds.slice(2, 5));
  addSection(quiz.rounds.slice(5));
  return slides;
}

/**
 * @param {object} quiz
 * @param {function} PptxGenJS - constructor
 * @param {Record<string, {data:string, width:number, height:number}>} [images]
 * @param {Record<string, {fontSize:number, lineSpacing:number, enY:number}>} [overrides]
 */
export function buildPptx(quiz, PptxGenJS, images = {}, overrides = {}) {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_16x9";
  const { pad, height: H } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const descriptors = buildSlideDescriptors(quiz);

  for (const desc of descriptors) {
    const slide = pptx.addSlide();

    if (desc.type === "title") {
      slide.addText(desc.text, {
        x: 0, y: 0, w: "100%", h: "100%",
        fontSize: SLIDE_STYLE.title.fontSize, bold: true, align: "center", valign: "middle",
      });
      continue;
    }

    const { q, num, withAnswers, id } = desc;
    const imgEntry = id && images[id];

    // No text — image fills the slide
    if (!q && imgEntry) {
      const ar = imgEntry.width / imgEntry.height;
      const { w, h } = fit(W - 2 * pad, H - 2 * pad, ar);
      slide.addImage({
        data: imgEntry.data,
        x: (W - w) / 2, y: (H - h) / 2, w, h,
        sizing: { type: "contain", w, h },
      });
      slide.addText(String(num), {
        x: pad, y: pad, w: 0.8, h: 0.5, fontSize: SLIDE_STYLE.num.fontSize, bold: true,
      });
      continue;
    }

    let deW = fullW, enW = fullW;
    const override = overrides[`${id}:${withAnswers ? 1 : 0}`];

    // Bottom limit for text
    let bottomLimit = H - pad;
    if (withAnswers) bottomLimit = 4.8;

    if (imgEntry && override?.imgLayout) {
      // Compact layout from browser fitting pass
      deW = override.deW ?? fullW;
      enW = override.enW ?? fullW;
      const il = override.imgLayout;
      slide.addImage({
        data: imgEntry.data,
        x: il.x, y: il.y, w: il.w, h: il.h,
        sizing: { type: "contain", w: il.w, h: il.h },
      });
    } else if (imgEntry) {
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
    const qFontSize = override?.fontSize ?? SLIDE_STYLE.question.fontSize;
    const qLineSpacing = override?.lineSpacing ?? SLIDE_STYLE.question.lineSpacing;
    const enY = override?.enY ?? 2.5;
    const deH = enY - pad;
    const enH = bottomLimit - enY;

    if (q) {
      slide.addText([
        { text: `${num}  `, options: { fontSize: SLIDE_STYLE.num.fontSize, bold: true } },
        { text: q.text.de, options: { fontSize: qFontSize } },
      ], {
        x: pad, y: pad, w: deW, h: deH, valign: "top",
        lineSpacingMultiple: qLineSpacing / 100,
      });
      if (q.text.en) {
        slide.addText(q.text.en, {
          x: pad, y: enY, w: enW, h: enH, fontSize: qFontSize, valign: "top",
          lineSpacingMultiple: qLineSpacing / 100,
        });
      }
    } else {
      slide.addText(String(num), {
        x: pad, y: pad, w: 0.8, h: 0.5, fontSize: SLIDE_STYLE.num.fontSize, bold: true,
      });
    }

    if (withAnswers && q) {
      const answer = formatAnswer(q);
      slide.addText(answer, {
        x: 0, y: 4.8, w: SLIDE_STYLE.width, h: 0.7,
        fontSize: SLIDE_STYLE.answer.fontSize, bold: true, align: "center",
        color: "FFFFFF",
        fill: { color: "CC0000" },
      });
    }
  }

  return pptx;
}
