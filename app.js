import { h, render } from "preact";
import { effect } from "@preact/signals";
import htm from "htm";
import {
  currentQuiz, currentQuizId, slideDescriptors, slideImages, quizQuestions, manualOverrides,
  slideStyle, savedList, status, debug, jackpotSize, quizEmail, refreshSavedList, uploadQuiz, loadSavedQuiz,
} from "./lib/state.js";
import { SavedQuizBar } from "./components/saved-quiz-bar.js";
import { Controls } from "./components/controls.js";
import { TOC } from "./components/toc.js";
import { StyleControls } from "./components/style-controls.js";
import { SlidePreview } from "./components/slide-preview.js";

const html = htm.bind(h);

function App() {
  // Touch all signals so App re-renders when any change
  currentQuiz.value; currentQuizId.value; slideDescriptors.value; slideImages.value;
  quizQuestions.value; manualOverrides.value; slideStyle.value; savedList.value; status.value;
  jackpotSize.value; quizEmail.value;

  async function onUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = "";
    try {
      await uploadQuiz(file);
    } catch (err) {
      status.value = "Error: " + err.message;
      console.error(err);
    }
  }

  return html`
    <h1>Quiz XLSX to PPTX</h1>
    <details class="howto">
      <summary><h2>How does it work?</h2></summary>
      <p>Upload an .xlsx file in the usual format. A quiz is created with the default structure and slides.</p>
      <ul>
        <li>For empty rounds, 10 slides are created automatically</li>
        <li>You can add 1 image and/or 1 audio file to all slides, except the first 3. Text will automatically be repositioned. Adding an image to a question will automatically add it to the answer, but you can also add distinct images to questions/answers</li>
        <li>Questions, answers, and round descriptions can be edited per language by clicking into the text. Answers can only be edited in the answer slide.</li>
        <li>Your changes will be saved locally in this browser and you can load quizzes later and continue editing.</li>
        <li>Downloading the quiz as .pptx will include all media and text changes and create very similar output, but you should check for text overflow specifically.</li>
      </ul>
    </details>
    <div class="controls">
      <label class="upload-btn">
        Upload .xlsx
        <input type="file" accept=".xlsx" onChange=${onUpload} />
      </label>
      Stored quizzes:<${SavedQuizBar} onLoad=${loadSavedQuiz} />
    </div>
    <${Controls} />
    <nav class="toc"><${TOC} /></nav>
    ${debug && html`<div class="style-controls"><${StyleControls} /></div>`}
    <${SlidePreview} />
  `;
}

// Initial load
refreshSavedList();
const quizParam = new URLSearchParams(location.search).get("quiz");
if (quizParam) loadSavedQuiz(quizParam).then(() => {
  if (location.hash) requestAnimationFrame(() => document.querySelector(location.hash)?.scrollIntoView());
});

// Mount
render(html`<${App} />`, document.getElementById("app"));

// Re-render on signal changes
effect(() => {
  currentQuiz.value; currentQuizId.value; slideDescriptors.value; slideImages.value;
  quizQuestions.value; manualOverrides.value; slideStyle.value; savedList.value; status.value;
  jackpotSize.value; quizEmail.value;
  render(html`<${App} />`, document.getElementById("app"));
});
