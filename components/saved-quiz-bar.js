import { h } from "preact";
import htm from "htm";
import { savedList, currentQuizId } from "../lib/state.js";

const html = htm.bind(h);

export function SavedQuizBar({ onLoad }) {
  const list = savedList.value;
  const activeId = currentQuizId.value;

  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  return sorted.map((entry) => html`
    <span class="sq-item ${entry.id === activeId ? "active" : ""}" key=${entry.id}>
      <span class="sq-label" onClick=${() => onLoad(entry.id)}>${entry.id}</span>
    </span>
  `);
}
