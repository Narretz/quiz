import { h } from "preact";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { PT_SCALE, esc } from "../lib/utils.js";
import { slideStyle } from "../lib/state.js";

const html = htm.bind(h);

export function TitleSlide({ desc, anchor }) {
  const bg = slideStyle.value.backgroundColor;
  const titleFs = SLIDE_STYLE.title.fontSize * PT_SCALE;
  const subtitleFs = SLIDE_STYLE.question.fontSize * PT_SCALE;

  return html`
    <div class="slide title-slide" id=${anchor || undefined}
         style="background-color:${bg}">
      <span class="title-text" style="font-size:${titleFs}px">${desc.text}</span>
      ${desc.subtitle && html`
        <div style="margin-top:12px;font-size:${subtitleFs}px;white-space:pre-line">${desc.subtitle}</div>
      `}
    </div>
  `;
}
