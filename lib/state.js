import { signal, effect } from "@preact/signals";
import { SLIDE_STYLE, extractQuestions, isRevealEffective, normalizeSavedQuiz, getSlideImages } from "../quiz-core.js";
import { dbPut, dbGet, dbDelete, dbList } from "./db.js";

// --- Core state signals ---
export const currentQuiz = signal(null);
export const currentQuizId = signal(null);
export const slideImages = signal({});
export const quizQuestions = signal({}); // { "r0q0": { text: { de, en }, answers: { de, en } }, ... }
export const manualOverrides = signal({});
export const slideReveals = signal({}); // { "r0q0:1": true | false } — explicit override; undefined = use descriptor default
export const slideDescriptors = signal([]);
export const slideOverrides = signal({});
export const savedList = signal([]);
export const status = signal("");
export const debug = new URLSearchParams(location.search).has("debug");
export const jackpotSize = signal(0);
export const quizEmail = signal("");
export const showValidation = signal(false);

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
      manualOverrides: manualOverrides.value,
      reveals: slideReveals.value,
      style: slideStyle.value,
      jackpotSize: jackpotSize.value,
      email: quizEmail.value,
      showValidation: showValidation.value,
      savedAt: Date.now(),
    });
    dbPut({
      id: "__defaults__",
      jackpotSize: jackpotSize.value,
      email: quizEmail.value,
      style: slideStyle.value,
      showValidation: showValidation.value,
    });
    refreshSavedList();
  }, 300);
}

export async function refreshSavedList() {
  const all = await dbList();
  savedList.value = all.filter(item => item.id !== "__defaults__");
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

// --- Override helpers ---
export function setManualOverride(key, override) {
  manualOverrides.value = { ...manualOverrides.value, [key]: override };
}

export function clearManualOverrides() {
  manualOverrides.value = {};
}

/** Set or clear an explicit reveal choice. Pass `null` to drop back to the descriptor default. */
export function setSlideReveal(key, value) {
  const next = { ...slideReveals.value };
  if (value == null) delete next[key];
  else next[key] = !!value;
  slideReveals.value = next;
}

// --- Load / delete quiz ---
export async function loadSavedQuiz(id) {
  const saved = await dbGet(id);
  if (!saved) return;
  const normalized = normalizeSavedQuiz(saved);
  currentQuiz.value = normalized.quiz;
  currentQuizId.value = id;
  slideImages.value = normalized.images;
  quizQuestions.value = normalized.questions;
  manualOverrides.value = normalized.manualOverrides;
  slideReveals.value = normalized.reveals;
  slideDescriptors.value = normalized.descriptors;
  if (normalized.style) {
    slideStyle.value = normalized.style;
  }
  jackpotSize.value = normalized.jackpotSize || 0;
  quizEmail.value = normalized.email || "";
  showValidation.value = !!normalized.showValidation;
  setQuizParam(id);
  status.value = `${saved.quiz.rounds.length} rounds`;
}

export function unloadQuiz() {
  currentQuiz.value = null;
  currentQuizId.value = null;
  slideImages.value = {};
  quizQuestions.value = {};
  manualOverrides.value = {};
  slideReveals.value = {};
  slideDescriptors.value = [];
  jackpotSize.value = 0;
  quizEmail.value = "";
  showValidation.value = false;
  status.value = "";
  setQuizParam(null);
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
}

export async function deleteSavedQuiz(id) {
  if (!confirm(`Delete saved quiz "${id}"?`)) return;
  await dbDelete(id);
  if (currentQuizId.value === id) {
    currentQuiz.value = null;
    currentQuizId.value = null;
    slideImages.value = {};
    quizQuestions.value = {};
    manualOverrides.value = {};
    slideReveals.value = {};
    slideDescriptors.value = [];
    jackpotSize.value = 0;
    quizEmail.value = "";
    showValidation.value = false;
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
  manualOverrides.value = {};
  slideReveals.value = {};
  const defaults = await dbGet("__defaults__");
  jackpotSize.value = defaults?.jackpotSize || 0;
  quizEmail.value = defaults?.email || "";
  if (defaults?.style) slideStyle.value = { ...slideStyle.value, ...defaults.style };
  showValidation.value = !!defaults?.showValidation;
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
  const images = slideImages.value;
  const reveals = slideReveals.value;
  const introAssets = await loadIntroAssets();
  const pptx = buildPptx(descriptors, PptxGenJS, images, slideOverrides.value, {}, introAssets, quizQuestions.value, {
    jackpotSize: jackpotSize.value,
    email: quizEmail.value,
    reveals,
  });

  const audioDurations = {};
  const audioSlideNumbers = new Set();
  const videoDurations = {};
  const videoSlideNumbers = new Set();
  const revealSlides = new Set();
  descriptors.forEach((desc, i) => {
    const slideNum = i + 1;
    if (desc.id) {
      const key = desc.type === "question" ? `${desc.id}:${desc.withAnswers ? 1 : 0}` : `${desc.id}:0`;
      const [entry0, entry1] = getSlideImages(images, key);
      for (const entry of [entry0, entry1]) {
        if (entry?.type === "audio" && entry.durationMs) {
          audioDurations[String(slideNum)] = String(entry.durationMs);
          audioSlideNumbers.add(String(slideNum));
        }
        if (entry?.type === "video") {
          videoSlideNumbers.add(String(slideNum));
          if (entry.durationMs) videoDurations[String(slideNum)] = String(entry.durationMs);
        }
      }
    }
    if (isRevealEffective(reveals, desc)) revealSlides.add(slideNum);
  });

  const needsPostProcess = audioSlideNumbers.size > 0 || revealSlides.size > 0 || videoSlideNumbers.size > 0;
  if (needsPostProcess) {
    const { postProcessPptx } = await import("./pptx-fix.js");
    const buf = await pptx.write({ outputType: "arraybuffer" });
    const blob = await postProcessPptx(buf, { audioDurations, audioSlideNumbers, videoDurations, videoSlideNumbers, revealSlides });
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
