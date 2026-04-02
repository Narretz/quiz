import { signal, effect } from "@preact/signals";
import { SLIDE_STYLE } from "../quiz-core.js";
import { dbPut, dbGet, dbDelete, dbList } from "./db.js";

// --- Core state signals ---
export const currentQuiz = signal(null);
export const currentQuizId = signal(null);
export const slideImages = signal({});
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
  manualOverrides.value = {};
  status.value = `${quiz.rounds.length} rounds, ${quiz.date}`;
  scheduleSave();
}

export async function downloadPptx() {
  const { buildPptx } = await import("../quiz-core.js");
  const quiz = currentQuiz.value;
  if (!quiz) return;
  status.value = "Generating PPTX...";
  const pptx = buildPptx(quiz, PptxGenJS, slideImages.value, slideOverrides.value);
  await pptx.writeFile({ fileName: `quiz-${quiz.date}.pptx` });
  status.value = "Downloaded!";
}
