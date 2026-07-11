# T01 Project Scaffold and Build Configuration

> Milestone A | Prerequisite: none | Output: `app/` project skeleton

## Goal

Stand up a frontend project that supports `npm run dev` / `npm run build`: Vite + React 19.2,
with the build output targeting the `file://` packaging environment of webOS 24 (Chromium 108).

## Reference

- Skill: `.claude/skills/webos-tv-app-skill` (§3 build rules)

## Requirements

1. Initialize a Vite project under `app/` with pinned dependencies: `react@19.2`,
   `react-dom@19.2`, `@vitejs/plugin-react`; also declare `hls.js` (not used until T16,
   but wire up the code-splitting config now).
2. `vite.config.js`:
   - `base: './'` (required for `file://` packaging);
   - `build.target: 'chrome108'` (newer syntax silently fails on the real device);
   - `rollupOptions.output.manualChunks`: `react-vendor: ['react','react-dom']`,
     `hls: ['hls.js']` — keep hls.js out of the startup bundle.
3. Entry point `main.jsx`: use `createRoot` from `react-dom/client`, wrapped in
   `<StrictMode>`; `index.html` sets `<meta charset>`, a 1920x1080 viewport, and a
   dark background fallback (to avoid a flash of white on load).
4. Create the directory skeleton (empty files or placeholder exports are fine):
   `src/{config,api,hooks,store,components,pages,player,styles}`.
5. `package.json` scripts: `dev` / `build` / `preview`.
6. Do not introduce a routing library, state library, CSS framework, or test
   framework; do not configure TypeScript (use plain JS throughout, to reduce
   toolchain variables given the Chromium 108 target). ESLint is optional; if
   added, keep it to just `eslint` + `eslint-plugin-react-hooks` base rules.

## Explicitly out of scope

- webos-meta / appinfo.json (T23);
- any page, style, or API code.

## Acceptance criteria

- [ ] `npm run dev` opens an empty app shell (dark background + placeholder text)
      with no console errors;
- [ ] `npm run build` succeeds, with react and hls.js each in their own chunk in
      the output;
- [ ] the built `index.html` references assets via relative paths (`./assets/...`).
