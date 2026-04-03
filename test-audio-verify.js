import JSZip from "jszip";
import fs from "fs";

const file = process.argv[2] || "test-audio-simple.pptx";
const buf = fs.readFileSync(file);
const zip = await JSZip.loadAsync(buf);

const slideFiles = Object.keys(zip.files)
  .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
  .sort();

let pass = 0, fail = 0;
function check(label, ok) {
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
}

for (const slideFile of slideFiles) {
  const xml = await zip.file(slideFile).async("string");
  if (!xml.includes("ppaction://media")) continue;

  const num = slideFile.match(/slide(\d+)/)[1];
  console.log(`\nSlide ${num}:`);

  check("uses a:audioFile (not a:videoFile)", xml.includes("a:audioFile") && !xml.includes("a:videoFile"));
  check("has p:timing element", xml.includes("<p:timing"));
  check("has mediacall presetClass", xml.includes('presetClass="mediacall"'));
  check("has clickEffect nodeType", xml.includes('nodeType="clickEffect"'));
  check("has playFrom command", xml.includes('cmd="playFrom(0.0)"'));

  const durMatch = xml.match(/cmd="playFrom.*?dur="(\d+)"/);
  check(`duration is set (got: ${durMatch?.[1] || "missing"})`, durMatch && Number(durMatch[1]) > 0);

  // Check cover image
  const relsFile = `ppt/slides/_rels/slide${num}.xml.rels`;
  const relsXml = await zip.file(relsFile)?.async("string");
  const blipMatch = xml.match(/<p:blipFill><a:blip r:embed="(rId\d+)"/);
  if (blipMatch && relsXml) {
    const imgTarget = relsXml.match(new RegExp(`Id="${blipMatch[1]}"[^>]*Target="([^"]+)"`));
    if (imgTarget) {
      const imgPath = `ppt/media/${imgTarget[1].split("/").pop()}`;
      const imgEntry = zip.file(imgPath);
      const imgBuf = imgEntry ? await imgEntry.async("arraybuffer") : null;
      check(`cover image exists (${imgPath})`, !!imgBuf);
      check(`cover image is speaker icon (16169 bytes)`, imgBuf?.byteLength === 16169);
    }
  }

  // Check media file extension
  const mediaMatch = relsXml?.match(/Type=".*\/audio"[^>]*Target="([^"]+)"/);
  if (mediaMatch) {
    check(`audio file has .mp3 extension (${mediaMatch[1]})`, mediaMatch[1].endsWith(".mp3"));
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
