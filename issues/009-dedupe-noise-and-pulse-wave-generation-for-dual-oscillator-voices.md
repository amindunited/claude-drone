# 009 — Dedupe noise-buffer / pulse-wave generation for dual-oscillator voices

> *Filed from code review of issue 005 (VCO2).*

**Category:** tech-debt · **State:** ready-for-agent

## Background

`NoteVoice._createOscSource()` (`note-voice.ts:106-122`) is called once for
VCO1 (`note-voice.ts:55`) and, when `osc2Enabled`, again for VCO2
(`note-voice.ts:126`, via `_addOsc2`). Both call sites can independently
resolve to `'noise'` or `'pulse'`:

- `'noise'` calls `noiseBuffer(ctx)` (`utils/dsp.ts:46-52`), which allocates
  a fresh 2-second `AudioBuffer` (`sampleRate * 2` samples — e.g. ~705KB of
  `Float32Array` at 44.1kHz) and fills every sample with `Math.random()` in
  a loop, on every call, with no caching.
- `'pulse'` calls `pulseWave(ctx, pulseWidth)` (`utils/dsp.ts:35-44`), which
  computes a 32-term Fourier series and calls
  `ctx.createPeriodicWave(...)` — again, freshly computed on every call.

A voice with `osc: 'noise'` and `osc2: 'noise'` (or `osc: 'pulse'` and
`osc2: 'pulse'` at the same width) does this work **twice** per `noteOn`
instead of once, since VCO1 and VCO2 are independent oscillators created by
independent calls into the same uncached generator functions.

## Scope

- In `noteOn` / `NoteVoice` construction, avoid generating a duplicate
  noise buffer or periodic wave when both oscillators resolve to the same
  waveform generation (same type, and for pulse, the same width).
- A reasonable approach: cache the generated `AudioBuffer` /
  `PeriodicWave` per `NoteVoice` instance (or per `AudioContext`, since
  white noise and a given pulse width/duty cycle don't need to be unique
  per oscillator or per note) and reuse it across VCO1/VCO2 when their
  waveform parameters match.
- Keep the fix scoped to avoiding redundant generation — do not change the
  audible characteristics of noise or pulse oscillators (e.g. don't make
  multiple noise oscillators share the exact same buffer *instance* if
  that would make them phase-locked/identical in a way that's audibly
  different from today's independently-random buffers, unless confirming
  that's acceptable).

## Explicit constraints

- This is a performance/efficiency cleanup, not a correctness bug — do not
  restructure `_createOscSource`, `_addOsc2`, or the VCO1/VCO2 mixing
  architecture beyond what's needed to dedupe generation.
- Preserve existing behavior for voices using only one noise/pulse
  oscillator, or using two different waveforms — no observable change.

## Acceptance criteria

- A voice with `osc: 'noise'` and `osc2: 'noise'` (osc2 enabled) allocates
  at most one noise buffer's worth of generation work per `noteOn` (verify
  via a one-off instrumentation/log or CPU profile, not by adding
  permanent instrumentation to the shipped code).
- A voice with `osc: 'pulse'` and `osc2: 'pulse'` at the same pulse width
  computes at most one `PeriodicWave` per `noteOn`.
- No audible regression for existing single-oscillator voices or
  dual-oscillator voices using different waveforms.
- `tsc` passes with no type errors.
