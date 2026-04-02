import { h } from "preact";
import htm from "htm";
import { slideStyle, scheduleSave } from "../lib/state.js";

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
  `;
}
