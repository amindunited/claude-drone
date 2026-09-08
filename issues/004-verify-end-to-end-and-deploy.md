# 004 — End-to-end verification and deploy

## Background

See `HANDOFF.md`. Final ticket in the `drone-synth` extraction — depends on
tickets 001–003 all being complete.

## Scope

- Run `npm ci && npm run build` from a clean state at repo root (mirroring
  exactly what `.github/workflows/gh-pages.yml` does) and confirm it succeeds.
- Serve the built `dist/` locally (e.g. `npm run preview`) and manually verify:
  - `/` (root index) loads and its link to the drone synth works.
  - `/drone-synth.html` loads at the correct path with no console errors
    (missing assets, wrong MIME types, broken relative paths).
  - Full feature smoke test of the synth itself: voices, presets
    (save/load/apply/export), bar-synced LFOs (16/32 bar), MIDI input if
    testable, FX chain (distortion/chorus/delay/reverb), keyboard + sustain.
  - The other four pages (`original.html`, `two-lfos.html`, `ts-synth.html`)
    still work, confirming they were untouched by the extraction.
- Confirm `git log --follow drone-synth/drone-synth.html` (or equivalent)
  still shows history from before the `git mv` in ticket 001, i.e. file
  history was preserved through the move.
- Push and let the real GH Pages workflow run once merged; check the live
  deploy at `https://amindunited.github.io/claude-drone/` and
  `https://amindunited.github.io/claude-drone/drone-synth.html` after
  publish.

## Acceptance criteria

- Clean `npm ci && npm run build` at root succeeds with no manual steps.
- All manual checks above pass with no regressions vs. pre-extraction
  behavior.
- Live GH Pages deploy confirmed working post-merge.
