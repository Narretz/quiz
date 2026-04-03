import { h } from "preact";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { readFileAsDataURL, loadImageDimensions } from "../lib/utils.js";
import { slideImages, setImage, removeImage, setManualOverride, slideAudio, setAudio, removeAudio, slideOverrides, scheduleSave, debug } from "../lib/state.js";

const html = htm.bind(h);

export function ImageActions({ id, withAnswers, isQuestion = true, linkedSlideKey, imgEntry, slideKey, onRerender }) {
  const images = slideImages.value;
  const qKey = `${id}:0`;
  const ansKey = `${id}:1`;
  // linkKey = the paired slide for image sharing. isSource = this slide pushes images to linkKey.
  const linkKey = isQuestion ? (withAnswers ? qKey : ansKey) : linkedSlideKey;
  const isRoundTitle = !isQuestion && (id?.startsWith("title-r") || id?.endsWith("-ans"));
  const isRoundTitleForAnswers = isRoundTitle && id?.endsWith("-ans");
  const isSource = isQuestion ? !withAnswers : (id?.startsWith("title-r") && !id?.endsWith("-ans"));
  const isLinked = linkKey && imgEntry && images[linkKey]?.data === imgEntry.data;

  function nav() {
    let selector = null;

    if (isRoundTitle) {
      const titleId = isRoundTitleForAnswers ? id.replace('-ans', '') : `${id}-ans`;
      selector = `.slide[data-slide-id="${titleId}"]`;
    } else {
      selector = `.slide[data-slide-id="${id}"][data-answers="${withAnswers ? "0" : "1"}"]`;
    }

    const target = document.querySelector(selector);

    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addImg(e) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    const dims = await loadImageDimensions(dataUrl);
    const imgData = { data: dataUrl, ...dims };
    const oldImg = images[slideKey];
    setImage(slideKey, imgData);
    // Auto-copy to linked slide only if this is the source side
    if (isSource && linkKey) {
      const linkedImg = images[linkKey];
      if (!linkedImg || linkedImg.data === oldImg?.data) {
        setImage(linkKey, { ...imgData });
      }
    }
    e.target.value = "";
    scheduleSave();
    onRerender();
  }

  function removeImg() {
    if (isLinked) {
      removeImage(slideKey);
      removeImage(linkKey);
    } else {
      removeImage(slideKey);
    }
    scheduleSave();
    onRerender();
  }

  function unlink() {
    removeImage(slideKey);
    scheduleSave();
    onRerender();
  }

  function relink() {
    // For question answer slides: copy from question. For linked titles: copy from source.
    const sourceKey = isQuestion ? qKey : (linkedSlideKey || qKey);
    const sourceImg = images[sourceKey];
    if (sourceImg) setImage(slideKey, { ...sourceImg });
    else removeImage(slideKey);
    scheduleSave();
    onRerender();
  }

  function onOverrideChange(e) {
    const parent = e.target.closest(".img-actions");
    const fs = parent.querySelector(".slide-fs-input");
    const ls = parent.querySelector(".slide-ls-input");
    setManualOverride(slideKey, {
      fontSize: Number(fs.value),
      lineSpacing: Number(ls.value),
    });
    scheduleSave();
    onRerender();
  }

  const audioEntry = slideAudio.value[slideKey];

  async function addAudioFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    // Get duration in ms by loading into an audio element
    const durationMs = await new Promise((resolve) => {
      const audio = new Audio();
      audio.addEventListener("loadedmetadata", () => {
        resolve(Math.round(audio.duration * 1000));
      });
      audio.addEventListener("error", () => resolve(0));
      audio.src = dataUrl;
    });
    setAudio(slideKey, { data: dataUrl, name: file.name, durationMs });
    e.target.value = "";
    scheduleSave();
    onRerender();
  }

  function removeAudioFile() {
    removeAudio(slideKey);
    scheduleSave();
    onRerender();
  }

  const effective = slideOverrides.value[slideKey];
  const displayFs = effective?.fontSize ?? SLIDE_STYLE.question.fontSize;
  const displayLs = effective?.lineSpacing ?? SLIDE_STYLE.question.lineSpacing;

  return html`
    <div class="img-actions">
      ${isQuestion && html`<button onClick=${nav}>${withAnswers ? "\u2191 question" : "\u2193 answer"}</button>`}
      ${isRoundTitle && html`<button onClick=${nav}>${!isSource ? "\u2191 questions" : "\u2193 answers"}</button>`}
        <div class="img-actions__right">
        ${debug && imgEntry && html`
          <label class="override-label">
            <input type="number" class="slide-fs-input" step="0.5" value=${displayFs}
                   onChange=${onOverrideChange} title="Font size (pt)" />pt
          </label>
          <label class="override-label">
            <input type="number" class="slide-ls-input" step="1" value=${displayLs}
                   onChange=${onOverrideChange} title="Line spacing %" />%
          </label>
        `}
        <label>
          <button type="button" onClick=${(e) => { e.preventDefault(); e.target.parentElement.querySelector("input").click(); }}>+img</button>
          <input type="file" accept="image/*" onChange=${addImg} style="display:none" />
        </label>
        ${imgEntry && html`<button onClick=${removeImg}>remove img</button>`}
        ${!isSource && isLinked && html`
          <button onClick=${unlink}>unlink</button>
        `}
        ${!isSource && linkKey && !imgEntry && images[linkKey] && html`
          <button onClick=${relink}>relink</button>
        `}
        ${isSource && linkKey && imgEntry && images[linkKey]?.data === imgEntry.data && html`
          <button onClick=${() => { removeImage(linkKey); scheduleSave(); onRerender(); }}>remove from linked</button>
        `}
        <label>
          <button type="button" onClick=${(e) => { e.preventDefault(); e.target.parentElement.querySelector("input").click(); }}>+audio</button>
          <input type="file" accept="audio/*" onChange=${addAudioFile} style="display:none" />
        </label>
        ${audioEntry && html`<button onClick=${removeAudioFile}>remove audio</button>`}
      </div>
    </div>
  `;
}
