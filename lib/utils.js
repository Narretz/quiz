import { SLIDE_STYLE, AUDIO_DIMENSIONS, fit } from "../quiz-core.js";

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

const MAX_MEDIA_SIZE = 30 * 1024 * 1024; // 30MB

export function loadVideoDimensions(dataUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => resolve({
      width: video.videoWidth,
      height: video.videoHeight,
      durationMs: Math.round(video.duration * 1000),
    });
    video.onerror = () => reject(new Error("Failed to load video metadata"));
    video.src = dataUrl;
  });
}

export function extractVideoFrame(dataUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.onloadeddata = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const frameData = canvas.toDataURL("image/png");
      resolve({ data: frameData, width: video.videoWidth, height: video.videoHeight });
      video.src = "";
    };
    video.onerror = () => reject(new Error("Failed to extract video frame"));
    video.src = dataUrl;
  });
}

export function loadAudioDuration(dataUrl) {
  return new Promise((resolve) => {
    const audio = new Audio();
    audio.addEventListener("loadedmetadata", () => resolve(Math.round(audio.duration * 1000)));
    audio.addEventListener("error", () => resolve(0));
    audio.src = dataUrl;
  });
}

export async function loadMediaFile(file) {
  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 30 MB.`);
  }
  const dataUrl = await readFileAsDataURL(file);
  if (file.type.startsWith("video/")) {
    const dims = await loadVideoDimensions(dataUrl);
    let cover;
    try {
      cover = (await extractVideoFrame(dataUrl)).data;
    } catch {}
    return { data: dataUrl, ...dims, type: "video", mimeType: file.type, cover };
  }
  if (file.type.startsWith("audio/")) {
    const durationMs = await loadAudioDuration(dataUrl);
    return { data: dataUrl, ...AUDIO_DIMENSIONS, type: "audio", mimeType: file.type, durationMs, name: file.name };
  }
  const dims = await loadImageDimensions(dataUrl);
  return { data: dataUrl, ...dims };
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

export function stickyBarOffset() {
  const bar = document.querySelector(".validation-bar");
  return bar ? bar.getBoundingClientRect().height + 8 : 0;
}

export function scrollToElement(el, { center = false } = {}) {
  const offset = stickyBarOffset();
  const top = center
    ? el.getBoundingClientRect().top + window.scrollY - offset - (window.innerHeight - offset) / 2 + el.getBoundingClientRect().height / 2
    : el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
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
