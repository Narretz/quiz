import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, computeImageLayout, fit } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideImages, slideAudio, quizQuestions, manualOverrides, slideStyle, slideOverrides, scheduleSave } from "../lib/state.js";
import { fitSlideText } from "../lib/fitting.js";
import { ImageActions } from "./image-actions.js";

const html = htm.bind(h);

function focusEnd(el) {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  sel.selectAllChildren(el);
  sel.collapseToEnd();
}

export function QuestionSlide({ desc, onRerender }) {
  const { num, withAnswers, id, noAnswerText } = desc;
  const q = (noAnswerText && withAnswers) ? null : (quizQuestions.value[id] || desc.q); // desc.q fallback for old saves
  const slideKey = id ? `${id}:${withAnswers ? 1 : 0}` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const style = slideStyle.value;
  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const bg = style.backgroundColor;
  const slideRef = useRef(null);
  const ansBarRef = useRef(null);
  const ansDeRef = useRef(null);
  const ansEnRef = useRef(null);
  const ansImgRef = useRef(null);

  let deW = fullW, enW = fullW;
  let imgStyle = null;
  const hasQuestionText = q && (q.text.de || q.text.en);
  const hasAnswer = q && (q.answers.de || q.answers.en);
  // No question text + answer + image on answer slide: image above answer bar (measured via ref)
  const answerImgLayout = withAnswers && imgEntry && !hasQuestionText && hasAnswer;

  if (imgEntry && !answerImgLayout) {
    if (!hasQuestionText) {
      // No question text, no answer bar — image fills the slide
      const ar = imgEntry.width / imgEntry.height;
      const W = SLIDE_STYLE.width, H = SLIDE_STYLE.height;
      const boxW = W - 2 * pad, boxH = H - 2 * pad;
      const fitW = ar > boxW / boxH ? boxW : boxH * ar;
      const fitH = ar > boxW / boxH ? boxW / ar : boxH;
      imgStyle = { position: "absolute", left: px((W - fitW) / 2), top: px((H - fitH) / 2), width: px(fitW), height: px(fitH), objectFit: "contain" };
    } else {
      // Has question text — aspect-ratio based layout (same as question slides)
      const layout = computeImageLayout(imgEntry.width / imgEntry.height);
      deW = layout.deW;
      enW = layout.enW;
      const { img } = layout;
      imgStyle = { position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h), objectFit: "contain" };
    }
  }

  const qFs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const qLh = SLIDE_STYLE.question.lineSpacing / 100;
  const numFs = SLIDE_STYLE.num.fontSize * PT_SCALE;
  const ansFs = SLIDE_STYLE.answer.fontSize * PT_SCALE;
  const ansDe = q?.answers?.de || "";
  const ansEnRaw = q?.answers?.en || "";
  const ansEn = ansEnRaw !== ansDe ? ansEnRaw : "";

  // Answer slide image layout: fill space between number and answer bar
  useLayoutEffect(() => {
    if (!answerImgLayout || !ansBarRef.current || !ansImgRef.current) return;
    const { width: W, height: H } = SLIDE_STYLE;
    const ansBarH = ansBarRef.current.offsetHeight / PX;
    const imgTop = pad + 0.5; // below number
    const imgBottom = H - ansBarH;
    const boxW = W - 2 * pad;
    const boxH = imgBottom - imgTop - pad;
    if (boxH <= 0) return;
    const ar = imgEntry.width / imgEntry.height;
    const { w, h } = fit(boxW, boxH, ar);
    const el = ansImgRef.current;
    el.style.left = px((W - w) / 2);
    el.style.top = px(imgTop);
    el.style.width = px(w);
    el.style.height = px(h);
  });

  // Sync answer field contents imperatively — avoid Preact overwriting user edits
  useLayoutEffect(() => {
    if (ansDeRef.current && ansDeRef.current !== document.activeElement) {
      ansDeRef.current.textContent = ansDe;
    }
  }, [ansDe]);
  useLayoutEffect(() => {
    if (ansEnRef.current && ansEnRef.current !== document.activeElement) {
      ansEnRef.current.textContent = ansEn;
    }
  }, [ansEn]);

  // Text fitting pass — runs after DOM is laid out
  useLayoutEffect(() => {
    if (!slideRef.current || !hasQuestionText) return;
    const images = slideImages.value;
    const manual = manualOverrides.value[slideKey];
    const result = manual
      ? fitSlideText(slideRef.current, images, manual.fontSize, manual.lineSpacing)
      : fitSlideText(slideRef.current, images);
    // Write to slideOverrides signal — used by debug inputs (ImageActions) and PPTX export
    if (result) {
      const prev = slideOverrides.value[slideKey];
      if (!prev || prev.fontSize !== result.fontSize || prev.lineSpacing !== result.lineSpacing || prev.enY !== result.enY) {
        slideOverrides.value = { ...slideOverrides.value, [slideKey]: result };
      }
    }
  }, [imgEntry, slideKey, style.fontSize, style.lineSpacing]);

  return html`
    <div class="slide" ref=${slideRef} style="background-color:${bg};color:${style.textColor || '#000'}"
         data-slide-id=${id} data-answers=${withAnswers ? "1" : "0"}>
      ${hasQuestionText ? html`
        <div data-role="de" style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(deW)};font-size:${qFs}px;line-height:${qLh}">
          <span style="font-size:${numFs}px;font-weight:bold">${num}</span>${" "}${q.text.de}
        </div>
        ${q.text.en && html`
          <div data-role="en" style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(enW)};font-size:${qFs}px;line-height:${qLh}">
            ${q.text.en}
          </div>
        `}
      ` : html`
        <div style="position:absolute;left:${px(pad)};top:${px(pad)};font-size:${numFs}px;font-weight:bold">${num}</div>
      `}
      ${withAnswers && html`
        <div ref=${ansBarRef} class="answer-bar ${(ansDe || ansEn) ? 'answer-bar--filled' : ''}"
             style="font-size:${ansFs}px;background:${SLIDE_STYLE.answer.backgroundColor};color:${SLIDE_STYLE.answer.color}"
             onClick=${(e) => {
               if (e.target === ansBarRef.current && ansDeRef.current) ansDeRef.current.focus();
             }}>
          <span class="answer-bar__tag answer-bar__tag--de"
                onClick=${(e) => { e.stopPropagation(); focusEnd(ansDeRef.current); }}>de</span>
          <div ref=${ansDeRef} contentEditable class="answer-bar__field answer-bar__field--de"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === ansDe) return;
                 const existing = q || quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                 quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, answers: { ...existing.answers, de: text } } };
                 scheduleSave();
                 onRerender();
               }}
               onKeyDown=${(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
                 if (e.key === "Tab") {
                   e.preventDefault();
                   const text = e.target.textContent.trim();
                   if (text !== ansDe) {
                     const existing = q || quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                     quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, answers: { ...existing.answers, de: text } } };
                     scheduleSave();
                     onRerender();
                   }
                   requestAnimationFrame(() => { if (ansEnRef.current) ansEnRef.current.focus(); });
                 }
               }}>
          </div>
          <span class=${`answer-bar__sep ${!ansEn ? 'answer-bar__sep--hover' : ''}`}>⬧</span>
          <div ref=${ansEnRef} contentEditable
               class="answer-bar__field answer-bar__field--en"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === ansEn) return;
                 const existing = q || quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                 const en = text || existing.answers.de;
                 quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, answers: { ...existing.answers, en } } };
                 scheduleSave();
                 onRerender();
               }}
               onKeyDown=${(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
               }}>
          </div>
          <span class=${`answer-bar__tag answer-bar__tag--en ${!ansEn ? 'answer-bar__tag--edit' : ''}`}
                onClick=${(e) => { e.stopPropagation(); focusEnd(ansEnRef.current); }}>
            en
          </span>
        </div>
      `}
      ${withAnswers && html`
        <svg style="position:absolute;top:0;left:0;z-index:1" width="30" height="30" viewBox="0 0 30 30">
          <polygon points="0,0 27,0 0,27" fill=${SLIDE_STYLE.answer.backgroundColor} />
          <text x="4" y="12" fill=${SLIDE_STYLE.answer.color} font-size="10" font-weight="bold">A</text>
        </svg>
      `}
      ${answerImgLayout && html`<img ref=${ansImgRef} src=${imgEntry.data} style="position:absolute;object-fit:contain" />`}
      ${imgStyle && html`<img src=${imgEntry.data} style=${imgStyle} />`}
      ${slideKey && slideAudio.value[slideKey] && html`
        <div class="slide-audio" style="background:${bg}e0">
          <audio controls preload="none" src=${slideAudio.value[slideKey].data} />
          <span class="slide-audio__name">${slideAudio.value[slideKey].name}</span>
        </div>
      `}
      ${id && html`<${ImageActions} id=${id} withAnswers=${withAnswers} imgEntry=${imgEntry}
                     slideKey=${slideKey} onRerender=${onRerender} />`}
    </div>
  `;
}
