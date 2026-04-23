import { h, render } from "preact";
import { effect } from "@preact/signals";
import htm from "htm";
import {
  currentQuiz, currentQuizId, slideDescriptors, slideImages, quizQuestions, manualOverrides,
  slideStyle, savedList, status, debug, jackpotSize, quizEmail, showValidation,
  refreshSavedList, uploadQuiz, loadSavedQuiz, unloadQuiz, createBlankQuiz,
} from "./lib/state.js";
import { SavedQuizBar } from "./components/saved-quiz-bar.js";
import { Controls } from "./components/controls.js";
import { ValidationBar } from "./components/validation-bar.js";
import { TOC } from "./components/toc.js";
import { StyleControls } from "./components/style-controls.js";
import { SlidePreview } from "./components/slide-preview.js";

const html = htm.bind(h);

function App() {
  // Touch all signals so App re-renders when any change
  currentQuiz.value; currentQuizId.value; slideDescriptors.value; slideImages.value;
  quizQuestions.value; manualOverrides.value; slideStyle.value; savedList.value; status.value;
  jackpotSize.value; quizEmail.value; showValidation.value;

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

  const quizLoaded = !!currentQuiz.value;
  const quizLabel = quizLoaded ? (currentQuiz.value.name || currentQuizId.value) : "";
  const statusText = status.value;
  const isError = statusText.startsWith("Error:");

  return html`
    <h1>
      ${quizLoaded && html`<button class="home-btn" title="Back to main menu" onClick=${unloadQuiz}>⌂</button>`}
      Quiz Creator
      ${quizLoaded && quizLabel && html`<span class="h1-quiz-name">— ${quizLabel}</span>`}
    </h1>
    ${!quizLoaded && html`
      <div class="controls main-controls">
        <label>
        <span>Start with an xlsx file</span>
          <span class="upload-btn">
            Upload .xlsx
            <input type="file" accept=".xlsx" onChange=${onUpload} />
          </span>
        </label>
        <label>
          <span>Create a blank quiz with Tipperary structure</span>
          <button class="new-quiz-btn" onClick=${createBlankQuiz}>Create quiz</button>
        </label>
        <label>
          <span>Load a saved quiz</span><${SavedQuizBar} onLoad=${loadSavedQuiz} />
        </label>
      </div>
      ${statusText && html`<div class=${`main-status ${isError ? 'main-status--error' : ''}`}>${statusText}</div>`}
      <div class="howto">
        <h2>How does it work?</h2>
        <ul>
          <li>You can upload an .xlsx file in a specific format. A quiz is created with the questions, and the default service slides.</li>
          <li>Or you can create a blank quiz with 4x10 rounds, Name 10, and a Jackpot Round, and all the service slides</li>
          <li>Quizzes are saved locally in this browser, so you can load quizzes later and continue editing.</li>
        </ul>
        <br/>
        <ul>
          <li>For empty rounds 1-4, 10 slides are created automatically</li>
          <li>You can set the jackpot size and the email shown in the very last slide. Saved in the browser.</li>
          <li>You can up to 2 media elements: 2 images or 1 audio/video + an image to all slides, except the first 3. Text will automatically be repositioned. Adding an image to a question will automatically add it to the answer, but you can also add distinct images to questions/answers</li>
          <li>If you add a video to the question, the first frame of it will be added as an image to the answer</li>
          <li>Questions, answers, and round descriptions can be edited per language by clicking into the text.</li>
          <li>For untranslated questions, there's a link that goes to Google Translate so you can easily copy & paste the translation.</li>
          <li>Before Downloading, check out the validation that will flag missing content and other common issues.</li>
          <li>Downloading the quiz as .pptx will include all media and text changes and create very similar output, but you should check for text overflow specifically.</li>
        </ul>
      </div>
    `}
    ${quizLoaded && html`
      <${Controls} />
      <${ValidationBar} />
      <nav class="toc"><${TOC} /></nav>
      ${debug && html`<div class="style-controls"><${StyleControls} /></div>`}
      <${SlidePreview} />
    `}
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
  jackpotSize.value; quizEmail.value; showValidation.value;
  render(html`<${App} />`, document.getElementById("app"));
});
