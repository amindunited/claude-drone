# 002 — Split `drone-synth.html`'s inline script into TypeScript modules

## Background

See `HANDOFF.md` for full context. Depends on ticket 001 (package must exist
first). This is the core cleanup step: converting the current plain inline JS
into typed TS modules, **following existing behavior — not a rewrite.**

## Scope

Split the single inline `<script>` into separate HTML/CSS/TS files under
`drone-synth/src/`, following the functional breakdown already identified in
HANDOFF.md's "Current state" section:

- `Knob` — reusable UI widget class.
- Math/DSP utilities — `clamp`, `lerp`, `polar`, `arcPath`, `pulseWave`,
  `noiseBuffer`, reverb impulse response generation.
- Effects chain setup — distortion / chorus / delay / reverb.
- `NoteVoice` / `Voice` engine classes.
- Storage/preset persistence — `readStorageJson`, `writeStorageJson`,
  `persistPresets`, `savePreset`, `applyPreset`, etc.
- Voice-list management — `addVoice`, `removeVoice`, `globalNoteOn`,
  `globalNoteOff`.
- FX-page UI builder — `buildFxPage`.
- Keyboard + sustain UI — `buildKeyboard`, `setSustainEnabled`.
- MIDI wiring — `setupMidi`.
- Global knobs — `mountGlobalKnobs`.
- JSON export — `downloadSettings`.
- `boot()` entry point.

The exact module filenames/boundaries are **not yet decided** — the above is
a starting point per HANDOFF, not a spec. Use judgment on final module
boundaries, but keep the breakdown roughly aligned with this list.

Also extract the inline `<style>` block into its own CSS file(s).

## Explicit constraints (per HANDOFF decisions)

- **This is a structural split only, not a behavior rewrite.** Preserve
  existing functionality exactly.
- **Do not** depend on or extend `src/audio/*.ts`, `src/types/audio.ts`,
  `src/utils/dom.ts`. Those back the simpler `ts-synth.ts` demo (no presets,
  no multi-voice, no bar-synced LFOs, no MIDI, no chorus/reverb convolution)
  and do not cover drone-synth's feature set. Write fresh, drone-synth-specific
  modules instead.

## Acceptance criteria

- No more inline `<script>`/`<style>` in `drone-synth/drone-synth.html` —
  logic lives in typed `.ts` modules under `drone-synth/src/`, styles in CSS.
- `tsc` passes with no type errors.
- All existing features still work when run via the package's `dev` script:
  presets (save/load/apply), multi-voice, bar-synced LFOs (16/32 bar), MIDI
  input, chorus/reverb/delay/distortion FX, sustain, keyboard UI, JSON
  export/import.
- Manual smoke test in a browser confirms no regressions (this is a UI-heavy
  synth — type-checking alone does not prove correctness).
