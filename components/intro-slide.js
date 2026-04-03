import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { INTRO_SLIDES, DEFAULT_MONEY } from "../lib/intro-slides.js";
import { SLIDE_STYLE } from "../quiz-core.js";
import { PT_SCALE, PX, px, layoutImageBelowText } from "../lib/utils.js";
import { slideStyle, slideImages, slideAudio } from "../lib/state.js";
import { ImageActions } from "./image-actions.js";

const html = htm.bind(h);

function replaceMoney(text) {
  return text.replace("{money}", String(DEFAULT_MONEY));
}

function c(color) {
  return color ? `#${color}` : SLIDE_STYLE.textColor;
}

export function IntroSlide({ introIndex, anchor, id, onRerender, desc }) {
  const data = desc?.data || INTRO_SLIDES[introIndex];
  if (!data) return null;
  const style = data.style || data.id; // migration fallback for old saves
  const bg = slideStyle.value.backgroundColor;
  const fg = slideStyle.value.textColor || '#000';
  const slideKey = id ? `${id}:0` : null;
  const imgEntry = slideKey && slideImages.value[slideKey];
  const audioEntry = slideKey && slideAudio.value[slideKey];

  if (style === "welcome") {
    const t = data.toucan;
    return html`
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
    `;
  }

  if (style === "rules") {
    if (imgEntry) {
      const textRef = useRef(null);
      const imgElRef = useRef(null);
      useLayoutEffect(() => {
        layoutImageBelowText(textRef.current, imgElRef.current, imgEntry);
      });
      return html`
        <div class="slide" style="background-color:${bg};color:${fg}">
          <div ref=${textRef} style="position:absolute;left:0;top:${px(SLIDE_STYLE.pad)};width:100%;text-align:center">
            <div style="font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:${c(data.title.color)}">
              ${data.title.text}
            </div>
            ${data.sections.map((sec) => html`
              <div style="font-size:${data.defaultFontSize * PT_SCALE}px;margin-top:8px">
                ${sec.lines.map((line) => html`
                  <div>${line.runs.map((r) => html`<span style="color:${c(r.color)};${r.bold ? 'font-weight:bold;' : ''}${r.underline ? 'text-decoration:underline;' : ''}${r.fontSize ? `font-size:${r.fontSize * PT_SCALE}px;` : ''}">${replaceMoney(r.text)}</span>`)}</div>
                `)}
              </div>
            `)}
          </div>
          <img ref=${imgElRef} src=${imgEntry.data} style="position:absolute;object-fit:contain" />
          ${mediaOverlay()}
        </div>
      `;
    }

    return html`
      <div class="slide" style="background-color:${bg};color:${fg}">
        <div style="position:absolute;left:0;top:${px(data.titleY)};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:${c(data.title.color)}">
          ${data.title.text}
        </div>
        ${data.sections.map((sec, si) => html`
          <div style="position:absolute;left:${px(SLIDE_STYLE.pad)};top:${px(data.sectionStartY + si * data.sectionGap)};width:${px(SLIDE_STYLE.width - 2 * SLIDE_STYLE.pad)};font-size:${data.defaultFontSize * PT_SCALE}px;text-align:center">
            ${sec.lines.map((line) => html`
              <div>${line.runs.map((r) => html`<span style="color:${c(r.color)};${r.bold ? 'font-weight:bold;' : ''}${r.underline ? 'text-decoration:underline;' : ''}${r.fontSize ? `font-size:${r.fontSize * PT_SCALE}px;` : ''}">${replaceMoney(r.text)}</span>`)}</div>
            `)}
          </div>
        `)}
        ${mediaOverlay()}
      </div>
    `;
  }

  if (style === "format") {
    const cp = data.contentPad || 0;
    return html`
      <div class="slide" style="background-color:${bg};color:${fg}">
        <div style="position:absolute;left:0;top:${px(data.titleY)};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;${data.title.bold ? 'font-weight:bold;' : ''}text-decoration:underline;color:${c(data.title.color)};font-family:${data.title.fontFace || 'inherit'}">
          ${data.title.text}
        </div>
        ${data.sections.map((sec, si) => html`
          <div style="position:absolute;left:${px(SLIDE_STYLE.pad + cp)};top:${px(data.sectionStartY + si * data.sectionGap)};width:${px(SLIDE_STYLE.width - 2 * SLIDE_STYLE.pad - 2 * cp)};font-size:${data.defaultFontSize * PT_SCALE}px;color:${c(data.defaultColor)}">
            ${sec.lines.map((line) => html`
              <div>● ${line.runs.map((r) => html`<span style="${r.bold ? 'font-weight:bold;' : ''}">${r.text}</span>`)}</div>
            `)}
          </div>
        `)}
        ${mediaOverlay()}
      </div>
    `;
  }

  if (style === "golden-rules") {
    const { pad: p } = SLIDE_STYLE;

    if (imgEntry) {
      const textRef = useRef(null);
      const imgElRef = useRef(null);

      useLayoutEffect(() => {
        layoutImageBelowText(textRef.current, imgElRef.current, imgEntry);
      });

      return html`
        <div class="slide" style="background-color:${bg};color:${fg}">
          <div ref=${textRef} style="position:absolute;left:0;top:${px(p)};width:100%;text-align:center">
            <div style="font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:${c(data.title.color)}">
              ${data.title.text}
            </div>
            ${data.rules.map((rule) => html`
              <div style="font-size:${data.ruleFontSize * PT_SCALE}px;color:${c(data.ruleColor)};margin-top:4px">${rule}</div>
            `)}
          </div>
          <img ref=${imgElRef} src=${imgEntry.data} style="position:absolute;object-fit:contain" />
          ${mediaOverlay()}
        </div>
      `;
    }

    return html`
      <div class="slide" style="background-color:${bg};color:${fg}">
        <div style="position:absolute;left:0;top:${px(data.titleY)};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:${c(data.title.color)}">
          ${data.title.text}
        </div>
        ${data.rules.map((rule, ri) => html`
          <div style="position:absolute;left:0;top:${px(data.rulesStartY + ri * data.ruleHeight)};width:100%;text-align:center;font-size:${data.ruleFontSize * PT_SCALE}px;color:${c(data.ruleColor)}">${rule}</div>
        `)}
        ${mediaOverlay()}
      </div>
    `;
  }

  if (style === "begin") {
    const textRef = useRef(null);
    const imgElRef = useRef(null);

    useLayoutEffect(() => {
      layoutImageBelowText(textRef.current, imgElRef.current, imgEntry);
    });

    if (imgEntry) {
      const { pad: p } = SLIDE_STYLE;
      return html`
        <div class="slide" style="background-color:${bg};color:${fg}">
          <div ref=${textRef} style="position:absolute;left:${px(p)};top:${px(p)};width:${px(SLIDE_STYLE.width - 2 * p)};text-align:center">
            ${data.lines.map((l) => html`
              <div style="font-size:${l.fontSize * PT_SCALE}px;${l.bold ? 'font-weight:bold;' : ''}color:${c(l.color)}">${l.text}</div>
            `)}
          </div>
          <img ref=${imgElRef} src=${imgEntry.data} style="position:absolute;object-fit:contain" />
          ${mediaOverlay()}
        </div>
      `;
    }

    return html`
      <div class="slide title-slide" style="background-color:${bg};color:${fg}">
        ${data.lines.map((l) => html`
          <div style="font-size:${l.fontSize * PT_SCALE}px;${l.bold ? 'font-weight:bold;' : ''}color:${c(l.color)};padding:0 ${px(SLIDE_STYLE.pad)}">${l.text}</div>
        `)}
        ${mediaOverlay()}
      </div>
    `;
  }

  return null;

  function mediaOverlay() {
    return html`
      ${audioEntry && html`
        <div class="slide-audio" style="background:${bg}e0">
          <audio controls preload="none" src=${audioEntry.data} />
          <span class="slide-audio__name">${audioEntry.name}</span>
        </div>
      `}
      ${id && html`<${ImageActions} id=${id} withAnswers=${false} isQuestion=${false} imgEntry=${imgEntry}
                     slideKey=${slideKey} onRerender=${onRerender} />`}
    `;
  }
}
