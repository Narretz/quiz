import { SLIDE_STYLE, computeImageLayout, fit } from "../quiz-core.js";
import { PT_SCALE, PX, px } from "./utils.js";

/**
 * Measure and adjust text layout for a slide with an image.
 * Accepts the slide DOM element and optional forced font size / line spacing.
 * Returns { fontSize, lineSpacing, enY, deW?, enW?, imgLayout? } or null.
 */
export function fitSlideText(slideDiv, slideImages, forceFs, forceLs) {
  const deEl = slideDiv.querySelector('[data-role="de"]');
  const enEl = slideDiv.querySelector('[data-role="en"]');
  if (!deEl) return null;

  const id = slideDiv.dataset.slideId;
  const isAnswer = slideDiv.dataset.answers === "1";
  const slideKey = `${id}:${isAnswer ? 1 : 0}`;
  const imgEntry = slideImages[slideKey];
  const { pad, height: H } = SLIDE_STYLE;

  // Bottom limit: answer bar, image, or slide edge
  let bottomLimit = H - pad;
  let deBottomLimit = null; // Extra constraint: DE at full width must not overlap landscape image
  if (isAnswer) bottomLimit = 4.8;
  if (imgEntry) {
    const ar = imgEntry.width / imgEntry.height;
    const layout = computeImageLayout(ar);
    if (layout.mode === "ultrawide") {
      bottomLimit = Math.min(bottomLimit, layout.img.y - pad);
    } else if (layout.mode === "landscape" && layout.deW > layout.enW) {
      // DE is full width but image is in bottom-right — DE must stay above image
      deBottomLimit = layout.img.y;
    }
  }

  const baseFs = SLIDE_STYLE.question.fontSize;
  const baseLs = SLIDE_STYLE.question.lineSpacing;
  const minLs = baseLs - 10;
  const { width: W } = SLIDE_STYLE;
  const fullW = W - 2 * pad;

  // Compact layout: if text is short, move landscape image below text for more space
  if (!forceFs && imgEntry && enEl) {
    const ar = imgEntry.width / imgEntry.height;
    const layout = computeImageLayout(ar);
    if (layout.mode === "landscape") {
      // Measure at full width with default font settings
      const fsPx = baseFs * PT_SCALE;
      deEl.style.fontSize = fsPx + "px";
      deEl.style.lineHeight = String(baseLs / 100);
      deEl.style.width = px(fullW);
      enEl.style.fontSize = fsPx + "px";
      enEl.style.lineHeight = String(baseLs / 100);
      enEl.style.width = px(fullW);

      const deH = deEl.scrollHeight / PX;
      const enH = enEl.scrollHeight / PX;

      if (deH + enH <= H * 0.4) {
        const enY = pad + deH + pad;
        enEl.style.top = Math.round(enY * PX) + "px";
        const textBottom = enY + enH + pad;
        const imgBoxW = fullW;
        const imgBoxH = (isAnswer ? 4.8 : H - pad) - textBottom;
        const { w: imgW, h: imgH } = fit(imgBoxW, imgBoxH, ar);
        const imgX = (W - imgW) / 2;
        const imgY = textBottom;

        // Update image element in DOM
        const imgEl = slideDiv.querySelector("img");
        if (imgEl) {
          imgEl.style.left = px(imgX);
          imgEl.style.top = px(imgY);
          imgEl.style.width = px(imgW);
          imgEl.style.height = px(imgH);
        }

        return {
          fontSize: baseFs, lineSpacing: baseLs, enY,
          deW: fullW, enW: fullW,
          imgLayout: { x: imgX, y: imgY, w: imgW, h: imgH },
        };
      }

      // Not compact — restore original widths
      deEl.style.width = px(layout.deW);
      enEl.style.width = px(layout.enW);
    }
  }

  // Minimum gap between DE bottom and EN top (in inches) — accounts for
  // font metric differences between browser and PowerPoint/Impress
  const minGap = pad + 0.15;

  // Try a specific fontSize + lineSpacing, reposition EN, return result or null
  function tryFit(fs, ls) {
    const fsPx = fs * PT_SCALE;
    const lh = ls / 100;
    deEl.style.fontSize = fsPx + "px";
    deEl.style.lineHeight = String(lh);
    if (enEl) {
      enEl.style.fontSize = fsPx + "px";
      enEl.style.lineHeight = String(lh);
    }

    const deBottom = pad + deEl.scrollHeight / PX;

    // DE at full width must not extend below landscape image
    if (deBottomLimit && deBottom > deBottomLimit) return null;

    if (!enEl) {
      return deBottom <= bottomLimit ? { fontSize: fs, lineSpacing: ls, enY: 2.5 } : null;
    }

    // 1a: push EN down if DE overlaps default position
    let enY = Math.max(2.5, deBottom + minGap);
    enEl.style.top = Math.round(enY * PX) + "px";
    if (enY + enEl.scrollHeight / PX <= bottomLimit) {
      return { fontSize: fs, lineSpacing: ls, enY };
    }

    // 1b: try moving EN up (keep minGap from DE)
    enY = deBottom + minGap;
    enEl.style.top = Math.round(enY * PX) + "px";
    if (enY + enEl.scrollHeight / PX <= bottomLimit) {
      return { fontSize: fs, lineSpacing: ls, enY };
    }

    return null;
  }

  // Manual override: apply forced values, compute enY
  if (forceFs != null) {
    const result = tryFit(forceFs, forceLs);
    if (result) return result;
    // Doesn't fit — still apply and return best-effort enY
    tryFit(forceFs, forceLs);
    const enY = pad + deEl.scrollHeight / PX + pad;
    if (enEl) enEl.style.top = Math.round(enY * PX) + "px";
    return { fontSize: forceFs, lineSpacing: forceLs, enY };
  }

  // For each font size (half-point steps), binary-search the highest line spacing that fits
  for (const fs of [baseFs, baseFs - 0.5, baseFs - 1, baseFs - 1.5, baseFs - 2]) {
    let lo = minLs, hi = baseLs, best = null;
    while (lo <= hi) {
      const mid = Math.round((lo + hi) / 2);
      const result = tryFit(fs, mid);
      if (result) {
        best = result;
        lo = mid + 1; // try higher spacing
      } else {
        hi = mid - 1;
      }
    }
    if (best) return best;
  }

  // Give up — apply smallest settings, return best effort
  const lastFs = Math.max(8, baseFs - 2);
  tryFit(lastFs, minLs);
  const enY = pad + deEl.scrollHeight / PX + pad;
  if (enEl) enEl.style.top = Math.round(enY * PX) + "px";
  return { fontSize: lastFs, lineSpacing: minLs, enY };
}
