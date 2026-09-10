# Handoff: Extract `drone-synth.html` into its own package

Status: **implemented and verified locally (tickets 001–003 done, ticket 004's
local checks done). Only remaining step: push the branch, merge, and confirm
the live GH Pages deploy** — see `issues/004-verify-end-to-end-and-deploy.md`.

## Goal

Move `src/drone-synth.html` (STRATA drone synth, originally one 2151-line file:
inline `<style>` + a single inline `<script>` of plain JS, no imports) out of
the shared `src/` multi-page Vite project and into its own npm workspace
package, cleaning up the code along the way.

## Current state

- `drone-synth/` is now a top-level npm workspace package (sibling to `src/`,
  `dist/`), with its own `package.json`, `vite.config.js`, `tsconfig.json`.
  Root `package.json` has `"workspaces": ["drone-synth"]`.
- `drone-synth/drone-synth.html` has no more inline `<script>`/`<style>` —
  logic lives in typed TS modules under `drone-synth/src/` (`audio/engine.ts`,
  `audio/note-voice.ts`, `audio/voice.ts`, `audio/recorder.ts`, `constants.ts`,
  `export-settings.ts`, `fx-page.ts`, `global-knobs.ts`, `keyboard.ts`,
  `main.ts`, `midi.ts`, `persistence.ts`, `state.ts`, `style.css`, `types.ts`,
  `ui/knob.ts`, `utils/dsp.ts`, `voices.ts`). `tsc` passes with no errors.
- Root `build` script (`package.json`) now runs:
  `tsc && vite build && npm run build --workspace=drone-synth && cp -r drone-synth/dist/. dist/`
  — so `npm run build` at repo root produces `dist/drone-synth.html` at the
  same public path as before, alongside the other four pages
  (`index.html`, `original.html`, `two-lfos.html`, `ts-synth.html`), with no
  changes needed to `.github/workflows/gh-pages.yml`.
- An independent 8-agent review compared every new module against the
  pre-split monolith line-by-line and found **no behavior regressions** —
  this was a faithful structural port, not a rewrite.
- Verified locally: clean `npm ci && npm run build` succeeds, all five pages
  serve correctly under `vite preview` with correct `/claude-drone/` asset
  paths, and `git log --follow` confirms `drone-synth/drone-synth.html`'s
  history survived the ticket 001 `git mv`.
- Not yet done: the branch (`feat/stata-drone`) hasn't been pushed or merged
  to `main`, so the real GH Pages workflow hasn't run against this change and
  the live deploy at `https://amindunited.github.io/claude-drone/` /
  `.../drone-synth.html` is still unverified post-merge.

## Decisions made (for context on *why* things are structured this way)

- **Cleanup scope**: split the single file into separate HTML/CSS/TS files,
  converting the original plain inline JS into typed TypeScript modules — a
  structural port, not a behavior rewrite.
- **Module reuse**: deliberately did **not** depend on or extend
  `src/audio/`, `src/types/`, `src/utils/` — those back a different, simpler
  demo (`ts-synth.ts`, single-voice/single-LFO, no presets/MIDI/chorus/reverb)
  and don't cover drone-synth's feature set. Wrote fresh, drone-synth-specific
  modules instead.
- **Package independence**: workspace member, not a fully standalone/unlinked
  package.
- **Location & naming**: top-level `drone-synth/` (no `packages/` nesting,
  since it's the only extracted package). Package name `"drone-synth"`.
- **Entry file & public URL**: entry file stays named `drone-synth.html`
  (not renamed to `index.html`), via a Vite config override, so the deployed
  URL stays exactly `/claude-drone/drone-synth.html`.
- **Deployment**: fixed as part of this task (not deferred) — see root build
  script wiring above.
- **Out of scope** (untouched by this work): `src/original.html`,
  `src/two-lfos.html`, `src/ts-synth.html`/`.ts` and their shared helpers.

## Next step

Push `feat/stata-drone`, merge to `main`, let the real GH Pages workflow run,
then check the live deploy at `https://amindunited.github.io/claude-drone/`
and `https://amindunited.github.io/claude-drone/drone-synth.html`. This is the
one remaining item on `issues/004-verify-end-to-end-and-deploy.md`.

## Known pre-existing bugs (carried over from the original monolith, not
introduced by the split — candidates for follow-up tickets if wanted)

- FX-panel knobs (`fx-page.ts`) close over `AppState.fx.*` by reference at
  boot; `loadSettings()` later reassigns `AppState.fx` wholesale, so FX
  knob changes after that point write into an orphaned object and don't
  survive a page reload / preset switch.
- `scheduleAutoSave()`'s call inside `loadSettings()` is a no-op (fires
  while `persistSuspended` is still `true`), so applying a preset or
  loading a JSON file never actually persists the change.
- Computer-keyboard note-off (`keyup`) recomputes the note from the
  *current* `octaveBase` rather than the octave in effect at key-down, so
  shifting octave while a key is held can leave a stuck note.
- `buildKeyboard()` fully tears down/rebuilds keyboard DOM (e.g. on preset
  load or window resize) with no `setPointerCapture`, which can also drop
  a `pointerup` and leave a stuck note if a preset is applied mid-press.
- `Engine.resume()` returns an unhandled promise; `Recorder`'s blob-URL
  revoke uses a fixed 1s timer instead of waiting for the download.

## Follow-up simplification opportunities (flagged by review, not done —
judged too large to do safely in the same pass as the structural split)

- LFO1/LFO2 panel wiring in `audio/voice.ts` (~90 lines copy-pasted, could
  use the `LfoSlot`-style abstraction `note-voice.ts` already has).
- FX parameter tables duplicated between `fx-page.ts` and `persistence.ts`'s
  `applyFxSettings`.
