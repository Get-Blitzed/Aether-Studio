# Manual Test Script — Aether Studio Suite

A hands-on script for exercising the whole app end-to-end, including the
"try to break it" cases that automated tests don't cover. Organized so you
can run a whole session, or just the section for whatever you just
touched. Check items off as you go; anything that fails, note it with
enough detail to reproduce (what you clicked, what you expected, what
happened) — that's most of what a bug report needs.

Where relevant, a section calls out **known limitations** (see
KNOWN_LIMITATIONS.md) so you don't file a bug for something already
documented as out of scope — though if the *actual* behavior is worse than
what's documented there (e.g. a crash instead of a graceful message),
that's still worth flagging.

---

## 0. Before you start

- [ ] Fresh launch: `npm run dev` (or the installed `.exe`/`.dmg`). Confirm the Splash screen appears, plays the voice intro once ("Welcome to Aether Studio Suite...") in a male, slightly upbeat voice, and lands on Home/Onboarding without console errors.
- [ ] Note your OS's installed SAPI voice count (Windows: Settings > Time & Language > Speech) — the app should never claim more native voices exist than are actually installed.
- [ ] Have a few "hostile" test files ready (build these once, reuse across the script):
  - A PDF with 1 page and a PDF with 40+ pages
  - A DOCX with tables, bullet lists, and a mix of languages/emoji in the text
  - A PPTX with speaker notes only on some slides, and one completely blank slide
  - A 0-byte file renamed to `.pdf`
  - A `.txt` file renamed to `.pdf` (wrong magic bytes)
  - A very long filename (150+ characters) and a filename with emoji/Unicode (`测试プロジェクト🎬.pdf`)
  - A tiny (1 second) and a long (10+ minute) video/audio file

---

## 1. Project lifecycle — try to corrupt it

- [ ] Create a new blank production with a completely empty title (just spaces) — does it reject cleanly or crash?
- [ ] Create a production titled with reserved Windows characters: `CON`, `A/B:C*D?.txt`, trailing dots/spaces (`My Project...   `). Confirm the folder name comes out sanitized, not rejected outright.
- [ ] Open the A.I. Blitz sample, confirm Mission 001's script/character data loads correctly.
- [ ] Mid-edit (e.g. typing in Script Studio), **force-quit** the app (Task Manager / `kill -9`). Relaunch — does recovery/safe-mode detection kick in? Is data loss limited to the last few keystrokes, not the whole project?
- [ ] Manually edit `project.aether` in a text editor while the app is closed: delete a required field, or corrupt the JSON syntax entirely (stray `}`). Reopen the project — does it fail with a clear error, or silently produce a broken UI?
- [ ] Open the same project in two separate app instances at once, edit conflicting fields in each, save both. What wins? Is there any warning?
- [ ] Fill the disk (or simulate low disk space) and try to save — confirm a clear error rather than silent data loss.

## 2. Preproduction screens

- [ ] Series Planner: create a series with 0 episodes, then 50 episodes. Reorder episodes rapidly (drag/up-down) — check nothing duplicates or vanishes.
- [ ] Brand Studio: add a color palette with invalid hex values (`#ZZZZZZ`, `red`, empty string). Add 30+ approved/prohibited terms.
- [ ] Character Studio: toggle all 7 consistency locks on then off rapidly. Import a reference image that's actually a `.txt` file renamed to `.jpg`.
- [ ] Knowledge Library: add a source, mark it stale, then reference it from a script segment's citation — delete the source. Does the script segment still show a (now-broken) citation gracefully?
- [ ] Script Studio: paste in 10,000 words of narration into one segment. Confirm word count / duration math doesn't choke or freeze the UI. Try narration containing emoji, right-to-left script (Arabic/Hebrew), and literal `{{template}}`-looking text.
- [ ] Storyboard Studio: create 100 frames, switch between grid/list views, delete every other one.
- [ ] Prompt Workshop: build a prompt using every field, then clear them all one by one — confirm the assembled-text preview updates correctly each time, including going fully empty.

## 3. Media, Voice, Screen Capture

- [ ] Asset Library: import the 0-byte fake PDF, the wrong-magic-bytes file, and a genuinely huge (1GB+) video. Confirm each either imports with a sane fallback or fails with a clear message — not a silent hang.
- [ ] Import the same file twice — confirm duplicate detection (sha256) catches it.
- [ ] Rename/move an imported *linked* (not managed) asset's source file on disk, then reopen the project — confirm "missing file" detection and the Relink flow.
- [ ] Voice Studio: generate a take with an empty text box. Generate one with 5,000 words. Try rate/pitch sliders at both extremes. Merge 5+ takes at once.
- [ ] Screen Capture: start a recording, then immediately hit stop (sub-1-second recording). Start a recording and let it run 10+ minutes.

## 4. Timeline, Captions, Blur — the adversarial round

