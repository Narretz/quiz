import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideStyle } from "../lib/state.js";

const html = htm.bind(h);

export function DescriptionSlide({ desc }) {
  const bg = slideStyle.value.backgroundColor;
  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const fs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const lh = SLIDE_STYLE.question.lineSpacing / 100;
  const deRef = useRef(null);
  const enRef = useRef(null);

  useLayoutEffect(() => {
    if (!deRef.current || !enRef.current) return;
    const deBottom = pad + deRef.current.scrollHeight / PX;
    const enY = Math.max(2.5, deBottom + pad);
    enRef.current.style.top = Math.round(enY * PX) + "px";
  });

  return html`
    <div class="slide" style="background-color:${bg}">
      <div ref=${deRef} style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(fullW)};font-size:${fs}px;line-height:${lh};white-space:pre-line">
        ${desc.text.de}
      </div>
      ${desc.text.en && html`
        <div ref=${enRef} style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(fullW)};font-size:${fs}px;line-height:${lh};white-space:pre-line">
          ${desc.text.en}
        </div>
      `}
    </div>
  `;
}
