# 004 — End-to-end verification and deploy

Status: **local verification done; only push + post-merge live check remains.**

## Background

See `HANDOFF.md`. Final ticket in the `drone-synth` extraction. Tickets
001–003 are complete (package scaffolded, code split into TS modules, root
build wired to produce `dist/drone-synth.html`).

## Scope

- [x] Run `npm ci && npm run build` from a clean state at repo root (mirroring
  exactly what `.github/workflows/gh-pages.yml` does) and confirm it succeeds.
- [x] Serve the built `dist/` locally (e.g. `npm run preview`) and manually verify:
  - `/` (root index) loads and its link to the drone synth works.
  - `/drone-synth.html` loads at the correct path with no console errors
    (missing assets, wrong MIME types, broken relative paths).
  - Full feature smoke test of the synth itself: voices, presets
    (save/load/apply/export), bar-synced LFOs (16/32 bar), MIDI input if
    testable, FX chain (distortion/chorus/delay/reverb), keyboard + sustain.
  - The other four pages (`original.html`, `two-lfos.html`, `ts-synth.html`)
    still work, confirming they were untouched by the extraction.
- [x] Confirm `git log --follow drone-synth/drone-synth.html` (or equivalent)
  still shows history from before the `git mv` in ticket 001, i.e. file
  history was preserved through the move.
- [ ] Push and let the real GH Pages workflow run once merged; check the live
  deploy at `https://amindunited.github.io/claude-drone/` and
  `https://amindunited.github.io/claude-drone/drone-synth.html` after
  publish. **Still outstanding** — branch `feat/stata-drone` is 2 commits
  ahead of `origin/feat/stata-drone` (unpushed) and hasn't been merged to
  `main` (which is 11 commits behind on this branch's history).

## Acceptance criteria

- [x] Clean `npm ci && npm run build` at root succeeds with no manual steps.
- [x] All manual checks above pass with no regressions vs. pre-extraction
  behavior.
- [ ] Live GH Pages deploy confirmed working post-merge.
