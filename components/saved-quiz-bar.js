import { h } from "preact";
import htm from "htm";
import { savedList, currentQuizId } from "../lib/state.js";

const html = htm.bind(h);

export function SavedQuizBar({ onLoad }) {
  const list = savedList.value;
  const activeId = currentQuizId.value;

  if (!list.length) return null;

  const sorted = [...list].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));

  function onChange(e) {
    const id = e.target.value;
    if (id) onLoad(id);
  }

  return html`
    <select class="saved-quizzes-select" value=${activeId || ""} onChange=${onChange}>
      <option value="" disabled>Select a stored quiz…</option>
      ${sorted.map((entry) => html`
        <option key=${entry.id} value=${entry.id}>${entry.quiz?.name || entry.id}</option>
      `)}
    </select>
  `;
}
