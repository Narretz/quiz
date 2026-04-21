# Feedback

- Frage-Nummer auch in den Englischen Block
- Lasst uns beginnen - Text unten
- Zwei Bilder
- Name Ten: Text drin lassen
- Jackpot-Antworten zeigen nach click

- Zwischenstand Folie ✅
- More bottom padding for answer block
- Bold formatting
- Feld für Jackpot-Summe
- Feld für Email-Adresse

# Bilingual round titles (de/en)

Currently `desc.text` for title slides is a plain string. To support separate DE/EN:

- [ ] Change descriptor format: `text: { de, en }` instead of `text: "string"`
- [ ] Migration for old saved quizzes: normalize plain string to `{ de: str, en: "" }` on load
- [ ] Update `buildSlideDescriptors()` / `addTitle()` to emit `{ de, en }`
- [ ] Update `title-slide.js` preview to render both languages
- [ ] Update `buildPptx()` title slide rendering to handle `{ de, en }`
- [ ] Parsing: either split `round.name` by `⬧` separator or let EN be added manually via editing


# Video: ✅

Video can reuse the image layout system directly. A video has width/height just like an image, so computeImageLayout(ar) and
computeTwoImageLayout() work as-is. A video could occupy one of the two image slots, with an image in the other — the side-by-side
layout handles it naturally.

Key design decisions:

1. Storage: Video as data URL in IndexedDB is problematic — a 30s 720p clip is 5-15 MB (base64 makes it ~20 MB), but browsers allow almost
2. unlimited storage in IndexedDB, so that should not be a problem. Still we should limit the video input file size to 30MB
2. Data model:
  - Add type field to slideImages entries: { data, width, height, type: "video", mimeType: "video/mp4", durationMs }. Video occupies an
image slot, all existing layout/linking works.

3. PPTX generation: pptxgenjs natively supports slide.addMedia({ type: "video", data, x, y, w, h }). The tricky part is
pptx-audio-fix.js — it currently converts all a:videoFile to a:audioFile. It would need to distinguish real videos from
audio-disguised-as-video (check MIME type in the relationship or file extension).
4. Audio vs video mutual exclusion: If they're mutually exclusive per slide, adding a video would remove existing audio and vice versa.
Simple enforcement in the UI.
5. Preview: SlideImage component just renders <video controls> instead of <img> when the entry type is "video". Minimal change.
6. Click order in PPTX: With video replacing audio, it's one click to play — no conflict. If you ever wanted both, you'd need two
clickEffect entries in the timing XML.

The positioning logic should also be used for audio files. That makes it easier for the user to see where
the audio icon will be, and audio/video use the same path for adding themselves.

Effort estimate: Medium. The layout reuse makes positioning free. The main work is the PPTX post-processing fix, the file size guard,
and persistence migration for old saves (entries without type default to "image").


MVP
- export with green background and white font color ✅
- add intro slides ✅
- rename bonus to jackpot ✅
- add description slide ✅
- add no phones slide before jackpot ✅
- remove answer slide from jackpot round ✅

answer editing:
- keep inline layout on hover ✅
- show language indicators directly after language (can display outside, doesn't matter) ✅

pptx:
- answer boxes still too big sometimes -> calculate exactly like text boxes? ✅
- Let us begin + Pause/Break + No phones text box is not centered aligned (impress only so not super important)
- cover image still stretched instead of contain ✅
- quiz rules -> first line bit too close to title ✅
- break text too close together ✅
- question 1.1 - text still overlaps ✅

feature parity for full quiz

- edit text
- switch between normal theme and edit theme
- special case name 10 ✅
- add/edit answer in slides ✅
- add images to intro/break slides ✅
- add last slide ✅
- add audio files to slides ✅

nice to have

- remove backwards compat for old storage structure
- editable jackpot value and display it in jackpot slide as well
- create quiz from scratch
- inspect codebase to check for reuse of fitting logic
- use quiz-name+round name hashes
- validate quiz: warn when no content, answer in question, text overlaps/is cut off
- strip question numbers from text
- undo/redo stack
- export quiz as JSON (same as indexedDB storage)
- put override inputs into a debug menu ✅