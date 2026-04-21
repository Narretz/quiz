/**
 * Quiz semantic validation. Structural / logical errors are assumed impossible at this point.
 * Returns an array of issues sorted by severity (danger → warning → info).
 *
 * Issue shape:
 *   { severity: "danger" | "warning" | "info", descIdx: number, label: string, message: string }
 */

const SEVERITY_ORDER = { danger: 0, warning: 1, info: 2 };
const EMAIL_RE = /^\S+@\S+\.\S+$/;

function trim(s) { return (s || "").trim(); }

/** Match `word` inside `text` at non-letter boundaries (case-insensitive, unicode-aware). */
function containsWord(text, word) {
  if (!text || !word) return false;
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  return re.test(text);
}

function roundName(quiz, ri) {
  return quiz?.rounds?.[ri]?.name || `Round ${ri + 1}`;
}

function isNameTenRound(quiz, ri) {
  const name = quiz?.rounds?.[ri]?.name || "";
  return /^name\s*10$/i.test(name);
}

function questionLabel(desc, quiz) {
  const m = desc.id?.match(/^r(\d+)q(\d+)$/);
  if (!m) return desc.id || "question";
  const ri = Number(m[1]);
  const base = desc.jackpot ? "Jackpot" : roundName(quiz, ri);
  const suffix = desc.withAnswers ? " (answer)" : "";
  return `${base} Q${desc.num}${suffix}`;
}

function titleLabel(desc) {
  const m = desc.id?.match(/^antworten-s(\d+)$/);
  if (m) return `Answers ${Number(m[1]) + 1}`;
  if (desc.id?.endsWith("-ans")) return `${desc.text} (answers)`;
  return desc.text;
}

function introLabel(desc) {
  return desc.data?.label || desc.data?.id || desc.id || "intro";
}

function descriptionLabel(desc, quiz) {
  const m = desc.id?.match(/^desc-r(\d+)$/);
  if (!m) return desc.id || "description";
  return `${roundName(quiz, Number(m[1]))} description`;
}

function hasMedia(images, slideKey) {
  return !!(images[slideKey] || images[slideKey + ":1"]);
}

function mediaDiffersFrom(images, aKey, bKey) {
  const a0 = images[aKey]?.data;
  const a1 = images[aKey + ":1"]?.data;
  const b0 = images[bKey]?.data;
  const b1 = images[bKey + ":1"]?.data;
  if (a0 && a0 !== b0) return true;
  if (a1 && a1 !== b1) return true;
  return false;
}

