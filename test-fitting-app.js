import { h, render } from "preact";
import { useRef, useLayoutEffect } from "preact/hooks";
import { signal, effect } from "@preact/signals";
import htm from "htm";
import { SLIDE_STYLE, computeImageLayout, formatAnswer, buildPptx, fit } from "./quiz-core.js";
import { PT_SCALE, PX, px, setPreviewWidth } from "./lib/utils.js";
import { fitSlideText } from "./lib/fitting.js";

const html = htm.bind(h);

const deText = signal("28.11. Im vergangenen Monat wurde bekannt, dass die Lieblingsburgerkette von Barack Obama vor der Insolvenz steht. Am Freitag schloss dann die erste Filiale von Five Guys. Besser läuft es für eine Berliner Kultmarke, die vom Szene-Imbiss zum ernstzunehmenden Player wurde. Mit einem durchschnittlichen Umsatz von 3,25 Millionen Euro pro Standort setzt sich die Marke damit hinter McDonald’s auf Platz 2 der umsatzstärksten Standorte in der deutschen Systemgastronomie. Welche Kette suche ich?");
const enText = signal("28.11. Last month, it was announced that Barack Obama’s favorite burger chain was facing bankruptcy. On Friday, the first Five Guys branch closed. Things are going better for a cult Berlin brand that has gone from being a trendy snack bar to a serious player. With average sales of €3.25 million per location, the brand ranks second behind McDonald’s in terms of the highest-grossing locations in the German restaurant chain industry. Which chain am I looking for?");
const answerDe = signal("Burgermeister");
const answerEn = signal("");
const showAnswers = signal(true);
const fittingEnabled = signal(true);
const logLines = signal([]);
const slideNum = signal(1);
const lastFitResult = signal(null);
const previewScale = signal(1);
const slideWidth = signal(576);
const imageAR = signal(0);

const IMAGE_PRESETS = [
  { label: "No image", ar: 0 },
  { label: "Portrait (2:3)", ar: 2/3 },
  { label: "Portrait (3:4)", ar: 3/4 },
  { label: "Square (1:1)", ar: 1 },
  { label: "Landscape (3:2)", ar: 3/2 },
  { label: "Ultrawide (3:1)", ar: 3 },
];

function log(msg) {
  logLines.value = [...logLines.value, msg];
}

function clearLog() {
  logLines.value = [];
}

