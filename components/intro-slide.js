import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { INTRO_SLIDES } from "../lib/intro-slides.js";
import { SLIDE_STYLE, getSlideImages } from "../quiz-core.js";
import { PT_SCALE, px, PX, layoutImagesBelowText, layoutImageBelowY, layoutTwoImagesBelowY } from "../lib/utils.js";
import { slideStyle, slideImages, jackpotSize, quizEmail } from "../lib/state.js";
import { ImageActions } from "./image-actions.js";
import { SlideImage } from "./slide-image.js";

const html = htm.bind(h);

function replaceVars(text, vars) {
  return text.replace(/\{(\w+)\}/g, (m, key) => key in vars ? String(vars[key]) : m);
}

function c(color) {
  return color ? `#${color}` : SLIDE_STYLE.textColor;
}

export function IntroSlide({ introIndex, anchor, id, onRerender, desc, descIdx }) {
  const data = desc?.data || INTRO_SLIDES[introIndex];
  if (!data) return null;
  const style = data.style || data.id; // migration fallback for old saves
  const bg = slideStyle.value.backgroundColor;
  const fg = slideStyle.value.textColor || '#000';
  const vars = { money: jackpotSize.value, email: quizEmail.value || "" };
  const slideKey = id ? `${id}:0` : null;
  const [imgEntry, imgEntry1] = slideKey ? getSlideImages(slideImages.value, slideKey) : [null, null];
  const hasTwoImages = imgEntry && imgEntry1;
  if (style === "welcome") {
    const t = data.toucan;
    return html`
      <div class="slide-outer" data-desc-idx=${descIdx}>
        <div class="slide" id=${anchor || undefined} style="background-color:${bg};color:${fg};position:relative">
          <img src="./lib/assets/tipperary-logo.gif" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain" />
          <img src="./lib/assets/pub-quiz-toucan.jpg" style="position:absolute;left:${px(t.x)};top:${px(t.y)};width:${px(t.w)};height:${px(t.h)};object-fit:contain" />
          <img src="./lib/assets/pub-quiz-toucan.jpg" style="position:absolute;right:${px(t.x)};top:${px(t.y)};width:${px(t.w)};height:${px(t.h)};object-fit:contain" />
          <div style="position:absolute;left:0;top:${data.titleY};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;color:#${data.title.color}">${data.title.text}</div>
          <div style="position:absolute;left:0;top:${data.subtitleY};width:100%;text-align:center">
            ${data.subtitle.map((l) => html`
              <div style="font-size:${l.fontSize * PT_SCALE}px;font-weight:bold;color:${c(l.color)}">${l.text}</div>
            `)}
          </div>
          ${mediaOverlay()}
        </div>
        ${actionsOverlay()}
      </div>
    `;
  }

  if (style === "rules") {
    const sections = data.sections.filter((sec) => !sec.showIf || vars[sec.showIf]);
    const cp = data.contentPad || 0;
    const compact = imgEntry && data.compactWhenImage;
    const titleY = imgEntry && !compact ? SLIDE_STYLE.pad : data.titleY;
    const sectionStartY = compact ? compact.sectionStartY
      : (imgEntry ? SLIDE_STYLE.pad + 0.6 : data.sectionStartY);
    const sectionGap = compact?.sectionGap ?? data.sectionGap;
    const defaultFontSize = compact?.defaultFontSize ?? data.defaultFontSize;
    const lineHeight = compact?.lineHeight ?? data.lineHeight;

    let textBottom = sectionStartY;
    const sectionEls = sections.map((sec, si) => {
      const y = sectionStartY + si * sectionGap;
      const lines = sec.lines.filter((line) => !line.showIf || vars[line.showIf]);
      const sectionH = sec.wrap ? (sectionGap || (SLIDE_STYLE.height - y)) : lines.length * lineHeight;
      textBottom = Math.max(textBottom, y + sectionH);
      const renderRuns = (runs) => runs.map((r) => html`<span style="color:${c(r.color || data.defaultColor)};${r.bold ? 'font-weight:bold;' : ''}${r.underline ? 'text-decoration:underline;' : ''}${r.fontSize ? `font-size:${r.fontSize * PT_SCALE}px;` : ''}">${replaceVars(r.text, vars)}</span>`);
      const wrapStyles = sec.wrap ? `height:${px(sectionH)};overflow:hidden;` : '';
      return html`
        <div style="position:absolute;left:${px(SLIDE_STYLE.pad + cp)};top:${px(y)};width:${px(SLIDE_STYLE.width - 2 * SLIDE_STYLE.pad - 2 * cp)};${wrapStyles}font-size:${defaultFontSize * PT_SCALE}px;text-align:center;color:${c(data.defaultColor)};line-height:${lineHeight * PX}px">
          ${lines.map((line) => html`<div>${sec.bullet ? sec.bullet + " " : null}${renderRuns(line.runs)}</div>`)}
        </div>
      `;
    });

    const imgElRef = useRef(null);
    const img1ElRef = useRef(null);
    useLayoutEffect(() => {
      if (!imgEntry) return;
      if (hasTwoImages) layoutTwoImagesBelowY(imgElRef.current, img1ElRef.current, imgEntry, imgEntry1, textBottom);
      else layoutImageBelowY(imgElRef.current, imgEntry, textBottom);
    });

    return html`
      <div class="slide-outer" data-desc-idx=${descIdx}>
        <div class="slide" id=${anchor || undefined} style="background-color:${bg};color:${fg}">
          <div style="position:absolute;left:0;top:${px(titleY)};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:${c(data.title.color)}">
            ${data.title.text}
          </div>
          ${sectionEls}
          ${imgEntry && html`<${SlideImage} src=${imgEntry.data} type=${imgEntry.type} name=${imgEntry.name} imgRef=${imgElRef} slideKey=${slideKey} imgIdx=${0}
               isSource=${false} linkKey=${null} onRerender=${onRerender} />`}
          ${hasTwoImages && html`<${SlideImage} src=${imgEntry1.data} type=${imgEntry1.type} name=${imgEntry1.name} imgRef=${img1ElRef} slideKey=${slideKey} imgIdx=${1}
               isSource=${false} linkKey=${null} onRerender=${onRerender} />`}
          ${mediaOverlay()}
        </div>
        ${actionsOverlay()}
      </div>
    `;
  }

  if (style === "begin") {
    const textRef = useRef(null);
    const imgElRef = useRef(null);
    const img1ElRef = useRef(null);

    useLayoutEffect(() => {
      layoutImagesBelowText(textRef.current, imgElRef.current, img1ElRef.current, imgEntry, imgEntry1);
    });

    if (imgEntry) {
      const { pad: p } = SLIDE_STYLE;
      return html`
        <div class="slide-outer" data-desc-idx=${descIdx}>
          <div class="slide" style="background-color:${bg};color:${fg}">
            <div ref=${textRef} style="position:absolute;left:${px(p)};top:${px(p)};width:${px(SLIDE_STYLE.width - 2 * p)};text-align:center">
              ${data.lines.map((l) => html`
                <div style="font-size:${l.fontSize * PT_SCALE}px;${l.bold ? 'font-weight:bold;' : ''}color:${c(l.color)};${l.marginTop ? `margin-top:${l.marginTop * PX}px;` : ''}">${l.text}</div>
              `)}
            </div>
            <${SlideImage} src=${imgEntry.data} type=${imgEntry.type} name=${imgEntry.name} imgRef=${imgElRef} slideKey=${slideKey} imgIdx=${0}
                 isSource=${false} linkKey=${null} onRerender=${onRerender} />
            ${hasTwoImages && html`<${SlideImage} src=${imgEntry1.data} type=${imgEntry1.type} name=${imgEntry1.name} imgRef=${img1ElRef} slideKey=${slideKey} imgIdx=${1}
                 isSource=${false} linkKey=${null} onRerender=${onRerender} />`}
            ${mediaOverlay()}
          </div>
          ${actionsOverlay()}
        </div>
      `;
    }

    return html`
      <div class="slide-outer" data-desc-idx=${descIdx}>
        <div class="slide title-slide" style="background-color:${bg};color:${fg}">
          ${data.lines.map((l) => html`
            <div style="font-size:${l.fontSize * PT_SCALE}px;${l.bold ? 'font-weight:bold;' : ''}color:${c(l.color)};padding:0 ${px(SLIDE_STYLE.pad)};${l.marginTop ? `margin-top:${l.marginTop * PX}px;` : ''}">${l.text}</div>
          `)}
          ${mediaOverlay()}
        </div>
        ${actionsOverlay()}
      </div>
    `;
  }

  return null;

  function mediaOverlay() {
    return null;
  }

  function actionsOverlay() {
    return id ? html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} imgEntry=${imgEntry}
                       slideKey=${slideKey} onRerender=${onRerender} />` : null;
  }
}
