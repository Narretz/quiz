import { signal, effect } from "@preact/signals";
import { SLIDE_STYLE } from "../quiz-core.js";
import { dbPut, dbGet, dbDelete, dbList } from "./db.js";

// --- Core state signals ---
export const currentQuiz = signal(null);
export const currentQuizId = signal(null);
export const slideImages = signal({});
export const slideAudio = signal({});
export const manualOverrides = signal({});
export const slideOverrides = signal({});
export const savedList = signal([]);
export const status = signal("");
export const debug = new URLSearchParams(location.search).has("debug");

export const slideStyle = signal({
  fontSize: SLIDE_STYLE.question.fontSize,
  lineSpacing: SLIDE_STYLE.question.lineSpacing,
  backgroundColor: SLIDE_STYLE.backgroundColor,
});

// Keep SLIDE_STYLE in sync (for buildPptx which reads it directly)
effect(() => {
  const s = slideStyle.value;
  SLIDE_STYLE.question.fontSize = s.fontSize;
  SLIDE_STYLE.question.lineSpacing = s.lineSpacing;
  SLIDE_STYLE.backgroundColor = s.backgroundColor;
});

// --- Persistence ---
let persistRequested = false;
let saveTimeout = null;

export function scheduleSave() {
  const quiz = currentQuiz.value;
  const id = currentQuizId.value;
  if (!quiz || !id) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (!persistRequested) {
      persistRequested = true;
      navigator.storage?.persist?.();
    }
    await dbPut({
      id,
      quiz,
      images: slideImages.value,
      audio: slideAudio.value,
      manualOverrides: manualOverrides.value,
      style: slideStyle.value,
      savedAt: Date.now(),
    });
    refreshSavedList();
  }, 300);
}

export async function refreshSavedList() {
  savedList.value = await dbList();
}

// --- Image helpers ---
export function setImage(key, imgData) {
  slideImages.value = { ...slideImages.value, [key]: imgData };
}

export function removeImage(key) {
  const next = { ...slideImages.value };
  delete next[key];
  slideImages.value = next;
}

export function clearImages() {
  slideImages.value = {};
}

// --- Audio helpers (no question→answer linking) ---
export function setAudio(key, audioData) {
  slideAudio.value = { ...slideAudio.value, [key]: audioData };
}

export function removeAudio(key) {
  const next = { ...slideAudio.value };
  delete next[key];
  slideAudio.value = next;
}

export function clearAudio() {
  slideAudio.value = {};
}

// --- Override helpers ---
export function setManualOverride(key, override) {
  manualOverrides.value = { ...manualOverrides.value, [key]: override };
}

export function clearManualOverrides() {
  manualOverrides.value = {};
}

// --- Load / delete quiz ---
export async function loadSavedQuiz(id) {
  const saved = await dbGet(id);
  if (!saved) return;
  currentQuiz.value = saved.quiz;
  currentQuizId.value = id;
  slideImages.value = saved.images || {};
  slideAudio.value = saved.audio || {};
  manualOverrides.value = saved.manualOverrides || {};
  if (saved.style) {
    slideStyle.value = {
      fontSize: saved.style.fontSize,
      lineSpacing: saved.style.lineSpacing,
      backgroundColor: saved.style.backgroundColor || "#FFFFFF",
    };
  }
  status.value = `${saved.quiz.rounds.length} rounds, ${saved.quiz.date}`;
}

export async function deleteSavedQuiz(id) {
  if (!confirm(`Delete saved quiz "${id}"?`)) return;
  await dbDelete(id);
  if (currentQuizId.value === id) {
    currentQuiz.value = null;
    currentQuizId.value = null;
    slideImages.value = {};
    slideAudio.value = {};
    manualOverrides.value = {};
    status.value = "";
  }
  refreshSavedList();
}

export async function uploadQuiz(file) {
  const { astToQuiz } = await import("../quiz-core.js");
  status.value = "Parsing...";
  const buffer = await file.arrayBuffer();
  const ast = await officeParser.OfficeParser.parseOffice(buffer);
  const quiz = astToQuiz(ast);
  let id = quiz.date || `quiz-${Date.now()}`;
  if (await dbGet(id)) {
    let n = 2;
    while (await dbGet(`${id} (${n})`)) n++;
    id = `${id} (${n})`;
  }
  currentQuiz.value = quiz;
  currentQuizId.value = id;
  slideImages.value = {};
  slideAudio.value = {};
  manualOverrides.value = {};
  status.value = `${quiz.rounds.length} rounds, ${quiz.date}`;
  scheduleSave();
}

let introAssetsCache = null;
async function loadIntroAssets() {
  if (introAssetsCache) return introAssetsCache;
  async function toBase64(url, mime) {
    const resp = await fetch(url);
    const buf = await resp.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return `image/${mime};base64,${b64}`;
  }
  introAssetsCache = {
    logo: await toBase64("./lib/assets/tipperary-logo.gif", "gif"),
    toucan: await toBase64("./lib/assets/pub-quiz-toucan.jpg", "jpeg"),
  };
  return introAssetsCache;
}

export async function downloadPptx() {
  const { buildPptx, buildSlideDescriptors } = await import("../quiz-core.js");
  const quiz = currentQuiz.value;
  if (!quiz) return;
  status.value = "Generating PPTX...";
  const audio = slideAudio.value;
  // Load intro slide assets
  const introAssets = await loadIntroAssets();
  const pptx = buildPptx(quiz, PptxGenJS, slideImages.value, slideOverrides.value, audio, introAssets);
  const hasAudio = Object.keys(audio).length > 0;
  if (hasAudio) {
    // Build slide number → duration map
    const descriptors = buildSlideDescriptors(quiz);
    const audioDurations = {};
    descriptors.forEach((desc, i) => {
      if (desc.type !== "title" && desc.id) {
        const key = `${desc.id}:${desc.withAnswers ? 1 : 0}`;
        if (audio[key]?.durationMs) {
          audioDurations[String(i + 1)] = String(audio[key].durationMs);
        }
      }
    });
    const { fixAudioInPptx } = await import("./pptx-audio-fix.js");
    const buf = await pptx.write({ outputType: "arraybuffer" });
    const blob = await fixAudioInPptx(buf, audioDurations);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `quiz-${quiz.date}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await pptx.writeFile({ fileName: `quiz-${quiz.date}.pptx` });
  }
  status.value = "Downloaded!";
}
