# 003 — Wire `drone-synth` workspace build into root `dist/`

## Background

See `HANDOFF.md` for full context. Depends on ticket 001 (and ideally 002,
though this can be done against the unsplit file too). This ticket fixes
deployment as part of the extraction — **not deferred**.

## Problem

Root `vite.config.js` currently builds five HTML entries from `src/` straight
into root `dist/`, including `drone-synth.html`. Once that file moves to its
own workspace package with its own Vite config, the root build no longer
produces it. The existing GitHub Pages workflow
(`.github/workflows/gh-pages.yml`) runs `npm ci && npm run build` at repo root
and publishes `./dist` as-is — it should **not** need to change.

## Requirements

`npm run build` at repo root must produce a `dist/` that:

1. Contains the `drone-synth` package's built output at the **same public
   path as today**: `/claude-drone/drone-synth.html` (live demo:
   `https://amindunited.github.io/claude-drone/`). No URL changes.
2. Keeps `src/index.html`'s existing link to the synth
   (`./drone-synth.html`, see `src/index.html:105`) working.
3. Requires no changes to `.github/workflows/gh-pages.yml`.

## Implementation notes

- Exact mechanism is an open implementation detail per HANDOFF — options
  include direct `outDir` targeting from the `drone-synth` package's Vite
  config vs. a copy step in the root `build` script. Pick whichever is
  simplest and most robust; this is not pre-decided.
- Root `build` script will need to also invoke the `drone-synth` workspace
  build (e.g. via `npm run build --workspaces` or an explicit script step).
- **Verify base path / asset resolution carefully** — this is the most likely
  place for a subtle break (e.g. JS/CSS assets resolving relative to the
  wrong base once served from GH Pages' `/claude-drone/` subpath).

## Acceptance criteria

- `npm run build` at repo root succeeds and produces `dist/drone-synth.html`
  (or equivalent path resulting in the same public URL) plus its JS/CSS
  assets, correctly path-resolved for the `/claude-drone/` GH Pages base path.
- `dist/index.html`'s link to the synth still resolves and loads correctly
  when served (test with `npm run preview` or a static file server, not just
  file:// — asset base paths can silently break under `file://`).
- No changes needed to `.github/workflows/gh-pages.yml`.
- The other four existing entries (`index.html`, `original.html`,
  `two-lfos.html`, `ts-synth.html`) still build unchanged from root.