export function validateQuiz({ descriptors, questions, images, quiz, jackpotSize, email }) {
  const issues = [];
  const findIdx = (pred) => descriptors.findIndex(pred);

  // --- Global (jackpot + email) — target the input fields, not slides ---
  if (!jackpotSize) {
    const idx = findIdx((d) => d.id === "intro-1");
    issues.push({
      severity: "info",
      descIdx: idx >= 0 ? idx : 0,
      target: '.setting-input[type="number"]',
      label: "Jackpot",
      message: "Jackpot size is not set",
    });
  }
  if (!trim(email)) {
    const idx = findIdx((d) => d.id === "goodbye");
    issues.push({
      severity: "info",
      descIdx: idx >= 0 ? idx : 0,
      target: ".setting-input--email",
      label: "Email",
      message: "Email is not set",
    });
  } else if (!EMAIL_RE.test(trim(email))) {
    const idx = findIdx((d) => d.id === "goodbye");
    issues.push({
      severity: "info",
      descIdx: idx >= 0 ? idx : 0,
      target: ".setting-input--email",
      label: "Email",
      message: "Email format looks invalid",
    });
  }

  // --- Per-descriptor ---
  for (let i = 0; i < descriptors.length; i++) {
    const desc = descriptors[i];

    if (desc.type === "question") {
      const qKey = `${desc.id}:0`;
      const aKey = `${desc.id}:1`;
      const q = questions[desc.id] || desc.q || { text: { de: "", en: "" }, answers: { de: "", en: "" } };
      const text = q.text || { de: "", en: "" };
      const answers = q.answers || { de: "", en: "" };
      const slideKey = desc.withAnswers ? aKey : qKey;

      const de = trim(text.de);
      const en = trim(text.en);
      const ansDe = trim(answers.de);
      const ansEn = trim(answers.en);
      const hasText = !!(de || en);
      const hasAnsText = !!(ansDe || ansEn);

      // danger: answer appears in question text (check once, on question phase; link to answer slide)
      // Skip answers shorter than 3 characters to avoid false positives on multiple-choice letters.
      if (!desc.withAnswers && hasText) {
        const leaked = [];
        for (const ans of [ansDe, ansEn]) {
          if (!ans || ans.length < 3 || leaked.includes(ans)) continue;
          if (containsWord(de, ans) || containsWord(en, ans)) leaked.push(ans);
        }
        if (leaked.length) {
          const answerIdx = descriptors.findIndex(
            (d) => d.type === "question" && d.id === desc.id && d.withAnswers,
          );
          const answerDesc = answerIdx >= 0 ? descriptors[answerIdx] : desc;
          issues.push({
            severity: "danger",
            descIdx: answerIdx >= 0 ? answerIdx : i,
            label: questionLabel(answerDesc, quiz),
            message: `Answer appears in question text: "${leaked.join('", "')}"`,
          });
        }
      }

      // warning: slide has no content
      if (desc.withAnswers) {
        // Answer slide: OK if answer text, OR distinct media from question.
        const nameTen = isNameTenRound(quiz, Number(desc.id.match(/^r(\d+)/)[1]));
        if (!nameTen) {
          const distinctMedia = mediaDiffersFrom(images, aKey, qKey);
          const qHasContent = hasText || hasMedia(images, qKey);
          if (!hasAnsText && !distinctMedia) {
            issues.push({
              severity: "warning",
              descIdx: i,
              label: questionLabel(desc, quiz),
              message: qHasContent
                ? "Answer slide has no answer text and no media distinct from the question"
                : "Answer slide has no answer text or media",
            });
          }
        }
      } else {
        if (!hasText && !hasMedia(images, qKey)) {
          issues.push({
            severity: "warning",
            descIdx: i,
            label: questionLabel(desc, quiz),
            message: "Question slide has no text or media",
          });
        } else if (desc.jackpot && !hasText && hasMedia(images, qKey)) {
          issues.push({
            severity: "warning",
            descIdx: i,
            label: questionLabel(desc, quiz),
            message: "Jackpot question has media but no text (jackpot questions lack a shared theme)",
          });
        }
      }

      // warning: question has text but only one language (not for answer slides)
      if (!desc.withAnswers && hasText) {
        if (de && !en) {
          issues.push({
            severity: "warning",
            descIdx: i,
            label: questionLabel(desc, quiz),
            message: "English translation missing",
          });
        } else if (en && !de) {
          issues.push({
            severity: "warning",
            descIdx: i,
            label: questionLabel(desc, quiz),
            message: "German translation missing",
          });
        }
      }

      // info: very short question text
      if (!desc.withAnswers && hasText) {
        const shortLangs = [];
        if (de && de.length < 10) shortLangs.push("de");
        if (en && en.length < 10) shortLangs.push("en");
        if (shortLangs.length) {
          issues.push({
            severity: "info",
            descIdx: i,
            label: questionLabel(desc, quiz),
            message: `Very short question text (${shortLangs.join(", ")})`,
          });
        }
      }
      continue;
    }

    if (desc.type === "title") {
      // Skip the round-title answer slide (title-r{n}-ans): it mirrors the question-phase
      // title by default, so a missing image there is already covered by its pair.
      if (desc.id?.endsWith("-ans")) continue;
      const slideKey = `${desc.id}:0`;
      if (!hasMedia(images, slideKey)) {
        issues.push({
          severity: "info",
          descIdx: i,
          label: titleLabel(desc),
          message: "Title slide has no image",
        });
      }
      continue;
    }

    if (desc.type === "intro") {
      // Intros 0-2 don't support images (welcome, rules, format). Intros 3+ and extra slides do.
      const supportsImages = desc.introIndex == null ? true : desc.introIndex >= 3;
      if (!supportsImages) continue;
      const slideKey = `${desc.id}:0`;
      if (!hasMedia(images, slideKey)) {
        issues.push({
          severity: "info",
          descIdx: i,
          label: introLabel(desc),
          message: "Extra slide has no image",
        });
      }
      continue;
    }

    if (desc.type === "description") {
      const de = trim(desc.text?.de);
      const en = trim(desc.text?.en);
      if (de && !en) {
        issues.push({
          severity: "warning",
          descIdx: i,
          label: descriptionLabel(desc, quiz),
          message: "English description missing",
        });
      } else if (en && !de) {
        issues.push({
          severity: "warning",
          descIdx: i,
          label: descriptionLabel(desc, quiz),
          message: "German description missing",
        });
      }
      continue;
    }
  }

  issues.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return s !== 0 ? s : a.descIdx - b.descIdx;
  });
  return issues;
}
