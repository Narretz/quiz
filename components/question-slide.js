import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, computeImageLayout, computeTwoImageLayout, getSlideImages, fit } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideImages, quizQuestions, manualOverrides, slideStyle, slideOverrides, scheduleSave } from "../lib/state.js";
import { fitSlideText } from "../lib/fitting.js";
import { ImageActions } from "./image-actions.js";
import { SlideImage } from "./slide-image.js";

const html = htm.bind(h);

function focusEnd(el) {
  if (!el) return;
  el.focus();
  const sel = window.getSelection();
  sel.selectAllChildren(el);
  sel.collapseToEnd();
}

export function QuestionSlide({ desc, onRerender }) {
  const { num, withAnswers, id } = desc;
  const q = quizQuestions.value[id] || desc.q; // desc.q fallback for old saves
  const slideKey = id ? `${id}:${withAnswers ? 1 : 0}` : null;
  const [imgEntry, imgEntry1] = slideKey ? getSlideImages(slideImages.value, slideKey) : [null, null];
  const hasTwoImages = imgEntry && imgEntry1;
  const style = slideStyle.value;
  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const bg = style.backgroundColor;
  const slideRef = useRef(null);
  const ansBarRef = useRef(null);
  const ansDeRef = useRef(null);
  const ansEnRef = useRef(null);
  const ansImgRef = useRef(null);
  const deTextRef = useRef(null);
  const enTextRef = useRef(null);

  let deW = fullW, enW = fullW;
  let imgStyle = null, imgStyle1 = null;
  const hasQuestionText = q && (q.text.de || q.text.en);
  const hasAnswer = q && (q.answers.de || q.answers.en);
  // No question text + answer + image on answer slide: image above answer bar (measured via ref)
  const answerImgLayout = withAnswers && imgEntry && !hasQuestionText && hasAnswer;

  if (imgEntry && !answerImgLayout) {
    if (hasTwoImages && hasQuestionText) {
      // Two images: side-by-side at bottom
      const layout = computeTwoImageLayout(imgEntry.width / imgEntry.height, imgEntry1.width / imgEntry1.height);
      deW = layout.deW;
      enW = layout.enW;
      const toStyle = (img) => ({ position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h), objectFit: "contain" });
      imgStyle = toStyle(layout.img0);
      imgStyle1 = toStyle(layout.img1);
    } else if (!hasQuestionText) {
      // No question text, no answer bar — image(s) fill the slide
      const ar = imgEntry.width / imgEntry.height;
      const W = SLIDE_STYLE.width, H = SLIDE_STYLE.height;
      if (hasTwoImages) {
        const W = SLIDE_STYLE.width, H = SLIDE_STYLE.height;
        const gap = pad;
        const boxW = (W - 2 * pad - gap) / 2, boxH = H - 2 * pad;
        const f0 = fit(boxW, boxH, ar), f1 = fit(boxW, boxH, imgEntry1.width / imgEntry1.height);
        const toStyle = (img) => ({ position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h), objectFit: "contain" });
        imgStyle = toStyle({ x: pad + (boxW - f0.w) / 2, y: (H - f0.h) / 2, w: f0.w, h: f0.h });
        imgStyle1 = toStyle({ x: pad + boxW + gap + (boxW - f1.w) / 2, y: (H - f1.h) / 2, w: f1.w, h: f1.h });
      } else {
        const boxW = W - 2 * pad, boxH = H - 2 * pad;
        const fitW = ar > boxW / boxH ? boxW : boxH * ar;
        const fitH = ar > boxW / boxH ? boxW / ar : boxH;
        imgStyle = { position: "absolute", left: px((W - fitW) / 2), top: px((H - fitH) / 2), width: px(fitW), height: px(fitH), objectFit: "contain" };
      }
    } else {
      // Single image with question text — aspect-ratio based layout
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

  const ansImg1Ref = useRef(null);
  // Answer slide image layout: fill space between number and answer bar
  useLayoutEffect(() => {
    if (!answerImgLayout || !ansBarRef.current || !ansImgRef.current) return;
    const { width: W, height: H } = SLIDE_STYLE;
    const ansBarH = ansBarRef.current.offsetHeight / PX;
    const imgTop = pad + 0.5; // below number
    const imgBottom = H - ansBarH;
    const boxH = imgBottom - imgTop - pad;
    if (boxH <= 0) return;
    if (hasTwoImages && ansImg1Ref.current) {
      const layout = computeTwoImageLayout(imgEntry.width / imgEntry.height, imgEntry1.width / imgEntry1.height);
      // Adjust vertical position to fit between number and answer bar
      const scale = boxH / (H * 0.45);
      for (const [el, img] of [[ansImgRef.current, layout.img0], [ansImg1Ref.current, layout.img1]]) {
        const { w, h } = fit((W - 2 * pad - pad) / 2, boxH, img.w / img.h);
        el.style.left = px(img.x);
        el.style.top = px(imgTop + (boxH - h) / 2);
        el.style.width = px(w);
        el.style.height = px(h);
      }
    } else {
      const boxW = W - 2 * pad;
      const ar = imgEntry.width / imgEntry.height;
      const { w, h } = fit(boxW, boxH, ar);
      const el = ansImgRef.current;
      el.style.left = px((W - w) / 2);
      el.style.top = px(imgTop);
      el.style.width = px(w);
      el.style.height = px(h);
    }
  });

  // Measure answer bar height and store for PPTX export
  useLayoutEffect(() => {
    if (!ansBarRef.current || !withAnswers || !slideKey) return;
    const answerH = ansBarRef.current.offsetHeight / PX;
    if (answerH > 0) {
      const prev = slideOverrides.value[slideKey];
      if (!prev || prev.answerH !== answerH) {
        slideOverrides.value = { ...slideOverrides.value, [slideKey]: { ...prev, answerH } };
      }
    }
  }, [ansDe, ansEn]);

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

  // Sync question text fields imperatively — avoid Preact overwriting user edits
  useLayoutEffect(() => {
    if (deTextRef.current && deTextRef.current !== document.activeElement) {
      deTextRef.current.textContent = q?.text?.de || "";
    }
  }, [q?.text?.de]);
  useLayoutEffect(() => {
    if (enTextRef.current && enTextRef.current !== document.activeElement) {
      enTextRef.current.textContent = q?.text?.en || "";
    }
  }, [q?.text?.en]);

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
      if (!prev || prev.fontSize !== result.fontSize || prev.lineSpacing !== result.lineSpacing || prev.enY !== result.enY || prev.twoImageFrac !== result.twoImageFrac) {
        slideOverrides.value = { ...slideOverrides.value, [slideKey]: result };
      }
    }
  }, [imgEntry, imgEntry1, slideKey, style.fontSize, style.lineSpacing, q?.text?.de, q?.text?.en]);

  return html`
    <div class="slide-outer">
    <div class="slide" ref=${slideRef} style="background-color:${bg};color:${style.textColor || '#000'}"
         data-slide-id=${id} data-answers=${withAnswers ? "1" : "0"}>
      ${q ? html`
        <div lang="de" data-role="de" style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(deW)};font-size:${qFs}px;line-height:${qLh}">
          <span style="font-size:${numFs}px;font-weight:bold">${num}</span>${" "}<span ref=${deTextRef} contentEditable class="q-text__field"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === (q.text.de || "")) return;
                 const existing = quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                 quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, text: { ...existing.text, de: text } } };
                 scheduleSave();
                 onRerender();
               }}
               onKeyDown=${(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
                 if (e.key === "Tab") {
                   e.preventDefault();
                   const text = e.target.textContent.trim();
                   if (text !== (q.text.de || "")) {
                     const existing = quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                     quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, text: { ...existing.text, de: text } } };
                     scheduleSave();
                     onRerender();
                   }
                   requestAnimationFrame(() => { if (enTextRef.current) focusEnd(enTextRef.current); });
                 }
               }}></span>
          <span class="q-text__tag q-text__tag--de" onClick=${(e) => { e.stopPropagation(); focusEnd(deTextRef.current); }}>de</span>
        </div>
        <div lang="en" data-role="en" style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(enW)};font-size:${qFs}px;line-height:${qLh}">
          <span ref=${enTextRef} contentEditable class="q-text__field"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === (q.text.en || "")) return;
                 const existing = quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                 quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, text: { ...existing.text, en: text } } };
                 scheduleSave();
                 onRerender();
               }}
               onKeyDown=${(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
               }}></span>
          <span class="q-text__tag q-text__tag--en" onClick=${(e) => { e.stopPropagation(); focusEnd(enTextRef.current); }}>en</span>
        </div>
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
          <span ref=${ansDeRef} contentEditable class="answer-bar__field answer-bar__field--de"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === ansDe) return;
                 const existing = q || quizQuestions.value[id] || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
                 const en = ansEn ? existing.answers.en : text;
                 quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, answers: { de: text, en } } };
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
                     const en = ansEn ? existing.answers.en : text;
                     quizQuestions.value = { ...quizQuestions.value, [id]: { ...existing, answers: { de: text, en } } };
                     scheduleSave();
                     onRerender();
                   }
                   requestAnimationFrame(() => { if (ansEnRef.current) ansEnRef.current.focus(); });
                 }
               }}>
          </span>
          <span class=${`answer-bar__sep ${(!ansDe || !ansEn) ? 'answer-bar__sep--hover' : ''}`}>⬧</span>
          <span ref=${ansEnRef} contentEditable
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
          </span>
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
      ${answerImgLayout && html`<${SlideImage} src=${imgEntry.data} type=${imgEntry.type} name=${imgEntry.name} imgRef=${ansImgRef} slideKey=${slideKey} imgIdx=${0}
           isSource=${!withAnswers} linkKey=${`${id}:${withAnswers ? 0 : 1}`} onRerender=${onRerender} />`}
      ${answerImgLayout && hasTwoImages && html`<${SlideImage} src=${imgEntry1.data} type=${imgEntry1.type} name=${imgEntry1.name} imgRef=${ansImg1Ref} slideKey=${slideKey} imgIdx=${1}
           isSource=${!withAnswers} linkKey=${`${id}:${withAnswers ? 0 : 1}`} onRerender=${onRerender} />`}
      ${imgStyle && html`<${SlideImage} src=${imgEntry.data} type=${imgEntry.type} name=${imgEntry.name} style=${imgStyle} slideKey=${slideKey} imgIdx=${0}
           isSource=${!withAnswers} linkKey=${`${id}:${withAnswers ? 0 : 1}`} onRerender=${onRerender} />`}
      ${imgStyle1 && html`<${SlideImage} src=${imgEntry1.data} type=${imgEntry1.type} name=${imgEntry1.name} style=${imgStyle1} slideKey=${slideKey} imgIdx=${1}
           isSource=${!withAnswers} linkKey=${`${id}:${withAnswers ? 0 : 1}`} onRerender=${onRerender} />`}
    </div>
    ${id && html`<${ImageActions} id=${id} withAnswers=${withAnswers} imgEntry=${imgEntry}
                   slideKey=${slideKey} onRerender=${onRerender} />`}
    </div>
  `;
}
