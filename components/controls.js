import { h } from "preact";
import htm from "htm";
import {
  currentQuiz, currentQuizId, status,
  downloadPptx, deleteSavedQuiz,
} from "../lib/state.js";

const html = htm.bind(h);

export function Controls() {
  const quiz = currentQuiz.value;
  const quizId = currentQuizId.value;
  const statusText = status.value;

  async function onDownload() {
    try {
      await downloadPptx();
    } catch (err) {
      status.value = "Error: " + err.message;
      console.error(err);
    }
  }

  function onDelete() {
    if (quizId) deleteSavedQuiz(quizId);
  }

  return html`
    <div class="controls">
      ${quizId && html`
        <button disabled=${!quiz} onClick=${onDownload}>Download .pptx</button>
      `}
      <span class="status">${statusText}</span>
      ${quizId && html`
        <button style="margin-left:auto;background:#dc2626" onClick=${onDelete}>Delete quiz</button>
      `}
    </div>
  `;
}
