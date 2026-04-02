import { SLIDE_STYLE } from "../quiz-core.js";

export const PREVIEW_WIDTH = 576; // px — must match CSS .slide width
export const PT_SCALE = PREVIEW_WIDTH / (SLIDE_STYLE.width * 72); // pt → px
export const PX = PREVIEW_WIDTH / SLIDE_STYLE.width; // inches → preview px
export const px = (v) => Math.round(v * PX) + "px";

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
