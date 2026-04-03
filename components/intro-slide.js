import { h } from "preact";
import htm from "htm";
import { INTRO_SLIDES, DEFAULT_MONEY } from "../lib/intro-slides.js";
import { SLIDE_STYLE } from "../quiz-core.js";
import { PT_SCALE, px } from "../lib/utils.js";
import { slideStyle } from "../lib/state.js";

const html = htm.bind(h);

function replaceMoney(text) {
  return text.replace("{money}", String(DEFAULT_MONEY));
}

export function IntroSlide({ introIndex }) {
  const data = INTRO_SLIDES[introIndex];
  if (!data) return null;
  const bg = slideStyle.value.backgroundColor;

  if (data.id === "welcome") {
    return html`
      <div class="slide title-slide" style="background-color:${bg}">
        <span style="font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;color:#${data.title.color}">${data.title.text}</span>
        ${data.subtitle.map((l) => html`
          <div style="font-size:${l.fontSize * PT_SCALE}px;font-weight:bold;color:#${l.color}">${l.text}</div>
        `)}
      </div>
    `;
  }

  if (data.id === "rules") {
    return html`
      <div class="slide" style="background-color:${bg}">
        <div style="position:absolute;left:0;top:${px(SLIDE_STYLE.pad)};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:#${data.title.color}">
          ${data.title.text}
        </div>
        ${data.sections.map((sec, si) => html`
          <div style="position:absolute;left:${px(SLIDE_STYLE.pad)};top:${px(0.8 + si * 2.2)};width:${px(SLIDE_STYLE.width - 2 * SLIDE_STYLE.pad)};font-size:${data.defaultFontSize * PT_SCALE}px;text-align:center">
            ${sec.lines.map((line) => html`
              <div>${line.runs.map((r) => html`<span style="color:#${r.color || 'FFFFFF'};${r.bold ? 'font-weight:bold;' : ''}${r.underline ? 'text-decoration:underline;' : ''}${r.fontSize ? `font-size:${r.fontSize * PT_SCALE}px;` : ''}">${replaceMoney(r.text)}</span>`)}</div>
            `)}
          </div>
        `)}
      </div>
    `;
  }

  if (data.id === "format") {
    return html`
      <div class="slide" style="background-color:${bg}">
        <div style="position:absolute;left:0;top:${px(SLIDE_STYLE.pad)};width:100%;text-align:center;font-size:${data.title.fontSize * PT_SCALE}px;text-decoration:underline;color:#${data.title.color};font-family:${data.title.fontFace || 'inherit'}">
          ${data.title.text}
        </div>
        ${data.sections.map((sec, si) => html`
          <div style="position:absolute;left:${px(SLIDE_STYLE.pad + 0.2)};top:${px(0.8 + si * 2.0)};width:${px(SLIDE_STYLE.width - 2 * SLIDE_STYLE.pad - 0.4)};font-size:${data.defaultFontSize * PT_SCALE}px;color:#${data.defaultColor}">
            ${sec.lines.map((line) => html`
              <div>● ${line.runs.map((r) => html`<span style="${r.bold ? 'font-weight:bold;' : ''}">${r.text}</span>`)}</div>
            `)}
          </div>
        `)}
      </div>
    `;
  }

  if (data.id === "golden-rules") {
    return html`
      <div class="slide title-slide" style="background-color:${bg}">
        <div style="font-size:${data.title.fontSize * PT_SCALE}px;font-weight:bold;text-decoration:underline;color:#${data.title.color}">
          ${data.title.text}
        </div>
        ${data.rules.map((rule) => html`
          <div style="font-size:${data.ruleFontSize * PT_SCALE}px;color:#${data.ruleColor};margin-top:8px">${rule.de}</div>
          <div style="font-size:${data.ruleFontSize * PT_SCALE}px;color:#${data.ruleColor}">${rule.en}</div>
        `)}
      </div>
    `;
  }

  if (data.id === "begin") {
    return html`
      <div class="slide title-slide" style="background-color:${bg}">
        ${data.lines.map((l) => html`
          <div style="font-size:${l.fontSize * PT_SCALE}px;font-weight:bold;color:#${l.color}">${l.text}</div>
        `)}
      </div>
    `;
  }

  return null;
}
