# Audio Playback in Presentations

## How audio works in the generated PPTX

Audio files are embedded in the PPTX using pptxgenjs's `addMedia({ type: "audio" })`. After generation, we post-process the zip to fix several pptxgenjs limitations:

1. **`a:videoFile` → `a:audioFile`** — pptxgenjs incorrectly uses the video element type for audio
2. **Click-to-play timing** — we inject `<p:timing>` XML with `presetClass="mediacall"` and `nodeType="clickEffect"` so pressing space/clicking advances to play the audio
3. **Speaker icon** — the generic cover image is replaced with a visible 256×256 speaker icon
4. **MIME type** — `audio/mpeg` is normalized to `audio/mp3` so pptxgenjs saves the file with a `.mp3` extension
5. **Duration** — the actual audio duration (read via the browser Audio API on upload) is embedded in the timing XML

The post-processing code lives in `lib/pptx-audio-fix.js`.

## PowerPoint (Windows/Mac)

Works correctly:
- Audio does **not** autoplay when entering the slide
- Pressing **space** or **clicking** triggers playback
- The speaker icon is visible on the slide
- Audio stops when leaving the slide

This is the primary target for quiz night presentations.

## LibreOffice Impress

**Known limitation: audio always autoplays when entering a slide.**

This is a long-standing design issue in LibreOffice Impress (not a bug in our PPTX). The Impress slideshow engine treats all embedded media as "intrinsic animations" — the same category as animated GIFs. When a slide is shown, the engine unconditionally calls `startMedia()` on all media shapes, completely bypassing the PPTX timing/animation XML.

There is **no PPTX XML workaround** for this. The autoplay path in Impress's source code (`notifyIntrinsicAnimationsEnabled` → `implStartIntrinsicAnimation` → `startMedia`) runs independently of the animation timing tree.

Relevant LibreOffice bugs:
- [Bug 61422](https://bugs.documentfoundation.org/show_bug.cgi?id=61422) — "Integrate basic playback controls for audio/video when doing a slide show" (open since 2013)
- [Bug 132793](https://bugs.documentfoundation.org/show_bug.cgi?id=132793) — "Add control to play audio from slides"

### Manual workaround in LibreOffice Impress

If you must use LibreOffice Impress for the presentation, there is a manual workaround using the "Toggle Pause" animation effect. This fights the autoplay by immediately pausing the audio, then unpausing on click:

1. Open the PPTX in LibreOffice Impress (edit mode, not presentation)
2. Select the speaker icon / audio element on the slide
3. Open the **Animation** sidebar (View → Animation, or click the Animation panel)
4. Click **Add Effect** (the + button)
5. In the dialog, go to the **Misc Effects** tab
6. Select **"Toggle Pause"**
7. Set **Start** to **"With Previous"**
8. Click OK — this adds an animation that pauses the audio the instant the slide appears (counteracting the autoplay)
9. With the audio element still selected, click **Add Effect** again
10. Again select **"Toggle Pause"** from Misc Effects
11. This time set **Start** to **"On Click"**
12. Click OK — this adds a second animation that unpauses (plays) the audio when you click or press space

The result: audio is silenced on slide entry, then plays on the first click/space. You need to repeat this for every slide that has audio.

**Important:** This workaround uses LibreOffice's internal ODP animation model. The "Toggle Pause" effects may not survive if the file is re-saved as PPTX and reopened in PowerPoint. It's best applied as a final step before presenting in Impress.

## Google Slides

Google Slides **does not support embedded audio** in imported PPTX files. Audio is silently stripped on import. Google Slides only supports audio linked from Google Drive (inserted via Insert → Audio). This is a Google Slides limitation with no workaround.
