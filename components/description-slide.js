import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideStyle, slideImages, slideAudio } from "../lib/state.js";
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
  const id = desc.id;
  const slideKey = id ? `${id}:0` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const audioEntry = slideKey && slideAudio.value[slideKey];

  useLayoutEffect(() => {
    if (!deRef.current || !enRef.current) return;
    const deBottom = pad + deRef.current.scrollHeight / PX;
    const enY = Math.max(2.5, deBottom + pad);
    enRef.current.style.top = Math.round(enY * PX) + "px";
  });

  return html`
    <div class="slide" style="background-color:${bg}">
      ${imgEntry && html`<img src=${imgEntry.data} style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;z-index:0" />`}
      <div ref=${deRef} style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(fullW)};font-size:${fs}px;line-height:${lh};white-space:pre-line;z-index:1">
        ${desc.text.de}
      </div>
      ${desc.text.en && html`
        <div ref=${enRef} style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(fullW)};font-size:${fs}px;line-height:${lh};white-space:pre-line;z-index:1">
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
                     slideKey=${slideKey} fittingResult=${null} onRerender=${onRerender} />`}
    </div>
  `;
}
