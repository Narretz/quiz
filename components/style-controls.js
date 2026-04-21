import { h } from "preact";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { slideStyle, scheduleSave, showValidation } from "../lib/state.js";

// Snapshot defaults before they get mutated by the slideStyle sync effect
const DEFAULTS = {
  fontSize: SLIDE_STYLE.question.fontSize,
  lineSpacing: SLIDE_STYLE.question.lineSpacing,
  backgroundColor: SLIDE_STYLE.backgroundColor,
  textColor: SLIDE_STYLE.textColor,
};

const html = htm.bind(h);

export function StyleControls({ onStyleChange }) {
  const style = slideStyle.value;

  function update(field, value) {
    slideStyle.value = { ...style, [field]: value };
    if (onStyleChange) onStyleChange();
    scheduleSave();
  }

  return html`
    <label>Font size <input type="number" min="8" max="48" step="1"
      value=${style.fontSize}
      onInput=${(e) => update("fontSize", Number(e.target.value))} /></label>
    <label>Line spacing % <input type="number" min="80" max="200" step="5"
      value=${style.lineSpacing}
      onInput=${(e) => update("lineSpacing", Number(e.target.value))} /></label>
    <label>Background <input type="color"
      value=${style.backgroundColor}
      onInput=${(e) => update("backgroundColor", e.target.value)} /></label>
    <label>Text color <input type="color"
      value=${style.textColor}
      onInput=${(e) => update("textColor", e.target.value)} /></label>
    <label><input type="checkbox"
      checked=${showValidation.value}
      onChange=${(e) => { showValidation.value = e.target.checked; scheduleSave(); }} /> Validate</label>
    <button onClick=${() => {
      slideStyle.value = { ...DEFAULTS };
      if (onStyleChange) onStyleChange();
      scheduleSave();
    }}>Reset</button>
  `;
}
