import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, computeImageLayout, formatAnswer } from "../quiz-core.js";
import { PT_SCALE, px, esc } from "../lib/utils.js";
import { slideImages, slideAudio, manualOverrides, slideStyle, slideOverrides } from "../lib/state.js";
import { fitSlideText } from "../lib/fitting.js";
import { ImageActions } from "./image-actions.js";

const html = htm.bind(h);

export function QuestionSlide({ desc, onRerender }) {
  const { q, num, withAnswers, id } = desc;
  const slideKey = id ? `${id}:${withAnswers ? 1 : 0}` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const style = slideStyle.value;
  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const bg = style.backgroundColor;
  const slideRef = useRef(null);

  let deW = fullW, enW = fullW;
  let imgStyle = null;

  if (imgEntry && !q) {
    // No text — image fills the slide
    const ar = imgEntry.width / imgEntry.height;
    const W = SLIDE_STYLE.width, H = SLIDE_STYLE.height;
    const boxW = W - 2 * pad, boxH = H - 2 * pad;
    const fitW = ar > boxW / boxH ? boxW : boxH * ar;
    const fitH = ar > boxW / boxH ? boxW / ar : boxH;
    imgStyle = { position: "absolute", left: px((W - fitW) / 2), top: px((H - fitH) / 2), width: px(fitW), height: px(fitH), objectFit: "contain" };
  } else if (imgEntry) {
    const layout = computeImageLayout(imgEntry.width / imgEntry.height);
    deW = layout.deW;
    enW = layout.enW;
    const { img } = layout;
    imgStyle = { position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h), objectFit: "contain" };
  }

  const qFs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const qLh = SLIDE_STYLE.question.lineSpacing / 100;
  const numFs = SLIDE_STYLE.num.fontSize * PT_SCALE;
  const ansFs = SLIDE_STYLE.answer.fontSize * PT_SCALE;

  // Text fitting pass — runs after DOM is laid out
  useLayoutEffect(() => {
    if (!slideRef.current) return;
    if (!imgEntry) {
      // Reset styles that fitSlideText may have mutated directly on the DOM —
      // Preact won't re-apply them because the template values haven't changed.
      const deEl = slideRef.current.querySelector('[data-role="de"]');
      const enEl = slideRef.current.querySelector('[data-role="en"]');
      if (deEl) {
        deEl.style.fontSize = qFs + "px";
        deEl.style.lineHeight = String(qLh);
        deEl.style.width = px(fullW);
      }
      if (enEl) {
        enEl.style.fontSize = qFs + "px";
        enEl.style.lineHeight = String(qLh);
        enEl.style.width = px(fullW);
        enEl.style.top = px(2.5);
      }
      return;
    }
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
      ${q ? html`
        <div data-role="de" style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(deW)};font-size:${qFs}px;line-height:${qLh}">
          <span style="font-size:${numFs}px;font-weight:bold">${num}</span>${" "}${q.text.de}
        </div>
        ${q.text.en && html`
          <div data-role="en" style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(enW)};font-size:${qFs}px;line-height:${qLh}">
            ${q.text.en}
          </div>
        `}
        ${withAnswers && html`
          <div style="position:absolute;left:0;bottom:0;width:100%;font-size:${ansFs}px;font-weight:bold;text-align:center;background:${SLIDE_STYLE.answer.backgroundColor};color:${SLIDE_STYLE.answer.color};padding:4px 0;z-index:1">
            ${formatAnswer(q)}
          </div>
        `}
      ` : html`
        <div style="position:absolute;left:${px(pad)};top:${px(pad)};font-size:${numFs}px;font-weight:bold">${num}</div>
      `}
      ${withAnswers && html`
        <svg style="position:absolute;top:0;left:0;z-index:1" width="30" height="30" viewBox="0 0 30 30">
          <polygon points="0,0 27,0 0,27" fill=${SLIDE_STYLE.answer.backgroundColor} />
          <text x="4" y="12" fill=${SLIDE_STYLE.answer.color} font-size="10" font-weight="bold">A</text>
        </svg>
      `}
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
