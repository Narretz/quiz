import { signal, effect } from "@preact/signals";
import { SLIDE_STYLE, extractQuestions, normalizeSavedQuiz } from "../quiz-core.js";
import { dbPut, dbGet, dbDelete, dbList } from "./db.js";

// --- Core state signals ---
export const currentQuiz = signal(null);
export const currentQuizId = signal(null);
export const slideImages = signal({});
export const slideAudio = signal({});
export const quizQuestions = signal({}); // { "r0q0": { text: { de, en }, answers: { de, en } }, ... }
export const manualOverrides = signal({});
export const slideDescriptors = signal([]);
export const slideOverrides = signal({});
export const savedList = signal([]);
export const status = signal("");
export const debug = new URLSearchParams(location.search).has("debug");

function setQuizParam(id) {
  const url = new URL(location.href);
  if (id) url.searchParams.set("quiz", id);
  else url.searchParams.delete("quiz");
  history.replaceState(null, "", url);
}

export const slideStyle = signal({
  fontSize: SLIDE_STYLE.question.fontSize,
  lineSpacing: SLIDE_STYLE.question.lineSpacing,
  backgroundColor: SLIDE_STYLE.backgroundColor,
  textColor: SLIDE_STYLE.textColor,
});

// Keep SLIDE_STYLE in sync (for buildPptx which reads it directly)
effect(() => {
  const s = slideStyle.value;
  SLIDE_STYLE.question.fontSize = s.fontSize;
  SLIDE_STYLE.question.lineSpacing = s.lineSpacing;
  SLIDE_STYLE.backgroundColor = s.backgroundColor;
  SLIDE_STYLE.textColor = s.textColor;
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
      questions: quizQuestions.value,
      descriptors: slideDescriptors.value,
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
  const normalized = normalizeSavedQuiz(saved);
  currentQuiz.value = normalized.quiz;
  currentQuizId.value = id;
  slideImages.value = normalized.images;
  slideAudio.value = normalized.audio;
  quizQuestions.value = normalized.questions;
  manualOverrides.value = normalized.manualOverrides;
  slideDescriptors.value = normalized.descriptors;
  if (normalized.style) {
    slideStyle.value = normalized.style;
  }
  setQuizParam(id);
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
    quizQuestions.value = {};
    manualOverrides.value = {};
    slideDescriptors.value = [];
    status.value = "";
    setQuizParam(null);
  }
  refreshSavedList();
}

export async function uploadQuiz(file) {
  const { astToQuiz, buildSlideDescriptors } = await import("../quiz-core.js");
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
  quizQuestions.value = extractQuestions(quiz);
  slideDescriptors.value = buildSlideDescriptors(quiz);
  currentQuizId.value = id;
  slideImages.value = {};
  slideAudio.value = {};
  manualOverrides.value = {};
  setQuizParam(id);
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
  const { buildPptx } = await import("../quiz-core.js");
  const descriptors = slideDescriptors.value;
  if (!descriptors.length) return;
  status.value = "Generating PPTX...";
  const audio = slideAudio.value;
  const introAssets = await loadIntroAssets();
  const pptx = buildPptx(descriptors, PptxGenJS, slideImages.value, slideOverrides.value, audio, introAssets, quizQuestions.value);
  const hasAudio = Object.keys(audio).length > 0;
  if (hasAudio) {
    // Build slide number → duration map
    const audioDurations = {};
    descriptors.forEach((desc, i) => {
      if (desc.id) {
        const key = desc.type === "question" ? `${desc.id}:${desc.withAnswers ? 1 : 0}` : `${desc.id}:0`;
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
    a.download = `quiz-${currentQuiz.value.date}.pptx`;
    a.click();
    URL.revokeObjectURL(url);
  } else {
    await pptx.writeFile({ fileName: `quiz-${currentQuiz.value.date}.pptx` });
  }
  status.value = "Downloaded!";
}