- [ ] Build a timeline with clips on every track type, including two clips on the same track that **overlap in time** — does the UI prevent it, or just render them stacked oddly?
- [ ] Set a clip's duration to 0, or negative (via the numeric inputs) — confirm it's rejected or clamped, not left in a broken state.
- [ ] Add 5+ overlapping **blur regions** on the same track, some covering the entire frame, one with 0-width/0-height, one positioned fully outside the frame (negative x/y or >100%). Render a final export and check the actual output video for each case.
- [ ] Undo/redo 20+ times rapidly across track/clip edits — confirm the stack doesn't desync from what's on screen.
- [ ] Caption Studio: import an SRT with malformed timestamps and overlapping captions. Export to VTT and re-import it — round-trip should be lossless for valid captions.
- [ ] Quick Preview Render with **zero** clips on the primary video track — confirm a clear error, not a crash.

## 5. AI Providers

- [ ] Add every provider kind (mock, openai-compatible, generic-rest, sapi-voice, elevenlabs) with garbage config (empty base URL, malformed request template). Confirm each fails gracefully on Test Connection.
- [ ] Toggle Settings > Offline Mode on, then try to run a job on every non-mock, non-sapi-voice provider — confirm all are blocked with a clear message, and mock/sapi-voice still work.
- [ ] Generate an AI outline requesting 0 scenes, then 20 scenes, in one Script Studio call.
- [ ] Voice Studio AI synthesis: pick a provider with zero available voices (or before any provider is configured) — confirm the panel degrades sensibly rather than throwing.

## 6. Document-to-video pipeline (Phase 8's centerpiece — push hard here)

- [ ] Convert the 40+ page PDF — check narration-per-page timing actually lines up with each slide's duration in the resulting timeline, not just "it produced *a* timeline."
- [ ] Convert the 0-byte fake PDF, and the wrong-magic-bytes file — confirm a clear extraction-failure error, not a hang or crash.
- [ ] Convert a PPTX with a completely blank slide (no text at all) — does that page get a silent slide with no narration, or does the whole conversion fail?
- [ ] Convert a document with non-Latin text (Japanese, Arabic, emoji) — check the rendered slide text and the narration audio both handle it (SAPI's read of non-English text may be poor quality — that's expected, but it shouldn't crash or produce silence).
- [ ] Convert with "Generate narration" unchecked — confirm you get a fully silent, word-count-timed video with no narration track.
- [ ] Drop in an already-video file (`.mp4`) through the Document Import screen — confirm it goes straight to the Asset Library, not through the document pipeline.
- [ ] Convert two documents back-to-back without closing the app — check temp files from the first conversion get cleaned up and don't leak into the second.

## 7. Review & Export

- [ ] Run the Quality-Control checklist on a production with zero content — every check should read a sane "not applicable"/fail state, not error.
- [ ] Export at every preset (1080p, 720p, vertical, square) against the same timeline — spot-check resolution/duration with a media inspector (or `ffprobe`) on at least one.
- [ ] Export a timeline whose clips reference an asset that's since been deleted from the Asset Library — confirm a clear error naming the missing asset.
- [ ] Create a Production Archive, then immediately create another — confirm the second doesn't nest the first archive inside itself.
- [ ] Cancel/kill the app mid-export — relaunch and confirm no orphaned partial render is silently registered as a real asset.

## 8. UI redesign — visual regression pass

- [ ] Resize the window very small and very large — confirm the new rounder/gradient elements (nav pills, circular badges, buttons) don't clip or overlap at either extreme.
- [ ] Toggle OS dark/light mode if applicable, and check the bright palette still reads correctly (contrast, not washed out).
- [ ] Confirm the new logo renders identically at small (sidebar) and large (Splash) sizes — no artifacting from the gradient at small scale.

## 9. Installers

- [ ] Windows: run `Aether-Studio-Suite-Setup.exe` on a machine that's never had the app installed. Confirm SmartScreen's "unknown publisher" warning is expected (unsigned build) and the install completes, creates Desktop/Start Menu shortcuts, and the app launches and finds the bundled A.I. Blitz sample.
- [ ] Uninstall, confirm it cleans up program files but (per typical NSIS behavior) leaves user data in `%APPDATA%` — check whether that's the intended behavior or should be called out to the user.
- [ ] macOS: mount the `.dmg`, drag to Applications, first launch — confirm Gatekeeper's "unidentified developer" warning is expected (unsigned) and right-click → Open bypasses it. Confirm ffmpeg-backed features (export, blur) work identically to Windows. Confirm Voice Studio's native tier correctly reports "unavailable" (no SAPI on Mac) rather than crashing.

## 10. The "just be mean to it" free-for-all

- [ ] Spam-click every primary button (Create, Export Now, Generate) 10x in under a second — confirm no duplicate jobs/assets/timelines get created from double-submission.
- [ ] Tab through every screen using only the keyboard (no mouse) — confirm nothing is unreachable.
- [ ] Leave the app idle and open for a few hours with autosave on, then check `project.aether`'s modified timestamp and backup rotation actually happened as configured.
- [ ] Try every screen with **zero data** (brand-new blank project) before adding anything — this is the state every real first-time user sees, and it's the easiest state to leave an edge case unhandled in.

---

*Found something? Note the exact repro steps, expected vs. actual, and whether the underlying function has an existing automated test (if not, that's a good candidate for a new one) — see TESTING.md for where tests live.*
