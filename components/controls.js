import { h } from "preact";
import htm from "htm";
import {
  currentQuiz, currentQuizId, status, jackpotSize, quizEmail, showValidation,
  downloadPptx, deleteSavedQuiz, scheduleSave, debug
} from "../lib/state.js";

const html = htm.bind(h);

export function Controls() {
  const quiz = currentQuiz.value;
  const quizId = currentQuizId.value;
  const statusText = status.value;

  function onValidate() {
    showValidation.value = true;
    scheduleSave();
  }

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

  function onJackpotChange(e) {
    jackpotSize.value = Number(e.target.value) || 0;
    scheduleSave();
  }

  function onEmailChange(e) {
    quizEmail.value = e.target.value;
    scheduleSave();
  }

  return html`
    <div class="controls ${debug ? 'controls--sticky' : ''}">
      ${quizId && html`
        <button disabled=${!quiz || showValidation.value} onClick=${onValidate}>Validate</button>
        <span class="controls__arrow">→</span>
        <button disabled=${!quiz || (!showValidation.value && !debug) || status.value === 'Generating PPTX...'} onClick=${onDownload}>Download .pptx</button>
      `}
      <span class="status">${statusText}</span>
      ${quizId && html`
        <div class="quiz-settings">
          <label>Jackpot €<input type="number" class="setting-input" min="0" value=${jackpotSize.value} onChange=${onJackpotChange} /></label>
          <label>Email<input type="email" class="setting-input setting-input--email" value=${quizEmail.value} onChange=${onEmailChange} /></label>
        </div>
      `}
      ${quizId && html`
        <button style="margin-left:auto;background:#dc2626" onClick=${onDelete}>Delete quiz</button>
      `}
    </div>
  `;
}
