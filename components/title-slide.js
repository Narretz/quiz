import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, getSlideImages, DEFAULT_MONEY } from "../quiz-core.js";
import { PT_SCALE, PX, px, layoutImageBelowText, layoutTwoImagesBelowText } from "../lib/utils.js";
import { slideStyle, slideImages, slideDescriptors, jackpotSize, scheduleSave } from "../lib/state.js";
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

export function TitleSlide({ desc, anchor, onRerender }) {
  const bg = slideStyle.value.backgroundColor;
  const fg = slideStyle.value.textColor || '#000';
  const titleFs = SLIDE_STYLE.title.fontSize * PT_SCALE;
  const subtitleFs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const id = desc.id;
  const money = jackpotSize.value;
  const titleDe = desc.text.de || "";
  const titleEn = desc.text.en || "";
  const isJackpotTitle = titleDe === "Jackpot!";
  const jackpotSubtitle = isJackpotTitle && `ca. ${money + DEFAULT_MONEY} €`;
  const subtitleDe = desc.subtitle?.de || "";
  const subtitleEn = desc.subtitle?.en || "";

  const isRoundTitle = id?.startsWith("title-r");
  const titleForQuestions = isRoundTitle && !id.endsWith("-ans");

  const slideKey = id ? `${id}:0` : null;
  const [imgEntry, imgEntry1] = slideKey ? getSlideImages(slideImages.value, slideKey) : [null, null];
  const hasTwoImages = imgEntry && imgEntry1;
  let linkedSlideKey = null;
  if (titleForQuestions) {
    linkedSlideKey = `${id}-ans:0`;
  } else if (id?.endsWith("-ans")) {
    linkedSlideKey = `${id.replace("-ans", "")}:0`;
  }

  const textRef = useRef(null);
  const imgRef = useRef(null);
  const img1Ref = useRef(null);
  const deTextRef = useRef(null);
  const enTextRef = useRef(null);

  function updateField(lang, text) {
    const descs = slideDescriptors.value;
    const idx = descs.findIndex(d => d.id === id);
    if (idx === -1) return;
    const updated = [...descs];
    const old = updated[idx].text || { de: "", en: "" };
    updated[idx] = { ...updated[idx], text: { ...old, [lang]: text } };
    slideDescriptors.value = updated;
    scheduleSave();
    onRerender();
  }

  useLayoutEffect(() => {
    if (deTextRef.current && deTextRef.current !== document.activeElement)
      deTextRef.current.textContent = titleDe;
  }, [titleDe]);
  useLayoutEffect(() => {
    if (enTextRef.current && enTextRef.current !== document.activeElement)
      enTextRef.current.textContent = titleEn;
  }, [titleEn]);

  useLayoutEffect(() => {
    if (hasTwoImages) {
      layoutTwoImagesBelowText(textRef.current, imgRef.current, img1Ref.current, imgEntry, imgEntry1);
    } else {
      layoutImageBelowText(textRef.current, imgRef.current, imgEntry);
    }
  });

  function renderTitle() {
    if (isRoundTitle) {
      return html`
        <div class="title-bar" style="font-size:${titleFs}px;font-weight:bold">
          <span class="title-bar__tag title-bar__tag--de"
                onClick=${(e) => { e.stopPropagation(); focusEnd(deTextRef.current); }}>de</span>
          <span ref=${deTextRef} contentEditable class="title-bar__field"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === titleDe) return;
                 updateField("de", text);
               }}
               onKeyDown=${(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
                 if (e.key === "Tab") {
                   e.preventDefault();
                   e.target.blur();
                   requestAnimationFrame(() => focusEnd(enTextRef.current));
                 }
               }}></span>
          <span class=${`title-bar__sep ${(!titleDe || !titleEn) ? 'title-bar__sep--hover' : ''}`}>⬧</span>
          <span ref=${enTextRef} contentEditable class="title-bar__field"
               onBlur=${(e) => {
                 const text = e.target.textContent.trim();
                 if (text === titleEn) return;
                 updateField("en", text);
               }}
               onKeyDown=${(e) => {
                 if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
               }}></span>
          <span class=${`title-bar__tag title-bar__tag--en ${!titleEn ? 'title-bar__tag--edit' : ''}`}
                onClick=${(e) => { e.stopPropagation(); focusEnd(enTextRef.current); }}>en</span>
        </div>
      `;
    }
    // Non-editable title (Antworten, etc.)
    return html`
      <div style="font-size:${titleFs}px;font-weight:bold">${titleDe}</div>
      ${titleEn && html`<div style="margin-top:4px;font-size:${titleFs}px;font-weight:bold">${titleEn}</div>`}
    `;
  }

  function renderSubtitle() {
    if (!subtitleDe && !subtitleEn && !jackpotSubtitle) return null;
    if (jackpotSubtitle) {
      return html`<div style="margin-top:6px;font-size:${28 * PT_SCALE}px;font-weight:bold;color:#FFC000">${jackpotSubtitle}</div>`;
    }
    if (subtitleDe || subtitleEn) {
      return html`
        <div style="margin-top:6px;font-size:${subtitleFs}px;white-space:pre-line">${subtitleDe}${subtitleEn && html`<br/>${subtitleEn}`}</div>
      `;
    }
    return null;
  }

  if (imgEntry) {
    const { pad } = SLIDE_STYLE;
    return html`
      <div class="slide-outer">
        <div class="slide" id=${anchor || undefined}
             data-slide-id="${id}"
             style="background-color:${bg};color:${fg}">
          <div ref=${textRef} style="position:absolute;left:0;top:${px(pad)};width:100%;text-align:center">
            ${renderTitle()}
            ${renderSubtitle()}
          </div>
          <${SlideImage} src=${imgEntry.data} type=${imgEntry.type} name=${imgEntry.name} imgRef=${imgRef} slideKey=${slideKey} imgIdx=${0}
               isSource=${titleForQuestions} linkKey=${linkedSlideKey} onRerender=${onRerender} />
          ${hasTwoImages && html`<${SlideImage} src=${imgEntry1.data} type=${imgEntry1.type} name=${imgEntry1.name} imgRef=${img1Ref} slideKey=${slideKey} imgIdx=${1}
               isSource=${titleForQuestions} linkKey=${linkedSlideKey} onRerender=${onRerender} />`}
        </div>
        ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} linkedSlideKey=${linkedSlideKey}
                       imgEntry=${imgEntry} slideKey=${slideKey} onRerender=${onRerender} />`}
      </div>
    `;
  }

  return html`
    <div class="slide-outer">
      <div class="slide title-slide" id=${anchor || undefined}
           data-slide-id="${id}"
           style="background-color:${bg};color:${fg}">
        ${renderTitle()}
        ${renderSubtitle()}
      </div>
      ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} linkedSlideKey=${linkedSlideKey}
                     imgEntry=${imgEntry} slideKey=${slideKey} onRerender=${onRerender} />`}
    </div>
  `;
}
