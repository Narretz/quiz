# Bilingual round titles (de/en)

Currently `desc.text` for title slides is a plain string. To support separate DE/EN:

- [ ] Change descriptor format: `text: { de, en }` instead of `text: "string"`
- [ ] Migration for old saved quizzes: normalize plain string to `{ de: str, en: "" }` on load
- [ ] Update `buildSlideDescriptors()` / `addTitle()` to emit `{ de, en }`
- [ ] Update `title-slide.js` preview to render both languages
- [ ] Update `buildPptx()` title slide rendering to handle `{ de, en }`
- [ ] Parsing: either split `round.name` by `⬧` separator or let EN be added manually via editing
