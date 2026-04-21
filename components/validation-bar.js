import { h } from "preact";
import { useState, useEffect } from "preact/hooks";
import htm from "htm";
import { validateQuiz } from "../lib/validation.js";
import { scrollToElement } from "../lib/utils.js";
import {
  currentQuiz, slideDescriptors, quizQuestions, slideImages,
  jackpotSize, quizEmail, showValidation, scheduleSave,
} from "../lib/state.js";

const html = htm.bind(h);

function flashAfterScroll(el, cls) {
  let done = false;
  const play = () => {
    if (done) return;
    done = true;
    el.classList.remove(cls);
    // Force reflow so re-adding the class restarts the animation.
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 1200);
  };
  if ("onscrollend" in window) {
    const onEnd = () => { window.removeEventListener("scrollend", onEnd); play(); };
    window.addEventListener("scrollend", onEnd);
    setTimeout(() => { window.removeEventListener("scrollend", onEnd); play(); }, 800);
  } else {
    setTimeout(play, 500);
  }
}

function scrollToIssue(issue) {
  if (issue.target) {
    const el = document.querySelector(issue.target);
    if (!el) return;
    scrollToElement(el, { center: true });
    flashAfterScroll(el, "vb-flash");
    return;
  }
  const el = document.querySelector(`.slide-outer[data-desc-idx="${issue.descIdx}"]`);
  if (!el) return;
  scrollToElement(el);
  flashAfterScroll(el, "slide-outer--flash");
}

export function ValidationBar() {
  const quiz = currentQuiz.value;
  const descriptors = slideDescriptors.value;
  const questions = quizQuestions.value;
  const images = slideImages.value;
  const money = jackpotSize.value;
  const email = quizEmail.value;
  const visible = showValidation.value;
  const [cursor, setCursor] = useState(0);

  if (!visible || !quiz || !descriptors.length) return null;

  const issues = validateQuiz({
    descriptors, questions, images, quiz,
    jackpotSize: money, email,
  });

  useEffect(() => {
    if (cursor >= issues.length) setCursor(0);
  }, [issues.length]);

  function jump(delta) {
    if (!issues.length) return;
    const next = (cursor + delta + issues.length) % issues.length;
    setCursor(next);
    scrollToIssue(issues[next]);
  }

  function onClickIssue(idx) {
    setCursor(idx);
    scrollToIssue(issues[idx]);
  }

  function jumpToSeverity(sev) {
    const idx = issues.findIndex((i) => i.severity === sev);
    if (idx === -1) return;
    setCursor(idx);
    scrollToIssue(issues[idx]);
    const li = document.querySelectorAll(".validation-bar__list .vb-issue")[idx];
    if (li) li.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function onDismiss() {
    showValidation.value = false;
    scheduleSave();
  }

  const counts = { danger: 0, warning: 0, info: 0 };
  for (const i of issues) counts[i.severity]++;

  return html`
    <div class="validation-bar">
      <div class="validation-bar__header">
        <span class="validation-bar__title">
          ${issues.length === 0
            ? "No validation issues — good to go"
            : `${issues.length} issue${issues.length === 1 ? "" : "s"}.`}
        </span>
        ${issues.length > 0 && html`
          <span class="validation-bar__counts">
            ${counts.danger > 0 && html`<span class="vb-pill vb-pill--danger" onClick=${() => jumpToSeverity("danger")}>${counts.danger} danger</span>`}
            ${counts.warning > 0 && html`<span class="vb-pill vb-pill--warning" onClick=${() => jumpToSeverity("warning")}>${counts.warning} warning</span>`}
            ${counts.info > 0 && html`<span class="vb-pill vb-pill--info" onClick=${() => jumpToSeverity("info")}>${counts.info} info</span>`}
          </span>
          <span>You can still download, but quiz might be incomplete.</span>
          <div class="validation-bar__nav">
            <button onClick=${() => jump(-1)} title="Previous issue">Prev</button>
            <span class="validation-bar__cursor">${Math.min(cursor + 1, issues.length)} / ${issues.length}</span>
            <button onClick=${() => jump(1)} title="Next issue">Next</button>
          </div>
        `}
        <button class="validation-bar__dismiss" onClick=${onDismiss} title="Hide validation">× Hide</button>
      </div>
      ${issues.length > 0 && html`
        <ul class="validation-bar__list">
          ${issues.map((issue, i) => html`
            <li
              key=${`${issue.severity}-${issue.descIdx}-${issue.message}`}
              class=${`vb-issue vb-issue--${issue.severity} ${i === cursor ? "vb-issue--active" : ""}`}
              onClick=${() => onClickIssue(i)}
            >
              <span class=${`vb-issue__badge vb-issue__badge--${issue.severity}`}>${issue.severity}</span>
              <span class="vb-issue__label">${issue.label}</span>
              <span class="vb-issue__sep">—</span>
              <span class="vb-issue__msg">${issue.message}</span>
            </li>
          `)}
        </ul>
      `}
    </div>
  `;
}
