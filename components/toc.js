import { h } from "preact";
import htm from "htm";
import { currentQuiz } from "../lib/state.js";
import { slugify } from "../lib/utils.js";

const html = htm.bind(h);

function buildTocEntries(quiz) {
  if (!quiz) return [];
  const entries = [{ label: "Intro", anchor: "intro" }];

  // Section 1: rounds 0-1
  for (const r of quiz.rounds.slice(0, 2)) {
    entries.push({ label: r.name, anchor: slugify(r.name) });
  }
  for (const r of quiz.rounds.slice(0, 2)) {
    entries.push({ label: `${r.name} Answers`, anchor: slugify(r.name) + "-answers" });
  }

  // Section 2: rounds 2-4
  for (const r of quiz.rounds.slice(2, 5)) {
    entries.push({ label: r.name, anchor: slugify(r.name) });
  }
  for (const r of quiz.rounds.slice(2, 5)) {
    entries.push({ label: `${r.name} Answers`, anchor: slugify(r.name) + "-answers" });
  }

  // Jackpot section: round 5
  const jr = quiz.rounds[5];
  if (jr) {
    entries.push({ label: jr.name, anchor: slugify(jr.name) });
    entries.push({ label: `${jr.name} Answers`, anchor: slugify(jr.name) + "-answers" });
  }

  return entries;
}

export function TOC() {
  const quiz = currentQuiz.value;
  const entries = buildTocEntries(quiz);
  if (!entries.length) return null;

  function handleClick(e, anchor) {
    e.preventDefault();
    const target = document.getElementById(anchor);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.replaceState(null, "", `#${anchor}`);
    }
  }

  return entries.map((entry, i) => html`
    ${i > 0 && html`<span class="toc-sep" key=${"sep-" + i}>|</span>`}
    <a key=${entry.anchor} href="#${entry.anchor}" onClick=${(e) => handleClick(e, entry.anchor)}>${entry.label}</a>
  `);
}