function TestSlide() {
  const sw = slideWidth.value;
  setPreviewWidth(sw);

  const { pad } = SLIDE_STYLE;
  const fullW = SLIDE_STYLE.width - 2 * pad;
  const qFs = SLIDE_STYLE.question.fontSize * PT_SCALE;
  const qLh = SLIDE_STYLE.question.lineSpacing / 100;
  const numFs = SLIDE_STYLE.num.fontSize * PT_SCALE;
  const ansFs = SLIDE_STYLE.answer.fontSize * PT_SCALE;
  const bg = SLIDE_STYLE.backgroundColor;
  const fg = SLIDE_STYLE.textColor;
  const num = slideNum.value;
  const withAnswers = showAnswers.value;
  const de = deText.value;
  const en = enText.value;
  const ansDe = answerDe.value;
  const ansEn = answerEn.value;
  const fitting = fittingEnabled.value;
  const ar = imageAR.value;

  let deW = fullW, enW = fullW;
  let imgStyle = null;
  if (ar > 0) {
    const layout = computeImageLayout(ar);
    deW = layout.deW;
    enW = layout.enW;
    const { img } = layout;
    imgStyle = { position: "absolute", left: px(img.x), top: px(img.y), width: px(img.w), height: px(img.h) };
  }

  const slideImages = ar > 0 ? { "test:0": { data: "", width: ar * 100, height: 100 }, "test:1": { data: "", width: ar * 100, height: 100 } } : {};

  const slideRef = useRef(null);

  useLayoutEffect(() => {
    if (!slideRef.current) return;
    clearLog();
    const defaultEnY = 2.5;
    const { height: H } = SLIDE_STYLE;

    if (ar > 0) {
      const layout = computeImageLayout(ar);
      log(`Image: ${layout.mode} (AR=${ar.toFixed(2)}), deW=${layout.deW.toFixed(2)}, enW=${layout.enW.toFixed(2)}`);
    }

    let bottomLimit = H - pad;
    if (withAnswers) {
      const ansBar = slideRef.current.querySelector('.answer-bar:not(.answer-bar--ghost)');
      const answerH = ansBar ? ansBar.offsetHeight / PX : 0.7;
      bottomLimit = H - answerH - pad;
      log(`Answer bar: ${answerH.toFixed(3)}in → bottomLimit=${bottomLimit.toFixed(3)}in`);
    }
    log(`Base: ${SLIDE_STYLE.question.fontSize}pt / ${SLIDE_STYLE.question.lineSpacing}%, bottomLimit=${bottomLimit.toFixed(3)}in`);

    const deEl = slideRef.current.querySelector('[data-role="de"]');
    const enEl = slideRef.current.querySelector('[data-role="en"]');

    if (fitting) {
      const result = fitSlideText(slideRef.current, slideImages);
      lastFitResult.value = result;
      if (!result) { log("fitSlideText returned null"); return; }

      const changes = [];
      if (result.fontSize < SLIDE_STYLE.question.fontSize) changes.push(`font ${SLIDE_STYLE.question.fontSize} → ${result.fontSize}pt`);
      if (result.lineSpacing < SLIDE_STYLE.question.lineSpacing) changes.push(`spacing ${SLIDE_STYLE.question.lineSpacing} → ${result.lineSpacing}%`);
      if (Math.abs(result.enY - defaultEnY) > 0.01) changes.push(`EN pushed ${result.enY > defaultEnY ? "down" : "up"}: ${defaultEnY} → ${result.enY.toFixed(2)}in`);

      if (changes.length) {
        log(`Adjusted: ${changes.join(", ")}`);
      } else {
        log("No adjustments needed");
      }
    } else {
      lastFitResult.value = null;
      log("Fitting disabled");
      if (deEl) {
        deEl.style.fontSize = qFs + "px";
        deEl.style.lineHeight = String(qLh);
      }
      if (enEl) {
        enEl.style.fontSize = qFs + "px";
        enEl.style.lineHeight = String(qLh);
        enEl.style.top = Math.round(defaultEnY * PX) + "px";
      }
    }

    if (deEl && enEl) {
      const deBottom = pad + deEl.scrollHeight / PX;
      const enTop = parseFloat(enEl.style.top) / PX;
      const enBottom = enTop + enEl.scrollHeight / PX;
      const gap = enTop - deBottom;
      log(`DE: ${pad.toFixed(2)} → ${deBottom.toFixed(2)}in | EN: ${enTop.toFixed(2)} → ${enBottom.toFixed(2)}in`);
      log(`Gap: ${gap.toFixed(3)}in (${gap < 0.35 ? "tight" : "ok"})`);
      if (enBottom > bottomLimit) log(`⚠ EN extends ${(enBottom - bottomLimit).toFixed(3)}in below bottomLimit`);
      if (gap < 0) log("⚠ OVERLAP by " + (-gap).toFixed(3) + "in");
    }
  }, [de, en, ansDe, ansEn, withAnswers, num, fitting, sw, ar]);

  const filled = withAnswers && (ansDe || ansEn);
  const ansBarCls = `answer-bar${filled ? ' answer-bar--filled' : ''}`;
  const effectiveEn = ansEn && ansEn !== ansDe ? ansEn : "";

  return html`
    <div class="slide" ref=${slideRef} style="background-color:${bg};color:${fg};width:${sw}px;height:${Math.round(sw * SLIDE_STYLE.height / SLIDE_STYLE.width)}px"
         data-slide-id="test" data-answers=${withAnswers ? "1" : "0"}>
      ${de && html`
        <div data-role="de" style="position:absolute;left:${px(pad)};top:${px(pad)};width:${px(deW)};font-size:${qFs}px;line-height:${qLh}">
          <span style="font-size:${numFs}px;font-weight:bold">${num}</span>${" "}${de}
        </div>
      `}
      ${en && html`
        <div data-role="en" style="position:absolute;left:${px(pad)};top:${px(2.5)};width:${px(enW)};font-size:${qFs}px;line-height:${qLh}">
          <span style="font-size:${numFs}px;font-weight:bold">${num}</span>${" "}${en}
        </div>
      `}
      ${imgStyle && html`
        <div class="slide-img-wrap" style=${imgStyle}>
          <div style="width:100%;height:100%;background:rgba(128,128,255,0.3);border:2px dashed rgba(128,128,255,0.6);display:flex;align-items:center;justify-content:center;font-size:12px;color:rgba(128,128,255,0.8)">
            Image (${ar.toFixed(2)})
          </div>
        </div>
      `}
      ${withAnswers && html`
        <div class=${ansBarCls}
             style="font-size:${ansFs}px;background:${SLIDE_STYLE.answer.backgroundColor};color:${SLIDE_STYLE.answer.color}">
          <span class="answer-bar__tag answer-bar__tag--de">de</span>
          <span class="answer-bar__field answer-bar__field--de">${ansDe}</span>
          <span class="answer-bar__sep">\u2B27</span>
          <span class="answer-bar__field answer-bar__field--en">${effectiveEn}</span>
          <span class="answer-bar__tag answer-bar__tag--en">en</span>
        </div>
      `}
      ${withAnswers && html`
        <svg style="position:absolute;top:0;left:0;z-index:1" width="30" height="30" viewBox="0 0 30 30">
          <polygon points="0,0 27,0 0,27" fill=${SLIDE_STYLE.answer.backgroundColor} />
          <text x="4" y="12" fill=${SLIDE_STYLE.answer.color} font-size="10" font-weight="bold">A</text>
        </svg>
      `}
    </div>
  `;
}

