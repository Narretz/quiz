import { h } from "preact";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { readFileAsDataURL, loadImageDimensions } from "../lib/utils.js";
import { slideImages, setImage, removeImage, setManualOverride, slideAudio, setAudio, removeAudio, scheduleSave, debug } from "../lib/state.js";

const html = htm.bind(h);

export function ImageActions({ id, withAnswers, isQuestion = true, imgEntry, slideKey, fittingResult, onRerender }) {
  const images = slideImages.value;
  const qKey = `${id}:0`;
  const ansKey = `${id}:1`;
  const isLinked = withAnswers && imgEntry && images[qKey]?.data === imgEntry.data;

  function nav() {
    const target = document.querySelector(
      `.slide[data-slide-id="${id}"][data-answers="${withAnswers ? "0" : "1"}"]`
    );
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function addImg(e) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await readFileAsDataURL(file);
    const dims = await loadImageDimensions(dataUrl);
    const imgData = { data: dataUrl, ...dims };
    const isAnswer = withAnswers;
    if (isAnswer) {
      setImage(slideKey, imgData);
    } else {
      const oldQ = images[slideKey];
      const ansImg = images[ansKey];
      setImage(slideKey, imgData);
      if (!ansImg || ansImg.data === oldQ?.data) {
        setImage(ansKey, { ...imgData });
      }
    }
    e.target.value = "";
    scheduleSave();
    onRerender();
  }

  function removeImg() {
    const linked = images[qKey] && images[ansKey] && images[qKey].data === images[ansKey].data;
    if (linked) {
      removeImage(qKey);
      removeImage(ansKey);
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
    const qImg = images[qKey];
    if (qImg) setImage(ansKey, { ...qImg });
    else removeImage(ansKey);
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

  const effective = fittingResult;
  const displayFs = effective?.fontSize ?? SLIDE_STYLE.question.fontSize;
  const displayLs = effective?.lineSpacing ?? SLIDE_STYLE.question.lineSpacing;

  return html`
    <div class="img-actions">
      ${isQuestion && html`<button onClick=${nav}>${withAnswers ? "\u2191 question" : "\u2193 answer"}</button>`}
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
        ${withAnswers && !imgEntry && images[qKey] && html`
          <button onClick=${relink}>relink img from question</button>
        `}
        ${isLinked && html`
          <button onClick=${unlink}>unlink img from question</button>
        `}
        ${isQuestion && !withAnswers && imgEntry && images[ansKey]?.data === imgEntry.data && html`
          <button onClick=${() => { removeImage(ansKey); scheduleSave(); onRerender(); }}>remove img from answer</button>
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
