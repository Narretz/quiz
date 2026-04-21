import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { SLIDE_STYLE, computeImageLayout, computeTwoImageLayout, getSlideImages } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "../lib/utils.js";
import { slideStyle, slideImages, slideOverrides, slideDescriptors, scheduleSave } from "../lib/state.js";
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

export function DescriptionSlide({ desc, descIdx, onRerender }) {
  const bg = slideStyle.value.backgroundColor;
  const fg = slideStyle.value.textColor || '#000';
  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const fs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const lh = SLIDE_STYLE.question.lineSpacing / 100;
  const deRef = useRef(null);
  const enRef = useRef(null);
  const deTextRef = useRef(null);
  const enTextRef = useRef(null);
  const slideRef = useRef(null);
  const id = desc.id;
  const slideKey = id ? `${id}:0` : null;
  const [imgEntry, imgEntry1] = slideKey ? getSlideImages(slideImages.value, slideKey) : [null, null];
  const hasTwoImages = imgEntry && imgEntry1;
  let deW = fullW, enW = fullW;
  let imgStyle = null, imgStyle1 = null;
  const toStyle = (img) => ({ position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h), objectFit: "contain" });
  if (hasTwoImages) {
    const layout = computeTwoImageLayout(imgEntry.width / imgEntry.height, imgEntry1.width / imgEntry1.height);
    deW = layout.deW;
    enW = layout.enW;
    imgStyle = toStyle(layout.img0);
    imgStyle1 = toStyle(layout.img1);
  } else if (imgEntry) {
    const layout = computeImageLayout(imgEntry.width / imgEntry.height);
    deW = layout.deW;
    enW = layout.enW;
    imgStyle = toStyle(layout.img);
  }

  function updateText(lang, text) {
    const descs = slideDescriptors.value;
    const idx = descs.findIndex(d => d.id === id);
    if (idx === -1) return;
    const updated = [...descs];
    updated[idx] = { ...updated[idx], text: { ...updated[idx].text, [lang]: text } };
    slideDescriptors.value = updated;
    scheduleSave();
    onRerender();
  }

  // Sync text fields imperatively — avoid Preact overwriting user edits
  useLayoutEffect(() => {
    if (deTextRef.current && deTextRef.current !== document.activeElement) {
      deTextRef.current.textContent = desc.text.de || "";
    }
  }, [desc.text.de]);
  useLayoutEffect(() => {
    if (enTextRef.current && enTextRef.current !== document.activeElement) {
      enTextRef.current.textContent = desc.text.en || "";
    }
  }, [desc.text.en]);

  useLayoutEffect(() => {
    if ((imgEntry || hasTwoImages) && slideRef.current) {
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
  }, [imgEntry, imgEntry1, desc.text.de, desc.text.en]);

  return html`
    <div class="slide-outer" data-desc-idx=${descIdx}>
    <div class="slide" ref=${slideRef} style="background-color:${bg};color:${fg}"
         data-slide-id=${id} data-answers="0">
      ${imgStyle && html`<${SlideImage} src=${imgEntry.data} type=${imgEntry.type} name=${imgEntry.name} style=${imgStyle} slideKey=${slideKey} imgIdx=${0}
           isSource=${false} linkKey=${null} onRerender=${onRerender} />`}
      ${imgStyle1 && html`<${SlideImage} src=${imgEntry1.data} type=${imgEntry1.type} name=${imgEntry1.name} style=${imgStyle1} slideKey=${slideKey} imgIdx=${1}
           isSource=${false} linkKey=${null} onRerender=${onRerender} />`}
      <div ref=${deRef} lang="de" data-role="de" style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(deW)};font-size:${fs}px;line-height:${lh};white-space:pre-line">
        <span ref=${deTextRef} contentEditable class="q-text__field"
             onBlur=${(e) => {
               const text = e.target.textContent.trim();
               if (text === (desc.text.de || "")) return;
               updateText("de", text);
             }}
             onKeyDown=${(e) => {
               if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
               if (e.key === "Tab") {
                 e.preventDefault();
                 const text = e.target.textContent.trim();
                 if (text !== (desc.text.de || "")) updateText("de", text);
                 requestAnimationFrame(() => { if (enTextRef.current) focusEnd(enTextRef.current); });
               }
             }}></span>
        <span class="q-text__tag q-text__tag--de" onClick=${(e) => { e.stopPropagation(); focusEnd(deTextRef.current); }}>de</span>
      </div>
      <div ref=${enRef} lang="en" data-role="en" style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(enW)};font-size:${fs}px;line-height:${lh};white-space:pre-line">
        <span ref=${enTextRef} contentEditable class="q-text__field"
             onBlur=${(e) => {
               const text = e.target.textContent.trim();
               if (text === (desc.text.en || "")) return;
               updateText("en", text);
             }}
             onKeyDown=${(e) => {
               if (e.key === "Enter") { e.preventDefault(); e.target.blur(); }
             }}></span>
        <span class="q-text__tag q-text__tag--en" onClick=${(e) => { e.stopPropagation(); focusEnd(enTextRef.current); }}>en</span>
      </div>
    </div>
    ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} imgEntry=${imgEntry}
                   slideKey=${slideKey} onRerender=${onRerender} />`}
    </div>
  `;
}
