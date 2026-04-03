import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, fit } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideStyle, slideImages, slideAudio } from "../lib/state.js";
import { ImageActions } from "./image-actions.js";

const html = htm.bind(h);

export function TitleSlide({ desc, anchor, onRerender }) {
  const bg = slideStyle.value.backgroundColor;
  const titleFs = SLIDE_STYLE.title.fontSize * PT_SCALE;
  const subtitleFs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const id = desc.id;
  const slideKey = id ? `${id}:0` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const audioEntry = slideKey && slideAudio.value[slideKey];
  const textRef = useRef(null);
  const imgRef = useRef(null);

  // When image present: measure text, position image below
  useLayoutEffect(() => {
    if (!imgEntry || !textRef.current || !imgRef.current) return;
    const { pad, width: W, height: H } = SLIDE_STYLE;
    const textBottom = (textRef.current.offsetTop + textRef.current.offsetHeight) / PX;
    const imgTop = textBottom + pad;
    const boxW = W - 2 * pad;
    const boxH = H - pad - imgTop;
    if (boxH <= 0) return;
    const ar = imgEntry.width / imgEntry.height;
    const { w, h } = fit(boxW, boxH, ar);
    const imgEl = imgRef.current;
    imgEl.style.left = px((W - w) / 2);
    imgEl.style.top = px(imgTop);
    imgEl.style.width = px(w);
    imgEl.style.height = px(h);
  });

  if (imgEntry) {
    // Image mode: text at top, image below
    const { pad } = SLIDE_STYLE;
    return html`
      <div class="slide" id=${anchor || undefined} style="background-color:${bg}">
        <div ref=${textRef} style="position:absolute;left:0;top:${px(pad)};width:100%;text-align:center">
          <span class="title-text" style="font-size:${titleFs}px">${desc.text}</span>
          ${desc.subtitle && html`
            <div style="margin-top:8px;font-size:${subtitleFs}px;white-space:pre-line">${desc.subtitle}</div>
          `}
        </div>
        <img ref=${imgRef} src=${imgEntry.data} style="position:absolute;object-fit:contain" />
        ${audioEntry && html`
          <div class="slide-audio" style="background:${bg}e0">
            <audio controls preload="none" src=${audioEntry.data} />
            <span class="slide-audio__name">${audioEntry.name}</span>
          </div>
        `}
        ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} imgEntry=${imgEntry}
                       slideKey=${slideKey} fittingResult=${null} onRerender=${onRerender} />`}
      </div>
    `;
  }

  // No image: centered layout
  return html`
    <div class="slide title-slide" id=${anchor || undefined}
         style="background-color:${bg}">
      <span class="title-text" style="font-size:${titleFs}px">${desc.text}</span>
      ${desc.subtitle && html`
        <div style="margin-top:12px;font-size:${subtitleFs}px;white-space:pre-line">${desc.subtitle}</div>
      `}
      ${audioEntry && html`
        <div class="slide-audio" style="background:${bg}e0">
          <audio controls preload="none" src=${audioEntry.data} />
          <span class="slide-audio__name">${audioEntry.name}</span>
        </div>
      `}
      ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} imgEntry=${imgEntry}
                     slideKey=${slideKey} fittingResult=${null} onRerender=${onRerender} />`}
    </div>
  `;
}
