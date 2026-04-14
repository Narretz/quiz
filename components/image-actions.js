import { h } from "preact";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { readFileAsDataURL, loadImageDimensions } from "../lib/utils.js";
import { slideImages, setImage, removeImage, setManualOverride, slideAudio, setAudio, removeAudio, slideOverrides, scheduleSave, debug } from "../lib/state.js";

const html = htm.bind(h);

export function ImageActions({ id, withAnswers, isQuestion = true, linkedSlideKey, imgEntry, slideKey, onRerender }) {
  const images = slideImages.value;
  const imgEntry1 = images[slideKey + ":1"] || null;
  const hasAnyImage = imgEntry || imgEntry1;
  const hasMaxImages = imgEntry && imgEntry1;
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
    const freeSlots = [!images[slideKey] ? slideKey : null, !images[slideKey + ":1"] ? slideKey + ":1" : null].filter(Boolean);
    const files = Array.from(e.target.files).slice(0, freeSlots.length);
    if (!files.length) return;
    for (let i = 0; i < files.length; i++) {
      const dataUrl = await readFileAsDataURL(files[i]);
      const dims = await loadImageDimensions(dataUrl);
      const imgData = { data: dataUrl, ...dims };
      const targetKey = freeSlots[i];
      const oldImg = images[targetKey];
      setImage(targetKey, imgData);
      if (isSource && linkKey) {
        const linkedTargetKey = targetKey === slideKey ? linkKey : linkKey + ":1";
        const linkedImg = images[linkedTargetKey];
        if (!linkedImg || linkedImg.data === oldImg?.data) {
          setImage(linkedTargetKey, { ...imgData });
        }
      }
    }
    e.target.value = "";
    scheduleSave();
    onRerender();
  }

  function removeAllImages() {
    removeImage(slideKey);
    removeImage(slideKey + ":1");
    if (isLinked || (linkKey && images[linkKey])) {
      removeImage(linkKey);
      removeImage(linkKey + ":1");
    }
    scheduleSave();
    onRerender();
  }

  function removeSingleImage(idx) {
    const key = idx === 0 ? slideKey : slideKey + ":1";
    removeImage(key);
    if (isSource && linkKey) {
      const linkedKey = idx === 0 ? linkKey : linkKey + ":1";
      if (images[linkedKey]?.data === images[key]?.data) removeImage(linkedKey);
    }
    // Promote image 1 to slot 0 if image 0 was removed
    if (idx === 0 && images[slideKey + ":1"]) {
      setImage(slideKey, images[slideKey + ":1"]);
      removeImage(slideKey + ":1");
      if (isSource && linkKey && images[linkKey + ":1"]) {
        setImage(linkKey, images[linkKey + ":1"]);
        removeImage(linkKey + ":1");
      }
    }
    scheduleSave();
    onRerender();
  }

  function unlink() {
    removeImage(slideKey);
    removeImage(slideKey + ":1");
    scheduleSave();
    onRerender();
  }

  function relink() {
    // For question answer slides: copy from question. For linked titles: copy from source.
    const sourceKey = isQuestion ? qKey : (linkedSlideKey || qKey);
    const sourceImg = images[sourceKey];
    const sourceImg1 = images[sourceKey + ":1"];
    if (sourceImg) setImage(slideKey, { ...sourceImg }); else removeImage(slideKey);
    if (sourceImg1) setImage(slideKey + ":1", { ...sourceImg1 }); else removeImage(slideKey + ":1");
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
      <div class="img-actions__left">
        ${isQuestion && html`<button onClick=${nav}>${withAnswers ? "\u2191 question" : "\u2193 answer"}</button>`}
        ${isRoundTitle && html`<button onClick=${nav}>${!isSource ? "\u2191 questions" : "\u2193 answers"}</button>`}
      </div>
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
        ${hasAnyImage && html`<button onClick=${removeAllImages}>remove ${hasMaxImages ? "all img" : "img"}</button>`}
        ${!isSource && isLinked && html`
          <button onClick=${unlink}>unlink ${hasMaxImages ? "all img" : "img"}</button>
        `}
        ${!isSource && linkKey && !hasAnyImage && images[linkKey] && html`
          <button onClick=${relink}>relink</button>
        `}
        ${isSource && linkKey && imgEntry && images[linkKey]?.data === imgEntry.data && html`
          <button onClick=${() => { removeImage(linkKey); removeImage(linkKey + ":1"); scheduleSave(); onRerender(); }}>remove ${hasMaxImages ? "all img" : "img"} from linked</button>
        `}
        ${!hasMaxImages && html`
          <label>
            <button type="button" onClick=${(e) => { e.preventDefault(); e.target.parentElement.querySelector("input").click(); }}>+img</button>
            <input type="file" accept="image/*" multiple onChange=${addImg} style="display:none" />
          </label>
        `}
        ${!audioEntry && html`<label>
          <button type="button" onClick=${(e) => { e.preventDefault(); e.target.parentElement.querySelector("input").click(); }}>+audio</button>
          <input type="file" accept="audio/*" onChange=${addAudioFile} style="display:none" />
        </label>
        `}
        ${audioEntry && html`<button onClick=${removeAudioFile}>remove audio</button>`}
      </div>
    </div>
  `;
}
