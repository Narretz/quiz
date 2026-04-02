import { signal, effect } from "@preact/signals";
import { SLIDE_STYLE } from "../quiz-core.js";
import { dbPut, dbList } from "./db.js";

// --- Core state signals ---
export const currentQuiz = signal(null);
export const currentQuizId = signal(null);
export const slideImages = signal({});
export const manualOverrides = signal({});
export const slideOverrides = signal({});
export const savedList = signal([]);
export const status = signal("");

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
