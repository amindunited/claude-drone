# Handoff: Extract `drone-synth.html` into its own package

Status: **design agreed, not yet implemented.**

## Goal

Move `src/drone-synth.html` (STRATA drone synth, currently one 2151-line file:
inline `<style>` + a single inline `<script>` of plain JS, no imports) out of the
shared `src/` multi-page Vite project and into its own npm workspace package,
cleaning up the code along the way.

## Current state (facts, verified before planning)

- Root is an npm-managed Vite multi-page site: `vite.config.js` builds five
  HTML entries from `src/` (`index.html`, `original.html`, `two-lfos.html`,
  `ts-synth.html`, `drone-synth.html`) into root `dist/`.
- `src/index.html` links to the synth at `./drone-synth.html` (`src/index.html:105`).
- `.github/workflows/gh-pages.yml` deploys GitHub Pages by running `npm ci && npm run build`
  at repo root and publishing `./dist`. Live demo: `https://amindunited.github.io/claude-drone/`.
- `drone-synth.html` has **zero dependency** on the repo's other shared TS
  helpers (`src/audio/*.ts`, `src/types/audio.ts`, `src/utils/dom.ts`) — those
  back `src/ts-synth.ts` instead, and implement a much simpler single-voice,
  single-LFO-target synth (no presets, no multi-voice, no bar-synced LFOs, no
  MIDI, no chorus/reverb convolution). They do **not** cover drone-synth's
  feature set and should not be reused/merged.
- `drone-synth.html`'s inline script (scanned for top-level structure) breaks
  down roughly into: `Knob` (reusable UI widget class), math/DSP utility
  functions (`clamp`, `lerp`, `polar`, `arcPath`, `pulseWave`, `noiseBuffer`,
  reverb impulse response), effects chain setup (distortion/chorus/delay/reverb),
  `NoteVoice`/`Voice` engine classes, storage/preset persistence functions
  (`readStorageJson`/`writeStorageJson`/`persistPresets`/`savePreset`/
  `applyPreset`/etc.), voice-list management (`addVoice`/`removeVoice`/
  `globalNoteOn`/`globalNoteOff`), FX-page UI builder (`buildFxPage`), keyboard
  + sustain UI (`buildKeyboard`, `setSustainEnabled`), MIDI wiring (`setupMidi`),
  global knobs (`mountGlobalKnobs`), JSON export (`downloadSettings`), and a
  `boot()` entry point.

## Decisions (agreed with user, in order settled)

1. **Cleanup scope**: split the single file into separate HTML/CSS/TS files,
   converting the current plain inline JS into typed TypeScript modules
   following the functional breakdown above (not a behavior rewrite).
2. **Module reuse**: write fresh, drone-synth-specific modules. Do **not**
   depend on or extend `src/audio/`, `src/types/`, `src/utils/` — those back
   a different, simpler demo (`ts-synth.ts`) and don't fit this feature set.
3. **Package independence**: new directory becomes an **npm workspace
   member**, not a fully standalone/unlinked package. Root `package.json`
   gains a `"workspaces"` field.
4. **Location & naming**: top-level `drone-synth/` directory (sibling to
   `src/`, `dist/` — no `packages/` nesting, since it's the only extracted
   package right now). Package name: `"drone-synth"`. Root
   `"workspaces": ["drone-synth"]`.
5. **Entry file & public URL**: keep the entry file named `drone-synth.html`
   inside the new package (not renamed to `index.html`), so the deployed URL
   stays exactly `/claude-drone/drone-synth.html`. This needs a small Vite
   config override (non-default entry name) in the new package, rather than
   relying on Vite's default `index.html` convention.
6. **Deployment**: fix as part of this task, not deferred. `npm run build` at
   repo root must still produce a `dist/` that (a) contains the new package's
   built output at the same public path as today, and (b) keeps
   `src/index.html`'s link to the synth working. The existing GH Pages
   workflow (`npm ci && npm run build`, publish `./dist`) should **not** need
   to change — the wiring should happen inside the root build script /
   workspace config, e.g. root `build` script also runs the `drone-synth`
   workspace build and its output lands in root `dist/` at the right path
   (exact mechanism — direct `outDir` targeting vs. copy step — is an
   implementation detail, not yet decided; verify base path / asset
   resolution carefully since the URL must not change).
7. **Out of scope**: `src/original.html`, `src/two-lfos.html`,
   `src/ts-synth.html`/`.ts` and their shared helpers are untouched by this
   work.

## Open implementation details (not decisions, just not yet done)

- Exact TS module filenames/boundaries within `drone-synth/src/` (proposed
  breakdown above is a starting point, not a spec).
- Exact mechanism for getting the workspace build output into root `dist/`
  at the correct path with correct asset base paths.
- `package.json` fields for the new package beyond `name` (version, private,
  scripts) — should mirror root conventions (`"private": true`, `dev`/`build`/
  `preview` scripts via Vite + `tsc`).

## Next step

Implement per the decisions above, starting with `git mv src/drone-synth.html
drone-synth/drone-synth.html` to preserve file history, then split into
modules, then wire up the workspace + build/deploy path.
