import { h } from "preact";
import htm from "htm";
import { slideImages, setImage, removeImage, scheduleSave } from "../lib/state.js";

const html = htm.bind(h);

/**
 * Renders an image with per-image remove/unlink hover buttons.
 * Props:
 *   src        - image data URL
 *   style      - absolute positioning style (for pre-computed layouts)
 *   imgRef     - ref for dynamically positioned images (replaces style)
 *   slideKey   - base slide key (e.g. "r0q0:0")
 *   imgIdx     - 0 or 1
 *   isSource   - true if this slide pushes images to linked slide
 *   linkKey    - paired slide's base key (e.g. "r0q0:1"), or null
 *   onRerender - callback after mutation
 */
export function SlideImage({ src, type, name, style, imgRef, slideKey, imgIdx, isSource, linkKey, onRerender }) {
  if (!src) return null;
  const mediaType = type || "image";
  const images = slideImages.value;
  const myKey = imgIdx === 0 ? slideKey : slideKey + ":1";
  const linkedKey = linkKey ? (imgIdx === 0 ? linkKey : linkKey + ":1") : null;
  const isLinked = linkedKey && images[linkedKey]?.data === images[myKey]?.data;

  function remove(e) {
    e.stopPropagation();
    const myData = images[myKey];
    const wasVideo = myData?.type === "video";
    const linkedRemoved = linkedKey && images[linkedKey]?.data === myData?.data;
    removeImage(myKey);
    if (linkedRemoved) removeImage(linkedKey);
    if (wasVideo && isSource && linkKey) {
      const r0 = slideImages.value[linkKey]?.videoFrame;
      const r1 = slideImages.value[linkKey + ":1"]?.videoFrame;
      if (r0) removeImage(linkKey);
      if (r1) removeImage(linkKey + ":1");
      if (r0 && !r1 && slideImages.value[linkKey + ":1"]) {
        setImage(linkKey, slideImages.value[linkKey + ":1"]);
        removeImage(linkKey + ":1");
      }
    }
    // Promote image 1 to slot 0 if removing image 0 (on both sides if linked removal)
    if (imgIdx === 0 && images[slideKey + ":1"]) {
      setImage(slideKey, images[slideKey + ":1"]);
      removeImage(slideKey + ":1");
      if (linkedRemoved && images[linkKey + ":1"]) {
        setImage(linkKey, images[linkKey + ":1"]);
        removeImage(linkKey + ":1");
      }
    }
    scheduleSave();
    onRerender();
  }

  function unlinkImg(e) {
    e.stopPropagation();
    removeImage(myKey);
    if (imgIdx === 0 && images[slideKey + ":1"]) {
      setImage(slideKey, images[slideKey + ":1"]);
      removeImage(slideKey + ":1");
    }
    scheduleSave();
    onRerender();
  }

  const wrapStyle = imgRef
    ? { position: "absolute" }
    : { ...style, objectFit: undefined };

  const actionBtns = html`
    <div class="slide-img-btns">
      <button tabindex="-1" onClick=${remove}>remove ×</button>
      ${!isSource && isLinked && html`<button tabindex="-1" onClick=${unlinkImg}>unlink ✂</button>`}
      ${isSource && isLinked && html`<button tabindex="-1" onClick=${(e) => {
        e.stopPropagation();
        removeImage(linkedKey);
        scheduleSave();
        onRerender();
      }}>remove from linked ✂</button>`}
    </div>
  `;

  if (mediaType === "audio") {
    return html`
      <div ref=${imgRef || undefined} style=${wrapStyle} class="slide-img-wrap slide-img-wrap--audio">
        <div class="slide-audio-slot">
          ${actionBtns}
          <audio controls preload="none" src=${src} />
          <span class="slide-audio__name">${name || ""}</span>
        </div>
      </div>
    `;
  }

  return html`
    <div ref=${imgRef || undefined} style=${wrapStyle} class="slide-img-wrap">
      ${mediaType === "video" && html`<video src=${src} controls style="width:100%;height:100%;object-fit:contain" />`}
      ${mediaType === "image" && html`<img src=${src} style="width:100%;height:100%;object-fit:contain" />`}
      ${actionBtns}
    </div>
  `;
}
