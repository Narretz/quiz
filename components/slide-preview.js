import { h } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import htm from "htm";
import { buildSlideDescriptors, SLIDE_STYLE } from "../quiz-core.js";
import { slugify } from "../lib/utils.js";
import { currentQuiz, slideImages, slideAudio, slideOverrides } from "../lib/state.js";
import { TitleSlide } from "./title-slide.js";
import { QuestionSlide } from "./question-slide.js";

const html = htm.bind(h);

function buildSections(quiz) {
  const descriptors = buildSlideDescriptors(quiz);
  const sections = [{ label: "", indices: [0] }];
  const roundSlices = [
    quiz.rounds.slice(0, 2),
    quiz.rounds.slice(2, 5),
    quiz.rounds.slice(5),
  ];

  const tocEntries = [{ label: "Intro", anchor: "intro" }];
  let idx = 1;
  for (let s = 0; s < roundSlices.length; s++) {
    const sec = { label: `Section ${s + 1}`, indices: [] };
    const rounds = roundSlices[s];
    for (const r of rounds) {
      tocEntries.push({ label: r.name, anchor: slugify(r.name) });
      sec.indices.push(idx++);
      const count = r.questions.length === 0 ? 10 : r.questions.length;
      for (let i = 0; i < count; i++) sec.indices.push(idx++);
    }
    sec.indices.push(idx++); // Antworten
    for (const r of rounds) {
      tocEntries.push({ label: `${r.name} Answers`, anchor: slugify(r.name) + "-answers" });
      sec.indices.push(idx++);
      const count = r.questions.length === 0 ? 10 : r.questions.length;
      for (let i = 0; i < count; i++) sec.indices.push(idx++);
    }
    if (s < roundSlices.length - 1) {
      tocEntries.push({ label: `Break ${s + 1}`, anchor: `break-${s + 1}` });
      sec.indices.push(idx++);
    }
    sections.push(sec);
  }
  return { descriptors, sections, tocEntries };
}

// Collect fitting results from QuestionSlide refs after layout
let collectedOverrides = {};

export function getCollectedOverrides() {
  return collectedOverrides;
}

export function SlidePreview() {
  const quiz = currentQuiz.value;
  if (!quiz) return null;

  // Touch signals so component re-renders when they change
  slideImages.value;
  slideAudio.value;

  const { descriptors, sections, tocEntries } = buildSections(quiz);
  const roundNames = new Set(quiz.rounds.map(r => r.name));
  let tocIdx = 0;

  // Force re-render function for image changes
  const previewRef = useRef(null);
  function onRerender() {
    // Trigger a re-render by updating currentQuiz signal (same value, new reference triggers Preact)
    currentQuiz.value = { ...quiz };
  }

  // After layout, collect fitting results from DOM for PPTX export
  useLayoutEffect(() => {
    if (!previewRef.current) return;
    const computed = {};
    previewRef.current.querySelectorAll(".slide[data-slide-id]").forEach((el) => {
      const key = `${el.dataset.slideId}:${el.dataset.answers}`;
      // The fitting result is stored by QuestionSlide's useLayoutEffect
      // We read it from the DOM measurement — but actually QuestionSlide stores in its own signal
    });
    // QuestionSlide updates slideOverrides directly is not ideal;
    // instead we'll collect in a post-render pass
  });

  const elements = [];

  for (const sec of sections) {
    if (sec.label) {
      elements.push(html`<div class="section-label" key=${"label-" + sec.label}>${sec.label}</div>`);
    }

    for (const i of sec.indices) {
      const desc = descriptors[i];
      if (!desc) continue;

      if (desc.type === "title" && roundNames.has(desc.text)) {
        elements.push(html`<div key=${"br-" + i} style="flex-basis:100%;height:0" />`);
      }

      if (desc.type === "title") {
        let anchor = null;
        if (tocIdx < tocEntries.length && !desc.text.startsWith("Antworten")) {
          anchor = tocEntries[tocIdx].anchor;
          tocIdx++;
        }
        elements.push(html`<${TitleSlide} key=${"t-" + i} desc=${desc} anchor=${anchor} />`);
      } else {
        elements.push(html`<${QuestionSlide} key=${"q-" + i} desc=${desc} onRerender=${onRerender} />`);
      }
    }
  }

  return html`<div class="preview" ref=${previewRef}>${elements}</div>`;
}
