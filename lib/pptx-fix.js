/**
 * Post-process a PPTX arraybuffer:
 *  - Fix pptxgenjs's audio-as-video workaround (a:videoFile → a:audioFile, speaker icon cover)
 *  - Emit per-slide <p:timing> composing click-triggered steps for audio playback and/or
 *    answer fade-in (click-to-reveal entrance on text shapes named "reveal-answer").
 *
 * A slide may have audio, reveal, both, or neither. Each triggered effect consumes one click.
 * Reveal is ordered first so the answer appears before the audio plays.
 *
 * Uses fflate instead of JSZip for dramatically faster ZIP processing.
 */

let speakerIconPromise = null;
function loadSpeakerIcon() {
  if (!speakerIconPromise) {
    speakerIconPromise = fetch(new URL("./speaker-icon.png", import.meta.url))
      .then((r) => r.arrayBuffer())
      .then((buf) => new Uint8Array(buf));
  }
  return speakerIconPromise;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Wrap a click effect body (the inner presetClass=... <p:cTn>) with the outer two par/cTn levels that PowerPoint expects. */
function wrapClickStep(outerId, middleId, innerXml) {
  return (
    `<p:par><p:cTn id="${outerId}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
    `<p:par><p:cTn id="${middleId}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    innerXml +
    `</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>`
  );
}

/** Click-triggered audio playback (matches the format PowerPoint writes). */
function audioStep(ids, spid, dur) {
  const inner =
    `<p:par><p:cTn id="${ids.click}" presetClass="mediacall" fill="hold" nodeType="clickEffect">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="${ids.cmd}" dur="${dur}" fill="hold"/>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:cmd>` +
    `</p:childTnLst></p:cTn></p:par>`;
  return wrapClickStep(ids.outer, ids.middle, inner);
}

/** Click-triggered fade-in entrance (presetID=10 = Fade). 300ms opacity 0→1. */
function revealStep(ids, spid) {
  const inner =
    `<p:par><p:cTn id="${ids.click}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect">` +
    `<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
    `<p:set><p:cBhvr>` +
    `<p:cTn id="${ids.set}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst>` +
    `</p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
    `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base">` +
    `<p:cTn id="${ids.anim}" dur="300" fill="hold"/>` +
    `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>` +
    `<p:attrNameLst><p:attrName>style.opacity</p:attrName></p:attrNameLst>` +
    `</p:cBhvr><p:tavLst>` +
    `<p:tav tm="0"><p:val><p:fltVal val="0"/></p:val></p:tav>` +
    `<p:tav tm="100000"><p:val><p:fltVal val="1"/></p:val></p:tav>` +
    `</p:tavLst></p:anim>` +
    `</p:childTnLst></p:cTn></p:par>`;
  return wrapClickStep(ids.outer, ids.middle, inner);
}

function buildTiming(steps) {
  let nextId = 3; // 1 = tmRoot, 2 = mainSeq
  const body = steps
    .map((step) => {
      if (step.type === "audio") {
        const ids = { outer: nextId++, middle: nextId++, click: nextId++, cmd: nextId++ };
        return audioStep(ids, step.spid, step.dur);
      }
      if (step.type === "reveal") {
        const ids = { outer: nextId++, middle: nextId++, click: nextId++, set: nextId++, anim: nextId++ };
        return revealStep(ids, step.spid);
      }
      return "";
    })
    .join("");

  return (
    `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
    `<p:seq><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
    body +
    `</p:childTnLst></p:cTn>` +
    `<p:prevCondLst><p:cond evt="onPrev"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
    `<p:nextCondLst><p:cond evt="onNext"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
    `</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>`
  );
}

/**
 * @param {ArrayBuffer} arrayBuffer - PPTX as arraybuffer
 * @param {object} [opts]
 * @param {Record<string,string>} [opts.audioDurations] - slideNumber (string) → duration ms (string)
 * @param {Set<string>} [opts.audioSlideNumbers] - slide numbers (as strings) that contain audio.
 *   When provided, only those slides get the audio rename treatment — videos (which also use a:videoFile) are left alone.
 *   When null/undefined, falls back to xml heuristic (legacy behavior).
 * @param {Set<number>} [opts.revealSlides] - 1-based slide numbers that should fade-in the answer on click
 */
export async function postProcessPptx(arrayBuffer, { audioDurations = {}, audioSlideNumbers = null, revealSlides = new Set() } = {}) {
  const [fflate, speakerIcon] = await Promise.all([
    import("https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js"),
    loadSpeakerIcon(),
  ]);

  const files = fflate.unzipSync(new Uint8Array(arrayBuffer));

  const slideRe = /^ppt\/slides\/slide(\d+)\.xml$/;
  for (const path of Object.keys(files)) {
    const m = path.match(slideRe);
    if (!m) continue;
    const slideNum = Number(m[1]);
    let xml = dec.decode(files[path]);

    const hasAudio = audioSlideNumbers
      ? audioSlideNumbers.has(String(slideNum))
      : (xml.includes("a:videoFile") && xml.includes("ppaction://media"));
    const wantReveal = revealSlides.has(slideNum);
    if (!hasAudio && !wantReveal) continue;

    const steps = [];

    if (hasAudio) {
      xml = xml.replace(/<a:videoFile /g, "<a:audioFile ");

      const relsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
      const relsData = files[relsPath];
      if (relsData) {
        const relsXml = dec.decode(relsData);
        const blipMatch = xml.match(/<p:blipFill><a:blip r:embed="(rId\d+)"/);
        if (blipMatch) {
          const imgTarget = relsXml.match(new RegExp(`Id="${blipMatch[1]}"[^>]*Target="([^"]+)"`));
          if (imgTarget) {
            files[`ppt/media/${imgTarget[1].split("/").pop()}`] = speakerIcon;
          }
        }
      }

      const spidMatch = xml.match(/<p:cNvPr id="(\d+)" name="Media/);
      if (spidMatch) {
        steps.push({ type: "audio", spid: spidMatch[1], dur: audioDurations[String(slideNum)] || "1" });
      }
    }

    let revealSpid = null;
    if (wantReveal) {
      const match = xml.match(/<p:cNvPr id="(\d+)" name="reveal-answer"/);
      if (match) {
        revealSpid = match[1];
        steps.unshift({ type: "reveal", spid: revealSpid });
      }
    }

    if (!steps.length) continue;

    if (!xml.includes("<p:timing")) {
      const timing = buildTiming(steps);
      const bldLst = revealSpid ? `<p:bldLst><p:bldP spid="${revealSpid}" grpId="0"/></p:bldLst>` : "";
      xml = xml.replace("</p:sld>", timing + bldLst + "</p:sld>");
    }

    files[path] = enc.encode(xml);
  }

  const zipped = fflate.zipSync(files, { level: 0 });
  return new Blob([zipped], { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}
