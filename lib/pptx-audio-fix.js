/**
 * Post-process a PPTX arraybuffer to fix audio elements.
 * pptxgenjs uses a:videoFile for audio — we patch it to a:audioFile,
 * add click-to-play timing XML, and replace the cover image with a speaker icon.
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

export async function fixAudioInPptx(arrayBuffer, audioDurations = {}, audioSlideNumbers = null) {
  const [JSZip, speakerIcon] = await Promise.all([
    import("https://esm.sh/jszip@3.10.1").then((m) => m.default),
    loadSpeakerIcon(),
  ]);
  const zip = await JSZip.loadAsync(arrayBuffer);

  const slideFiles = Object.keys(zip.files).filter(
    (f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)
  );

  for (const slideFile of slideFiles) {
    let xml = await zip.file(slideFile).async("string");

    const slideNum = slideFile.match(/slide(\d+)/)[1];
    // Only patch slides that contain audio (not real video)
    if (audioSlideNumbers) {
      if (!audioSlideNumbers.has(slideNum)) continue;
    } else {
      if (!xml.includes("a:videoFile") || !xml.includes("ppaction://media")) continue;
    }

    // Fix: a:videoFile → a:audioFile
    xml = xml.replace(/<a:videoFile /g, "<a:audioFile ");

    // Replace the cover image with the speaker icon
    const relsFile = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const relsXml = await zip.file(relsFile)?.async("string");
    if (relsXml) {
      const blipMatch = xml.match(/<p:blipFill><a:blip r:embed="(rId\d+)"/);
      if (blipMatch) {
        const imgRid = blipMatch[1];
        const imgTarget = relsXml.match(new RegExp(`Id="${imgRid}"[^>]*Target="([^"]+)"`));
        if (imgTarget) {
          const imgPath = `ppt/media/${imgTarget[1].split("/").pop()}`;
          zip.file(imgPath, speakerIcon);
        }
      }
    }

    // Extract spid from the audio pic element
    const spidMatch = xml.match(/<p:cNvPr id="(\d+)" name="Media/);
    if (!spidMatch) continue;
    const spid = spidMatch[1];
    const dur = audioDurations[slideNum] || "1";

    // Add click-to-play timing (matches working PowerPoint format)
    if (!xml.includes("<p:timing")) {
      const timing =
        '<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>' +
        '<p:seq><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>' +
        '<p:par><p:cTn id="3" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>' +
        '<p:par><p:cTn id="4" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        `<p:par><p:cTn id="5" presetClass="mediacall" fill="hold" nodeType="clickEffect">` +
        '<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>' +
        `<p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr><p:cTn id="6" dur="${dur}" fill="hold"/>` +
        `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl></p:cBhvr></p:cmd>` +
        '</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>' +
        '</p:childTnLst></p:cTn>' +
        '<p:prevCondLst><p:cond evt="onPrev"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>' +
        '<p:nextCondLst><p:cond evt="onNext"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>' +
        '</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>';

      xml = xml.replace("</p:sld>", timing + "</p:sld>");
    }

    zip.file(slideFile, xml);
  }

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}
