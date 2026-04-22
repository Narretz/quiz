import { h } from "preact";
import htm from "htm";
import { SLIDE_STYLE } from "../quiz-core.js";
import { loadMediaFile, extractVideoFrame } from "../lib/utils.js";
import { slideImages, setImage, removeImage, manualOverrides, setManualOverride, slideOverrides, slideReveals, setSlideReveal, scheduleSave, debug } from "../lib/state.js";

const html = htm.bind(h);

export function ImageActions({ id, withAnswers, isQuestion = true, linkedSlideKey, imgEntry, slideKey, jackpot = false, onRerender }) {
  const images = slideImages.value;
  const imgEntry1 = images[slideKey + ":1"] || null;
  const hasAnyMedia = imgEntry || imgEntry1;
  const hasMaxSlots = imgEntry && imgEntry1;
  const hasAV = [imgEntry, imgEntry1].some((e) => e?.type === "audio" || e?.type === "video");
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
      try {
        const imgData = await loadMediaFile(files[i]);
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
      } catch (err) {
        alert(err.message);
        break;
      }
    }
    e.target.value = "";
    scheduleSave();
    onRerender();
  }

  async function addAV(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const entry = await loadMediaFile(file);
      const freeSlot = !images[slideKey] ? slideKey : (!images[slideKey + ":1"] ? slideKey + ":1" : null);
      if (!freeSlot) return;
      setImage(freeSlot, entry);
      if (entry.type === "video" && isSource && linkKey && !images[linkKey] && !images[linkKey + ":1"]) {
        extractVideoFrame(entry.data).then((frame) => {
          if (!slideImages.value[linkKey] && !slideImages.value[linkKey + ":1"]) {
            setImage(linkKey, { ...frame, videoFrame: true });
            scheduleSave();
            onRerender();
          }
        }).catch(() => {});
      }
    } catch (err) {
      alert(err.message);
    }
    e.target.value = "";
    scheduleSave();
    onRerender();
  }

  function removeAllImages() {
    removeImage(slideKey);
    removeImage(slideKey + ":1");
    if (linkKey) {
      for (const k of [linkKey, linkKey + ":1"]) {
        const linked = images[k];
        if (!linked) continue;
        if (linked.videoFrame) { removeImage(k); continue; }
        if (imgEntry && linked.data === imgEntry.data) { removeImage(k); continue; }
        if (imgEntry1 && linked.data === imgEntry1.data) { removeImage(k); continue; }
      }
      if (!slideImages.value[linkKey] && slideImages.value[linkKey + ":1"]) {
        setImage(linkKey, slideImages.value[linkKey + ":1"]);
        removeImage(linkKey + ":1");
      }
    }
    scheduleSave();
    onRerender();
  }

  function removeLinkedVideoFrames() {
    if (!linkKey) return;
    const cur = slideImages.value;
    const removed0 = cur[linkKey]?.videoFrame;
    const removed1 = cur[linkKey + ":1"]?.videoFrame;
    if (removed0) removeImage(linkKey);
    if (removed1) removeImage(linkKey + ":1");
    if (removed0 && !removed1 && slideImages.value[linkKey + ":1"]) {
      setImage(linkKey, slideImages.value[linkKey + ":1"]);
      removeImage(linkKey + ":1");
    }
  }

  function removeSingleImage(idx) {
    const key = idx === 0 ? slideKey : slideKey + ":1";
    const wasVideo = images[key]?.type === "video";
    removeImage(key);
    if (isSource && linkKey) {
      const linkedKey = idx === 0 ? linkKey : linkKey + ":1";
      if (images[linkedKey]?.data === images[key]?.data) removeImage(linkedKey);
    }
    if (wasVideo && isSource) removeLinkedVideoFrames();
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

  function resetOverride() {
    const next = { ...manualOverrides.value };
    delete next[slideKey];
    manualOverrides.value = next;
    scheduleSave();
    onRerender();
  }

  const hasManualOverride = !!manualOverrides.value[slideKey];
  const effective = slideOverrides.value[slideKey];
  const displayFs = effective?.fontSize ?? SLIDE_STYLE.question.fontSize;
  const displayLs = effective?.lineSpacing ?? SLIDE_STYLE.question.lineSpacing;

  const isAnswerSlide = isQuestion && withAnswers;
  const explicitReveal = slideReveals.value[slideKey];
  const revealOn = explicitReveal == null ? jackpot : !!explicitReveal;

  function toggleReveal() {
    const next = !revealOn;
    // Store explicit value only when it differs from the descriptor default.
    setSlideReveal(slideKey, next === jackpot ? null : next);
    scheduleSave();
    onRerender();
  }

  return html`
    <div class="img-actions">
      <div class="img-actions__left">
        ${isQuestion && html`<button onClick=${nav}>${withAnswers ? "\u2191 question" : "\u2193 answer"}</button>`}
        ${isRoundTitle && html`<button onClick=${nav}>${!isSource ? "\u2191 questions" : "\u2193 answers"}</button>`}
      </div>
      <div class="img-actions__right">
        ${debug && html`
          <label class="override-label">
            <input type="number" class="slide-fs-input" step="0.5" value=${displayFs}
                   onChange=${onOverrideChange} title="Font size (pt)" />pt
          </label>
          <label class="override-label">
            <input type="number" class="slide-ls-input" step="1" value=${displayLs}
                   onChange=${onOverrideChange} title="Line spacing %" />%
          </label>
          ${hasManualOverride && html`<button onClick=${resetOverride} title="Clear manual override, return to auto-fitting">\u21BA auto</button>`}
        `}
        ${hasAnyMedia && html`<button onClick=${removeAllImages}>remove ${hasMaxSlots ? "all" : "media"}</button>`}
        ${!isSource && isLinked && html`
          <button onClick=${unlink}>unlink ${hasMaxSlots ? "all" : "media"}</button>
        `}
        ${!isSource && linkKey && !hasAnyMedia && images[linkKey] && html`
          <button onClick=${relink}>relink</button>
        `}
        ${isSource && linkKey && imgEntry && images[linkKey]?.data === imgEntry.data && html`
          <button onClick=${() => { removeImage(linkKey); removeImage(linkKey + ":1"); scheduleSave(); onRerender(); }}>remove ${hasMaxSlots ? "all" : "media"} from linked</button>
        `}
        ${!hasMaxSlots && html`
          <label>
            <button type="button" onClick=${(e) => { e.preventDefault(); e.target.parentElement.querySelector("input").click(); }}>+img</button>
            <input type="file" accept="image/*" multiple onChange=${addImg} style="display:none" />
          </label>
        `}
        ${!hasAV && !hasMaxSlots && html`
          <label>
            <button type="button" onClick=${(e) => { e.preventDefault(); e.target.parentElement.querySelector("input").click(); }}>+av</button>
            <input type="file" accept="audio/*,video/*" onChange=${addAV} style="display:none" />
          </label>
        `}
      </div>
    </div>
  `;
}
