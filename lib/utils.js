import { SLIDE_STYLE, fit } from "../quiz-core.js";

export let PREVIEW_WIDTH = 576; // px — must match CSS .slide width
export let PT_SCALE = PREVIEW_WIDTH / (SLIDE_STYLE.width * 72); // pt → px
export let PX = PREVIEW_WIDTH / SLIDE_STYLE.width; // inches → preview px
export let px = (v) => Math.round(v * PX) + "px";

/** Override preview width and recalculate all scale constants. */
export function setPreviewWidth(w) {
  PREVIEW_WIDTH = w;
  PT_SCALE = w / (SLIDE_STYLE.width * 72);
  PX = w / SLIDE_STYLE.width;
  px = (v) => Math.round(v * PX) + "px";
}

export function esc(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export function loadImageDimensions(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = dataUrl;
  });
}

export function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * Position an image element below a text element, contain-fit to remaining slide space.
 * Shared by title-slide, intro-slide (golden-rules, begin).
 */
export function layoutImageBelowText(textEl, imgEl, imgEntry) {
  if (!textEl || !imgEl || !imgEntry) return;
  const { pad, width: W, height: H } = SLIDE_STYLE;
  const textBottom = (textEl.offsetTop + textEl.offsetHeight) / PX;
  const imgTop = textBottom + pad;
  const boxW = W - 2 * pad;
  const boxH = H - pad - imgTop;
  if (boxH <= 0) return;
  const ar = imgEntry.width / imgEntry.height;
  const { w, h } = fit(boxW, boxH, ar);
  imgEl.style.left = px((W - w) / 2);
  imgEl.style.top = px(imgTop);
  imgEl.style.width = px(w);
  imgEl.style.height = px(h);
}

/** Position two images side-by-side below a text element. */
export function layoutTwoImagesBelowText(textEl, img0El, img1El, entry0, entry1) {
  if (!textEl || !img0El || !img1El || !entry0 || !entry1) return;
  const { pad, width: W, height: H } = SLIDE_STYLE;
  const textBottom = (textEl.offsetTop + textEl.offsetHeight) / PX;
  const imgTop = textBottom + pad;
  const fullW = W - 2 * pad;
  const boxH = H - pad - imgTop;
  if (boxH <= 0) return;
  const gap = pad;
  const boxW = (fullW - gap) / 2;
  for (const [el, entry, xOff] of [[img0El, entry0, pad], [img1El, entry1, pad + boxW + gap]]) {
    const ar = entry.width / entry.height;
    const { w, h } = fit(boxW, boxH, ar);
    el.style.left = px(xOff + (boxW - w) / 2);
    el.style.top = px(imgTop + (boxH - h) / 2);
    el.style.width = px(w);
    el.style.height = px(h);
  }
}
