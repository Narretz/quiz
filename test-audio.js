import PptxGenJS from "pptxgenjs";
import fs from "fs";
import JSZip from "jszip";

const mp3 = fs.readFileSync("band-aid.mp3");
const b64 = `audio/mp3;base64,${mp3.toString("base64")}`;

const pptx = new PptxGenJS();
pptx.layout = "LAYOUT_16x9";

pptx.addSlide();
const slide = pptx.addSlide();
slide.addText("Audio Test", {
  x: 0, y: 0, w: "100%", h: "50%",
  fontSize: 40, bold: true, align: "center", valign: "middle",
});

slide.addMedia({
  type: "audio",
  data: b64,
  x: 4.25, y: 3, w: 1.5, h: 1.5,
});

// Generate and post-process
const buf = await pptx.write({ outputType: "nodebuffer" });
const zip = await JSZip.loadAsync(buf);

const slideFiles = Object.keys(zip.files).filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f));

for (const slideFile of slideFiles) {
  let xml = await zip.file(slideFile).async("string");
  if (!xml.includes("a:videoFile") || !xml.includes("ppaction://media")) continue;

  // Fix: videoFile → audioFile
  xml = xml.replace(/<a:videoFile /g, "<a:audioFile ");

  // Extract spid
  const spidMatch = xml.match(/<p:cNvPr id="(\d+)" name="Media/);
  if (!spidMatch) continue;
  const spid = spidMatch[1];
  const dur = "30171"; // hardcoded for test — browser version reads actual duration

  // Add click-to-play timing
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

    xml = xml.replace('</p:sld>', timing + '</p:sld>');
  }

  zip.file(slideFile, xml);
}

const fixed = await zip.generateAsync({ type: "nodebuffer" });
fs.writeFileSync("test-audio-simple.pptx", fixed);
console.log("wrote test-audio-simple.pptx (post-processed)");
