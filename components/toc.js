import { h } from "preact";
import { useEffect } from "preact/hooks";
import htm from "htm";
import { currentQuiz, slideDescriptors } from "../lib/state.js";
import { getRoundName } from "../quiz-core.js";
import { slugify, scrollToElement } from "../lib/utils.js";

const html = htm.bind(h);

function buildTocEntries(quiz, descriptors) {
  if (!quiz) return [];
  const entries = [{ label: "Intro", anchor: "intro" }];

  function pushRound(ri) {
    const name = getRoundName(descriptors, quiz, ri);
    entries.push({ label: name, anchor: slugify(name) });
  }
  function pushRoundAnswers(ri) {
    const name = getRoundName(descriptors, quiz, ri);
    entries.push({ label: `${name} Answers`, anchor: slugify(name) + "-answers" });
  }

  // Section 1: rounds 0-1
  for (let ri = 0; ri < Math.min(2, quiz.rounds.length); ri++) pushRound(ri);
  for (let ri = 0; ri < Math.min(2, quiz.rounds.length); ri++) pushRoundAnswers(ri);

  // Section 2: rounds 2-4
  for (let ri = 2; ri < Math.min(5, quiz.rounds.length); ri++) pushRound(ri);
  for (let ri = 2; ri < Math.min(5, quiz.rounds.length); ri++) pushRoundAnswers(ri);

  // Jackpot section: round 5
  if (quiz.rounds[5]) {
    pushRound(5);
    pushRoundAnswers(5);
  }

  return entries;
}

export function TOC() {
  const quiz = currentQuiz.value;
  const descriptors = slideDescriptors.value;
  const entries = buildTocEntries(quiz, descriptors);

  useEffect(() => {
    if (!entries.length) return;
    const anchors = entries.map(e => e.anchor);
    let raf = 0;
    function update() {
      raf = 0;
      const anchorSet = new Set(anchors);
      const slides = document.querySelectorAll(".slide");
      const vh = window.innerHeight;
      const visible = new Map();
      const rowsSeen = new Set();
      let section = anchors[0];
      for (const slide of slides) {
        if (slide.id && anchorSet.has(slide.id)) section = slide.id;
        const rect = slide.getBoundingClientRect();
        const rowKey = Math.round(rect.top);
        if (rowsSeen.has(rowKey)) continue;
        rowsSeen.add(rowKey);
        const v = Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
        if (v > 0) visible.set(section, (visible.get(section) || 0) + v);
      }
      let current = anchors[0];
      let max = 0;
      for (const [id, v] of visible) {
        if (v > max) { max = v; current = id; }
      }
      if (window.scrollY === 0) {
        if (location.hash) history.replaceState(null, "", location.pathname + location.search);
      } else if (`#${current}` !== location.hash) {
        history.replaceState(null, "", `#${current}`);
      }
    }
    function onScroll() {
      if (!raf) raf = requestAnimationFrame(update);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [entries.map(e => e.anchor).join("|")]);

  if (!entries.length) return null;

  function handleClick(e, anchor) {
    e.preventDefault();
    const target = document.getElementById(anchor);
    if (target) {
      scrollToElement(target);
      history.replaceState(null, "", `#${anchor}`);
    }
  }

  return entries.map((entry, i) => html`
    ${i > 0 && html`<span class="toc-sep" key=${"sep-" + i}>|</span>`}
    <a key=${entry.anchor} href="#${entry.anchor}" onClick=${(e) => handleClick(e, entry.anchor)}>${entry.label}</a>
  `);
}
