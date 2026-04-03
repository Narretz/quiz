# Quiz XLSX to PPTX

Browser-based tool that parses quiz XLSX files and generates PPTX presentations with bilingual (German/English) questions, answers, images, and audio. No build step -- runs directly in the browser via import maps.

## Critical Rule: Preview and PPTX Must Match

**Every visual feature must be implemented in BOTH the browser preview AND the PPTX generator, and the output must be identical as far as possible.** The preview is the user's WYSIWYG editor; the PPTX is the deliverable. If you add, change, or fix anything visual (text layout, image positioning, font sizes, colors, spacing), you must update both:

1. The **Preact component** (in `components/`) that renders the preview
2. The **`buildPptx()` function** (in `quiz-core.js`) that generates the PPTX

Dimensions, positions, font sizes, colors, and layout logic must use the same constants from `SLIDE_STYLE`. The preview uses `PT_SCALE` and `PX` (from `lib/utils.js`) to convert inches/points to preview pixels. The PPTX uses inches/points directly.

## Tech Stack

- **Preact + HTM + @preact/signals** -- UI framework, loaded from CDN via import map (no JSX, no build)
- **pptxgenjs** -- PPTX generation (loaded from CDN as global `PptxGenJS`)
- **officeparser** -- XLSX parsing (loaded from CDN as global `officeParser`)
- **JSZip** -- PPTX post-processing for audio (loaded on demand in `lib/pptx-audio-fix.js`)
- **IndexedDB** -- persistence via `idb-keyval` (wrapped in `lib/db.js`)

## Architecture

```
index.html          -- Mount point, import map, CDN scripts, links style.css
app.js              -- Root Preact component, mounts to #app
quiz-core.js        -- Shared logic: SLIDE_STYLE, astToQuiz, buildSlideDescriptors, buildPptx, computeImageLayout, fit
lib/
  state.js          -- All signals, persistence (IndexedDB), upload/load/save/download
  db.js             -- IndexedDB wrapper (dbPut, dbGet, dbDelete, dbList)
  utils.js          -- PT_SCALE, PX, px(), readFileAsDataURL, loadImageDimensions, slugify
  fitting.js        -- Text fitting algorithm (binary search font size + line spacing)
  intro-slides.js   -- Intro slide templates (welcome, rules, format, golden-rules, begin)
  pptx-audio-fix.js -- Post-processes PPTX to fix audio playback (videoFile -> audioFile, click-to-play timing)
  assets/           -- Static images (tipperary-logo.gif, pub-quiz-toucan.jpg)
components/
  slide-preview.js  -- Section structure, slide dispatch, buildSections()
  question-slide.js -- Question/answer slides with text fitting and image layout
  title-slide.js    -- Round titles, answer dividers, break slides (with image linking)
  intro-slide.js    -- 5 intro slide variants (welcome, rules, format, golden-rules, begin)
  description-slide.js -- Round description slides (DE + EN text)
  image-actions.js  -- Hover overlay: +img, +audio, remove, unlink/relink buttons
  controls.js       -- Status display and download button
  style-controls.js -- Debug-only font size / line spacing / background color controls
  saved-quiz-bar.js -- Saved quiz list with load/delete
  toc.js            -- Table of contents with anchor navigation
style.css           -- All styles
```

## Key Concepts

### Slide Descriptors

On XLSX upload, `buildSlideDescriptors(quiz)` generates a flat array of descriptor objects. These are persisted in IndexedDB as a snapshot -- they are NOT regenerated on reload. This means the quiz is frozen at upload time. Old saves without stored descriptors fall back to regeneration.

Every descriptor has a stable `id` used for media lookup:

| Slide Type | ID Format | Example |
|---|---|---|
| Intro | `intro-{index}` | `intro-0` .. `intro-4` |
| Round title (questions) | `title-r{n}` | `title-r0` |
| Round title (answers) | `title-r{n}-ans` | `title-r0-ans` |
| Description | `desc-r{n}` | `desc-r0` |
| Question | `r{n}q{i}` | `r0q0` |
| Answer divider | `antworten-s{n}` | `antworten-s0` |
| Break | `pause-s{n}` | `pause-s0` |

### Media Keys

Images and audio are stored in `slideImages` and `slideAudio` signals as `Record<string, data>`. Keys use the format `"${id}:${variant}"`:

