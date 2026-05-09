// Generate a PPTX showing every variation of the "special" (non-question) slides:
// welcome, rules, format, golden-rules, begin (single + multi-group), with/without
// images, with/without email. Run: `node gen-special-slides.js`. Output:
// special-slides.pptx in the repo root.

import { readFileSync, writeFileSync } from "node:fs";
import PptxGenJS from "pptxgenjs";
import { buildPptx } from "./quiz-core.js";
import { INTRO_SLIDES, EXTRA_SLIDES } from "./lib/intro-slides.js";

// --- minimal image-dimension reader for the formats we use ---
function imageDims(file, buf) {
  if (file.endsWith(".png")) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) return null;
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return null;
  }
  if (file.endsWith(".webp")) {
    const tag = buf.toString("ascii", 12, 16);
    if (tag === "VP8X") return { width: (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1, height: (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1 };
    if (tag === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    return null;
  }
  return null;
}

function loadImage(relPath) {
  const buf = readFileSync(relPath);
  const dims = imageDims(relPath, buf);
  const ext = relPath.split(".").pop().toLowerCase();
  const mime = ext === "jpg" ? "jpeg" : ext;
  return { data: `data:image/${mime};base64,${buf.toString("base64")}`, ...dims };
}

function loadAsset(relPath, mime) {
  const buf = readFileSync(relPath);
  return `image/${mime};base64,${buf.toString("base64")}`;
}

const portrait = loadImage("tests/files/image-portrait.jpg");
const landscape = loadImage("tests/files/image-landscape.webp");

const introAssets = {
  logo: loadAsset("lib/assets/tipperary-logo.gif", "gif"),
  toucan: loadAsset("lib/assets/pub-quiz-toucan.jpg", "jpeg"),
};

const tpl = (id) => INTRO_SLIDES.find((s) => s.id === id);
const ex = (id) => EXTRA_SLIDES[id];

// Each variation gets a unique descriptor id so we can put different images on it.
// type: "intro" + data: <template> + id: <unique key for image lookup>.
const variations = [
  // --- welcome (only one form; no media) ---
  { label: "welcome",                  data: tpl("welcome"),       id: "v-welcome" },

  // --- rules style: intro-1 (no image support in UI) ---
  { label: "rules (intro-1)",          data: tpl("rules"),         id: "v-rules" },

  // --- format style (rules with bullet+wrap) ---
  { label: "format (intro-2)",         data: tpl("format"),        id: "v-format" },

  // --- golden-rules: rules+compactWhenImage+lineValign+reveal=image ---
  { label: "golden-rules no image",    data: tpl("golden-rules"),  id: "v-gr-noimg" },
  { label: "golden-rules + 1 image",   data: tpl("golden-rules"),  id: "v-gr-img1",  imgs: [portrait] },
  { label: "golden-rules + 2 images",  data: tpl("golden-rules"),  id: "v-gr-img2",  imgs: [portrait, landscape] },

  // --- begin: intro-4 (single group: lines merged) ---
  { label: "begin no image",           data: tpl("begin"),         id: "v-begin-noimg" },
  { label: "begin + 1 image",          data: tpl("begin"),         id: "v-begin-img1", imgs: [landscape] },
  { label: "begin + 2 images",         data: tpl("begin"),         id: "v-begin-img2", imgs: [portrait, landscape] },

  // --- begin multi-group (marginTop creates groups) ---
  { label: "points (multi-group) no image", data: ex("points"),    id: "v-points-noimg" },
  { label: "points + image",                data: ex("points"),    id: "v-points-img",   imgs: [landscape] },
  { label: "break-2 (long body) no image",  data: ex("break-2"),   id: "v-break2-noimg" },
  { label: "break-2 + image",               data: ex("break-2"),   id: "v-break2-img",   imgs: [portrait] },

  // --- begin single-line ---
  { label: "no-phones no image",       data: ex("no-phones"),      id: "v-np-noimg" },
  { label: "no-phones + image",        data: ex("no-phones"),      id: "v-np-img",   imgs: [landscape] },

  // --- rules style without compactWhenImage: prizes ---
  { label: "prizes no image",          data: ex("prizes"),         id: "v-prizes-noimg" },
  { label: "prizes + image",           data: ex("prizes"),         id: "v-prizes-img",  imgs: [portrait] },
  { label: "prizes + 2 images",        data: ex("prizes"),         id: "v-prizes-img2", imgs: [portrait, landscape] },

  // --- goodbye: rules style with showIf email ---
  { label: "goodbye no image, no email",  data: ex("goodbye"),     id: "v-gb-noemail" },
  { label: "goodbye no image, email",     data: ex("goodbye"),     id: "v-gb-email" },
  { label: "goodbye + image, email",      data: ex("goodbye"),     id: "v-gb-emailimg", imgs: [landscape] },
];

// Insert a small "label" title slide before each variation so the PPTX is browsable.
const descriptors = [];
const images = {};
for (const v of variations) {
  descriptors.push({
    type: "title",
    text: { de: v.label, en: "" },
    subtitle: null,
    id: `lbl-${v.id}`,
  });
  descriptors.push({ type: "intro", data: v.data, id: v.id });
  if (v.imgs) {
    images[`${v.id}:0`] = v.imgs[0];
    if (v.imgs[1]) images[`${v.id}:0:1`] = v.imgs[1];
  }
}

const pptx = buildPptx(descriptors, PptxGenJS, images, {}, {}, introAssets, {}, {
  jackpotSize: 250,
  email: "quiz@example.com",
});

const outPath = "special-slides.pptx";
await pptx.writeFile({ fileName: outPath });
console.log(`Wrote ${outPath} with ${descriptors.length} slides (${variations.length} variations + ${variations.length} labels).`);
