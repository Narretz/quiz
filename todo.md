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