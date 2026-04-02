import { h, render } from "preact";
import { useEffect } from "preact/hooks";
import { effect } from "@preact/signals";
import htm from "htm";
import {
  currentQuiz, currentQuizId, slideImages, manualOverrides,
  slideStyle, savedList, status, refreshSavedList, uploadQuiz, loadSavedQuiz,
} from "./lib/state.js";
import { SavedQuizBar } from "./components/saved-quiz-bar.js";
import { Controls } from "./components/controls.js";
import { TOC } from "./components/toc.js";
import { StyleControls } from "./components/style-controls.js";
import { SlidePreview } from "./components/slide-preview.js";

const html = htm.bind(h);

function App() {
  // Touch all signals so App re-renders when any change
  currentQuiz.value; currentQuizId.value; slideImages.value;
  manualOverrides.value; slideStyle.value; savedList.value; status.value;

  async function onUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await uploadQuiz(file);
    } catch (err) {
      status.value = "Error: " + err.message;
      console.error(err);
    }
  }

  return html`
    <h1>Quiz XLSX to PPTX</h1>
    <p class="howto">How does it work? Upload an .xlsx file. A quiz presentation will be created. You can add images to slides. Adding an image to a question will automatically add it to the answer, but you can also add individual images to questions/answers only. Your changes will be saved locally in this browser and can be restored when you come back. You can also download the presentation with all images included.</p>
    <div class="controls">
      <label class="upload-btn">
        Upload .xlsx
        <input type="file" accept=".xlsx" onChange=${onUpload} />
      </label>
      Stored quizzes:<${SavedQuizBar} onLoad=${loadSavedQuiz} />
    </div>
    <${Controls} />
    <nav class="toc"><${TOC} /></nav>
    <div class="style-controls"><${StyleControls} /></div>
    <${SlidePreview} />
  `;
}

// Initial load
refreshSavedList();

// Mount
render(html`<${App} />`, document.getElementById("app"));

// Re-render on signal changes
effect(() => {
  currentQuiz.value; currentQuizId.value; slideImages.value;
  manualOverrides.value; slideStyle.value; savedList.value; status.value;
  render(html`<${App} />`, document.getElementById("app"));
});
