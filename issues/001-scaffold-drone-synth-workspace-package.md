# 001 — Scaffold `drone-synth` as an npm workspace package

## Background

See `HANDOFF.md` for full context. This is the first step of extracting
`src/drone-synth.html` (STRATA drone synth, 2151-line single file) out of the
shared `src/` multi-page Vite project into its own package.

## Scope

- `git mv src/drone-synth.html drone-synth/drone-synth.html` to preserve file
  history (per HANDOFF's stated next step — do this before splitting the file
  so history follows the move).
- Add root-level `"workspaces": ["drone-synth"]` to `package.json`.
- Create `drone-synth/package.json`:
  - `"name": "drone-synth"`, `"private": true`, mirroring root conventions.
  - `dev`/`build`/`preview` scripts via Vite + `tsc`, matching root's pattern
    (`"build": "tsc && vite build"`).
- Add a `drone-synth/vite.config.js` (or `.ts`) with a **non-default entry
  name** override so the built HTML entry stays `drone-synth.html`, not
  Vite's default `index.html` convention (needed to preserve the public URL —
  see ticket 003).
- Add `drone-synth/tsconfig.json` (can extend root `tsconfig.json` if
  convenient).

## Explicitly out of scope

- Splitting the inline script into modules (ticket 002).
- Wiring the workspace build into root `dist/` (ticket 003).
- `src/original.html`, `src/two-lfos.html`, `src/ts-synth.html`/`.ts` and their
  shared helpers — untouched by this whole effort.

## Acceptance criteria

- `drone-synth/` exists as a sibling of `src/` and `dist/` (no `packages/`
  nesting).
- `npm install` at root recognizes `drone-synth` as a workspace member.
- The file still contains the original, unmodified inline `<style>` +
  `<script>` at this stage — no code splitting yet, just the move + scaffold.
- Running the new package's own `dev`/`build` scripts works in isolation
  (root build wiring comes later).
