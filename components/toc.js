import { h } from "preact";
import htm from "htm";
import { currentQuiz } from "../lib/state.js";
import { slugify } from "../lib/utils.js";

const html = htm.bind(h);

function buildTocEntries(quiz) {
  if (!quiz) return [];
  const entries = [{ label: "Intro", anchor: "intro" }];
  const roundSlices = [
    quiz.rounds.slice(0, 2),
    quiz.rounds.slice(2, 5),
    quiz.rounds.slice(5),
  ];
  for (let s = 0; s < roundSlices.length; s++) {
    const rounds = roundSlices[s];
    for (const r of rounds) {
      entries.push({ label: r.name, anchor: slugify(r.name) });
    }
    for (const r of rounds) {
      entries.push({ label: `${r.name} Answers`, anchor: slugify(r.name) + "-answers" });
    }
    if (s < roundSlices.length - 1) {
      entries.push({ label: `Break ${s + 1}`, anchor: `break-${s + 1}` });
    }
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
