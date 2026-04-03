import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, computeImageLayout } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideStyle, slideImages, slideAudio, slideOverrides } from "../lib/state.js";
import { fitSlideText } from "../lib/fitting.js";
import { ImageActions } from "./image-actions.js";

const html = htm.bind(h);

export function DescriptionSlide({ desc, onRerender }) {
  const bg = slideStyle.value.backgroundColor;
  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const fs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const lh = SLIDE_STYLE.question.lineSpacing / 100;
  const deRef = useRef(null);
  const enRef = useRef(null);
  const slideRef = useRef(null);
  const id = desc.id;
  const slideKey = id ? `${id}:0` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const audioEntry = slideKey && slideAudio.value[slideKey];

  let deW = fullW, enW = fullW;
  let imgStyle = null;
  if (imgEntry) {
    const layout = computeImageLayout(imgEntry.width / imgEntry.height);
    deW = layout.deW;
    enW = layout.enW;
    const { img } = layout;
    imgStyle = { position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h), objectFit: "contain" };
  }

  useLayoutEffect(() => {
    if (imgEntry && slideRef.current) {
      const result = fitSlideText(slideRef.current, slideImages.value);
      // Write to slideOverrides signal — used by debug inputs and PPTX export
      if (result) {
        const prev = slideOverrides.value[slideKey];
        if (!prev || prev.fontSize !== result.fontSize || prev.lineSpacing !== result.lineSpacing || prev.enY !== result.enY) {
          slideOverrides.value = { ...slideOverrides.value, [slideKey]: result };
        }
      }
    } else {
      // Reset styles that fitSlideText may have mutated directly on the DOM —
      // Preact won't re-apply them because the template values haven't changed.
      if (deRef.current) {
        deRef.current.style.fontSize = fs + "px";
        deRef.current.style.lineHeight = String(lh);
        deRef.current.style.width = px(fullW);
      }
      if (enRef.current) {
        enRef.current.style.fontSize = fs + "px";
        enRef.current.style.lineHeight = String(lh);
        enRef.current.style.width = px(fullW);
        const deBottom = pad + deRef.current.scrollHeight / PX;
        const enY = Math.max(2.5, deBottom + pad);
        enRef.current.style.top = Math.round(enY * PX) + "px";
      }
    }
  });

  return html`
    <div class="slide" ref=${slideRef} style="background-color:${bg}"
         data-slide-id=${id} data-answers="0">
      ${imgStyle && html`<img src=${imgEntry.data} style=${imgStyle} />`}
      <div ref=${deRef} data-role="de" style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(deW)};font-size:${fs}px;line-height:${lh};white-space:pre-line">
        ${desc.text.de}
      </div>
      ${desc.text.en && html`
        <div ref=${enRef} data-role="en" style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(enW)};font-size:${fs}px;line-height:${lh};white-space:pre-line">
          ${desc.text.en}
        </div>
      `}
      ${audioEntry && html`
        <div class="slide-audio" style="background:${bg}e0">
          <audio controls preload="none" src=${audioEntry.data} />
          <span class="slide-audio__name">${audioEntry.name}</span>
        </div>
      `}
      ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} imgEntry=${imgEntry}
                     slideKey=${slideKey} onRerender=${onRerender} />`}
    </div>
  `;
}
