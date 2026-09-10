# 010 — Unify VCO1/VCO2 knob-rendering in the voice panel

> *Filed from code review of issue 005 (VCO2).*

**Category:** tech-debt · **State:** ready-for-agent

## Background

`Voice._renderOscKnobs()` (`voice.ts:586-620`) and
`Voice._renderOsc2Knobs()` (`voice.ts:622-668`) are near-duplicates: both
clear a knob-grid container, sync a `<select>`'s value, render a PITCH
knob (and, for `_renderOsc2Knobs`, a LEVEL knob VCO1 doesn't have), and
conditionally render a WIDTH knob when the oscillator type is `'pulse'` —
differing only in which `p.osc*` field is read/written and which DOM
selector/group is targeted.

This duplication was flagged during code review of the VCO2 feature
(issue 005): any future change to oscillator knob behavior (new knob,
changed bounds/formatting, a new conditional control) has to be applied
in both methods by hand, and it's easy to update one and forget the
other — exactly the kind of drift this ticket exists to prevent before it
happens.

## Scope

- Extract a single parameterized renderer (e.g.
  `_renderOscKnobsInto(container, selectSelector, accessors)`, where
  `accessors` supplies the get/set closures for pitch/pulseWidth/level and
  which fields exist for that oscillator) that both `_renderOscKnobs` and
  `_renderOsc2Knobs` delegate to.
- VCO1 has no LEVEL knob and VCO2 has no independent consideration beyond
  what's listed in issue 005 — the shared renderer should support "VCO1
  shape" (no LEVEL) and "VCO2 shape" (with LEVEL) without introducing a
  LEVEL knob for VCO1 or removing the LEVEL knob from VCO2.
- Preserve the existing conditional WIDTH-knob-only-when-`pulse` behavior
  for both oscillators.

## Explicit constraints

- UI-only refactor — do not change knob ranges, defaults, formatters, or
  add/remove any controls as part of this ticket.
- Do not change `VoiceParams`, `NoteVoice`, or any audio-graph code; this
  is scoped to `voice.ts`'s panel-rendering methods.

## Acceptance criteria

- `_renderOscKnobs` and `_renderOsc2Knobs` (or their replacement) no
  longer duplicate the knob-construction logic — shared behavior lives in
  one place.
- Existing behavior is pixel/behavior-identical: PITCH knob for both
  oscillators, LEVEL knob only for VCO2, WIDTH knob only when the
  respective oscillator's type is `'pulse'`.
- `tsc` passes with no type errors.
- Manual smoke test: switching VCO1/VCO2 waveform types in the browser
  still shows/hides the WIDTH knob correctly for each oscillator
  independently.
