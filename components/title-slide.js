import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { PT_SCALE, PX, px, layoutImageBelowText } from "../lib/utils.js";
import { slideStyle, slideImages, slideAudio } from "../lib/state.js";
import { ImageActions } from "./image-actions.js";

const html = htm.bind(h);

export function TitleSlide({ desc, anchor, onRerender }) {
  const bg = slideStyle.value.backgroundColor;
  const titleFs = SLIDE_STYLE.title.fontSize * PT_SCALE;
  const subtitleFs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const id = desc.id;

  const titleForQuestions = id?.startsWith("title-r") && !id.endsWith("-ans");

  const slideKey = id ? `${id}:0` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const audioEntry = slideKey && slideAudio.value[slideKey];
  // Link round question titles ↔ answer titles
  let linkedSlideKey = null;
  if (titleForQuestions) {
    linkedSlideKey = `${id}-ans:0`;
  } else if (id?.endsWith("-ans")) {
    linkedSlideKey = `${id.replace("-ans", "")}:0`;
  }
  const textRef = useRef(null);
  const imgRef = useRef(null);

  useLayoutEffect(() => {
    layoutImageBelowText(textRef.current, imgRef.current, imgEntry);
  });

  if (imgEntry) {
    // Image mode: text at top, image below
    const { pad } = SLIDE_STYLE;
    return html`
      <div class="slide" id=${anchor || undefined}
           data-slide-id="${id}"
           style="background-color:${bg}">
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
        ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} linkedSlideKey=${linkedSlideKey}
                       imgEntry=${imgEntry} slideKey=${slideKey} fittingResult=${null} onRerender=${onRerender} />`}
      </div>
    `;
  }

  // No image: centered layout
  return html`
    <div class="slide title-slide" id=${anchor || undefined}
         data-slide-id="${id}"
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
      ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} linkedSlideKey=${linkedSlideKey}
                     imgEntry=${imgEntry} slideKey=${slideKey} fittingResult=${null} onRerender=${onRerender} />`}
    </div>
  `;
}