async function exportSlide() {
  const de = deText.value;
  const en = enText.value;
  const ansDe = answerDe.value;
  const ansEn = answerEn.value;
  const withAnswers = showAnswers.value;
  const num = slideNum.value;

  const questions = {
    test: {
      text: { de, en },
      answers: { de: ansDe, en: ansEn || ansDe },
    },
  };

  const descriptors = [
    { type: "question", id: "test", num, withAnswers },
  ];

  const overrides = {};
  const fit = lastFitResult.value;
  if (fit) {
    const key = `test:${withAnswers ? 1 : 0}`;
    overrides[key] = fit;
    log(`Export with overrides: ${fit.fontSize}pt / ${fit.lineSpacing}% / enY=${fit.enY.toFixed(2)}`);
  } else {
    log("Export with defaults (no fitting)");
  }
  const ar = imageAR.value;
  const images = ar > 0 ? { [`test:${withAnswers ? 1 : 0}`]: { data: "", width: ar * 100, height: 100 } } : {};
  const pptx = buildPptx(descriptors, PptxGenJS, images, overrides, {}, {}, questions);
  await pptx.writeFile({ fileName: "test-fitting.pptx" });
}

function App() {
  deText.value; enText.value; answerDe.value; answerEn.value; showAnswers.value; fittingEnabled.value; logLines.value; slideNum.value; slideWidth.value; previewScale.value; imageAR.value;

  return html`
    <h2>Text Fitting Test</h2>
    <div class="controls">
      <label>
        Question # <input type="number" min="1" max="99" value=${slideNum.value}
          onInput=${(e) => slideNum.value = Number(e.target.value)} />
      </label>
      <label>
        German text
        <textarea value=${deText.value} onInput=${(e) => deText.value = e.target.value} />
      </label>
      <label>
        English text
        <textarea value=${enText.value} onInput=${(e) => enText.value = e.target.value} />
      </label>
      <label>
        Answer DE
        <input type="text" value=${answerDe.value} onInput=${(e) => answerDe.value = e.target.value} />
      </label>
      <label>
        Answer EN
        <input type="text" value=${answerEn.value} onInput=${(e) => answerEn.value = e.target.value}
               placeholder="(defaults to DE)" />
      </label>
      <label>
        Image
        <select value=${imageAR.value} onChange=${(e) => imageAR.value = Number(e.target.value)}>
          ${IMAGE_PRESETS.map(p => html`<option value=${p.ar}>${p.label}</option>`)}
        </select>
      </label>
      <label>
        <input type="checkbox" checked=${showAnswers.value}
          onChange=${(e) => showAnswers.value = e.target.checked} /> Show as answer slide
      </label>
      <label>
        <input type="checkbox" checked=${fittingEnabled.value}
          onChange=${(e) => fittingEnabled.value = e.target.checked} /> Enable text fitting
      </label>
      <label>
        Slide width: ${slideWidth.value}px (PT_SCALE=${(slideWidth.value / (SLIDE_STYLE.width * 72)).toFixed(3)})
        <input type="range" min="400" max="960" step="10" value=${slideWidth.value}
          onInput=${(e) => slideWidth.value = Number(e.target.value)} />
      </label>
      <button onClick=${exportSlide}>Export single slide PPTX</button>
    </div>
    <div class="log">${logLines.value.join("\n")}</div>
    <div class="output">
      <h3>Preview (${Math.round(previewScale.value * 100)}%)</h3>
      <input type="range" min="0.5" max="2" step="0.1" value=${previewScale.value}
        onInput=${(e) => previewScale.value = Number(e.target.value)} style="width:576px" />
      <div style="transform:scale(${previewScale.value});transform-origin:top left">
        <${TestSlide} />
      </div>
    </div>
  `;
}

render(html`<${App} />`, document.getElementById("app"));

effect(() => {
  deText.value; enText.value; answerDe.value; answerEn.value; showAnswers.value; fittingEnabled.value; logLines.value; slideNum.value; slideWidth.value; previewScale.value; imageAR.value;
  render(html`<${App} />`, document.getElementById("app"));
});
