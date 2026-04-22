import { h } from "preact";
import { useRef } from "preact/hooks";
import htm from "htm";
import { slugify } from "../lib/utils.js";
import { getRoundName } from "../quiz-core.js";
import { currentQuiz, slideDescriptors, slideImages } from "../lib/state.js";
import { TitleSlide } from "./title-slide.js";
import { IntroSlide } from "./intro-slide.js";
import { DescriptionSlide } from "./description-slide.js";
import { QuestionSlide } from "./question-slide.js";

const html = htm.bind(h);

function buildSections(quiz, descriptors) {
  const sections = [{ label: "", indices: [0, 1, 2, 3, 4] }]; // 5 intro slides
  const tocEntries = [{ label: "Intro", anchor: "intro" }];
  let idx = 5; // skip 5 intro slides

  // Helper: add a standard section (questions + antworten + answers + optional extras)
  function addStandardSection(label, rounds, startRi, extraCount) {
    const sec = { label, indices: [] };
    // Questions phase
    for (let k = 0; k < rounds.length; k++) {
      const r = rounds[k];
      const name = getRoundName(descriptors, quiz, startRi + k);
      tocEntries.push({ label: name, anchor: slugify(name) });
      const n = 1 + (r.description?.de ? 1 : 0) + (r.questions.length === 0 ? 10 : r.questions.length);
      for (let j = 0; j < n; j++) sec.indices.push(idx++);
    }
    sec.indices.push(idx++); // Antworten divider
    // Answers phase
    for (let k = 0; k < rounds.length; k++) {
      const r = rounds[k];
      const name = getRoundName(descriptors, quiz, startRi + k);
      tocEntries.push({ label: `${name} Answers`, anchor: slugify(name) + "-answers" });
      const n = 1 + (r.questions.length === 0 ? 10 : r.questions.length);
      for (let j = 0; j < n; j++) sec.indices.push(idx++);
    }
    // Extra slides at end of section (break, jackpot-break, prizes, etc.)
    for (let j = 0; j < (extraCount || 0); j++) sec.indices.push(idx++);
    sections.push(sec);
  }

  // --- Section 1: Rounds 0-1 + break 1 ---
  addStandardSection("Section 1", quiz.rounds.slice(0, 2), 0, 2); // +2 for break + points

  // --- Section 2: Rounds 2-4 + jackpot break + prizes ---
  addStandardSection("Section 2", quiz.rounds.slice(2, 5), 2, 2); // +2 for jackpot-break + prizes

  // --- Jackpot section ---
  const jr = quiz.rounds[5];
  if (jr) {
    const sec = { label: "Jackpot", indices: [] };
    const jName = getRoundName(descriptors, quiz, 5);
    tocEntries.push({ label: jName, anchor: slugify(jName) });
    sec.indices.push(idx++); // Jackpot title
    sec.indices.push(idx++); // NO PHONES!
    const qCount = jr.questions.length || 4;
    for (let i = 0; i < qCount; i++) sec.indices.push(idx++); // questions
    tocEntries.push({ label: `${jName} Answers`, anchor: slugify(jName) + "-answers" });
    sec.indices.push(idx++); // answer title
    for (let i = 0; i < qCount; i++) sec.indices.push(idx++); // answers
    sec.indices.push(idx++); // Goodbye
    sections.push(sec);
  }

  return { descriptors, sections, tocEntries };
}

export function SlidePreview() {
  const quiz = currentQuiz.value;
  const descs = slideDescriptors.value;
  if (!quiz || !descs.length) return null;

  // Touch signals so component re-renders when they change
  slideImages.value;

  const { descriptors, sections, tocEntries } = buildSections(quiz, descs);
  // Match round title slides (both phases) to insert a row break before them.
  const isRoundTitleId = (id) => /^title-r\d+(-ans)?$/.test(id || "");
  let tocIdx = 0;

  // Force re-render function for image changes
  const previewRef = useRef(null);
  function onRerender() {
    // Trigger a re-render by updating currentQuiz signal (same value, new reference triggers Preact).
    // Read the signal live, not the captured `quiz` var, to avoid stomping on updates made
    // between render and this call (e.g. round title edits that mutate quiz.rounds).
    currentQuiz.value = { ...currentQuiz.value };
  }

  const elements = [];

  for (const sec of sections) {
    if (sec.label) {
      elements.push(html`<div class="section-label" key=${"label-" + sec.label}>${sec.label}</div>`);
    }

    for (const i of sec.indices) {
      const desc = descriptors[i];
      if (!desc) continue;

      if (desc.type === "title" && isRoundTitleId(desc.id)) {
        elements.push(html`<div key=${"br-" + i} style="flex-basis:100%;height:0" />`);
      }

      if (desc.type === "title") {
        let anchor = null;
        if (tocIdx < tocEntries.length && !desc.text.de.startsWith("Antworten")) {
          anchor = tocEntries[tocIdx].anchor;
          tocIdx++;
        }
        elements.push(html`<${TitleSlide} key=${"t-" + i} desc=${desc} descIdx=${i} anchor=${anchor} onRerender=${onRerender} />`);
        // Align answer-phase slides with question-phase column: insert a placeholder
        // where the description slide sits in the question phase.
        const ansMatch = desc.id && desc.id.match(/^title-r(\d+)-ans$/);
        if (ansMatch) {
          const ri = Number(ansMatch[1]);
          if (quiz.rounds[ri]?.description?.de) {
            elements.push(html`<div class="slide placeholder" key=${"ph-" + i} />`);
          }
        }
      } else if (desc.type === "intro") {
        let anchor = null;
        if (desc.introIndex === 0 && tocIdx < tocEntries.length) {
          anchor = tocEntries[tocIdx].anchor;
          tocIdx++;
        }
        // Intro slides 0-2 have no media support (id=null); intro 3+ and extra slides do
        const introId = desc.introIndex != null ? (desc.introIndex >= 3 ? desc.id : null) : desc.id;
        elements.push(html`<${IntroSlide} key=${"i-" + i} introIndex=${desc.introIndex} desc=${desc} descIdx=${i} anchor=${anchor} id=${introId} onRerender=${onRerender} />`);
      } else if (desc.type === "description") {
        elements.push(html`<${DescriptionSlide} key=${"d-" + i} desc=${desc} descIdx=${i} onRerender=${onRerender} />`);
      } else {
        elements.push(html`<${QuestionSlide} key=${"q-" + i} desc=${desc} descIdx=${i} onRerender=${onRerender} />`);
      }
    }
  }

  return html`<div class="preview" ref=${previewRef}>${elements}</div>`;
}