- Questions: `"r0q0:0"` (question), `"r0q0:1"` (answer)
- All other slides: `"title-r0:0"`, `"intro-3:0"`, etc. (always `:0`)

### Image Linking

Images are linked between paired slides:
- **Question -> Answer**: Adding an image to the question slide (`r0q0:0`) auto-copies to the answer slide (`r0q0:1`). The answer can unlink/relink independently.
- **Round title -> Answer title**: Adding an image to `title-r0:0` auto-copies to `title-r0-ans:0`. Same unlink/relink behavior.

The `isSource` flag in `image-actions.js` controls which side pushes images. Only the source side triggers auto-copy.

### Image Layout (Question Slides)

`computeImageLayout(aspectRatio)` returns positioning based on aspect ratio:
- **Portrait** (< 1): Image on right 30%, text narrowed
- **Landscape** (1-2): Image in bottom-right, DE text full width, EN text narrowed
- **Ultrawide** (> 2): Image at bottom full width, all text full width but height-limited

**Short-text optimization**: When text is short enough (< 40% of slide height) and the image is landscape, `fitSlideText()` in `lib/fitting.js` moves the image below the text instead of bottom-right, giving it more space. The computed position is stored in `override.imgLayout` and read by `buildPptx()`.

### Text Fitting (Question Slides)

`fitSlideText()` in `lib/fitting.js` uses binary search to find the largest font size and line spacing that fit without overflow. Steps: half-point font sizes (20, 19.5, 19, 18.5, 18), and for each, binary search line spacing from 100% to 110%. The EN text block is repositioned below DE text.

### Title / Intro Slides with Images

Title slides and intro slides (golden-rules, begin) always place text at the top and contain-fit the image to the remaining space below. This is **separate from** the question slide image layout -- it does not use `computeImageLayout()` or `fitSlideText()`. Both sides share a single helper:

- **Preview**: `layoutImageBelowText(textEl, imgEl, imgEntry)` in `lib/utils.js` -- measures text height via DOM, positions image below. Used by `title-slide.js` and `intro-slide.js` (golden-rules, begin) in their `useLayoutEffect`.
- **PPTX**: `addImageBelowText(slide, entry, textBottom)` in `quiz-core.js` -- contain-fits image to space below a given Y coordinate. Used by `buildPptx()` (title slides) and `renderIntroSlide()` (golden-rules, begin).

### Audio

Audio files are embedded per-slide. pptxgenjs embeds audio as video, so `lib/pptx-audio-fix.js` post-processes the PPTX ZIP to:
1. Rename `a:videoFile` to `a:audioFile`
2. Add click-to-play timing XML (`p:timing` with `clickEffect`)
3. Set correct duration per slide

Audio works correctly in PowerPoint. LibreOffice Impress has known issues (autoplay) that cannot be fixed.

### Intro Slides

Defined in `lib/intro-slides.js` as templates with precise positioning (in inches). Snapshotted into descriptors on upload. The first 3 intro slides (welcome, rules, format) have `id: null` passed to them in `slide-preview.js`, disabling media support. Slides 4-5 (golden-rules, begin) support images.

### Debug Mode

Append `?debug=true` to the URL to show font size/line spacing/background color controls and per-slide override inputs.

## SLIDE_STYLE

Single source of truth for all dimensions (in `quiz-core.js`):

```js
{
  width: 10,        // inches (16:9)
  height: 5.625,    // inches
  pad: 0.2,         // gap between elements
  backgroundColor: "#FFFFFF",
  textColor: "#000000",
  title:    { fontSize: 40 },
  num:      { fontSize: 23 },
  question: { fontSize: 20, lineSpacing: 110 },
  answer:   { fontSize: 20, color: '#FFF', backgroundColor: '#CC0000' },
}
```

Preview scaling: `PT_SCALE = 576 / (10 * 72)` for pt->px, `PX = 576 / 10` for inches->px.

## Conventions

- No build step. All imports via browser ES modules + import map.
- Preact components use `htm` tagged templates (`html\`...\``), not JSX.
- Signals for state, not useState. Components touch `signal.value` to subscribe.
- CSS in `style.css`, not inline (except dynamic values like colors/positions).
- `scheduleSave()` after any state mutation that should persist.
- `onRerender()` callback after image/audio changes to force preview update.
