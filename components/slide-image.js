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
export function SlideImage({ src, style, imgRef, slideKey, imgIdx, isSource, linkKey, onRerender }) {
  if (!src) return null;
  const images = slideImages.value;
  const myKey = imgIdx === 0 ? slideKey : slideKey + ":1";
  const linkedKey = linkKey ? (imgIdx === 0 ? linkKey : linkKey + ":1") : null;
  const isLinked = linkedKey && images[linkedKey]?.data === images[myKey]?.data;

  function remove(e) {
    e.stopPropagation();
    const myData = images[myKey];
    removeImage(myKey);
    if (isSource && linkedKey && images[linkedKey]?.data === myData?.data) {
      removeImage(linkedKey);
    }
    // Promote image 1 to slot 0 if removing image 0
    if (imgIdx === 0 && images[slideKey + ":1"]) {
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

  return html`
    <div ref=${imgRef || undefined} style=${wrapStyle} class="slide-img-wrap">
      <img src=${src} style="width:100%;height:100%;object-fit:contain" />
      <div class="slide-img-btns">
        <button onClick=${remove}>remove ×</button>
        ${!isSource && isLinked && html`<button onClick=${unlinkImg}>unlink ✂</button>`}
        ${isSource && isLinked && html`<button onClick=${(e) => {
          e.stopPropagation();
          removeImage(linkedKey);
          scheduleSave();
          onRerender();
        }}>remove from linked ✂</button>`}
      </div>
    </div>
  `;
}
