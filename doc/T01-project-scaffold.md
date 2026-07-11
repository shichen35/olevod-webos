# T01 Project Scaffold and Build Configuration

> Milestone A | Prerequisite: none | Output: `app/` project skeleton

## Goal

Stand up a frontend project that supports `npm run dev` / `npm run build`: Vite 8 + React 19.2,
with the build output targeting the `file://` packaging environment of webOS 24 (Chromium 108).

## Reference

- Skill: `.claude/skills/webos-tv-app-skill` (§3 build rules)

## Requirements

1. Initialize a Vite project under `app/` with dependencies `react@^19.2`,
   `react-dom@^19.2` and devDependencies `vite@^8` + `@vitejs/plugin-react@^6`;
   also declare `hls.js@^1.6` (not used until T16, but wire up the code-splitting
   config now).
2. `vite.config.js`:
   - `base: './'` (required for `file://` packaging);
   - `build.target: 'chrome108'` (newer syntax silently fails on the real device);
   - `rollupOptions.output.manualChunks` in **function form** (required by Vite 8's
     Rolldown bundler): ids under `node_modules/hls.js` go to a `hls` chunk, ids
     under `node_modules/react` go to `react-vendor` — keep hls.js out of the
     startup bundle;
   - `define: { __APP_VERSION__ }` injected from `package.json` `version`, the
     single version source (`webos-meta/appinfo.json` must match it);
   - dev server on `host: '0.0.0.0'`, `port: 5173` (reachable from the TV/LAN).
3. Entry point `main.jsx`: use `createRoot` from `react-dom/client`, wrapped in
   `<StrictMode>`; import only `./styles/index.css` for styles; top-level
   `await initTvEnv()` (from `src/api/luna.js`, T22) so the transport environment
   is resolved before the first frame (instant in the browser). `index.html` sets
   `<meta charset>`, a `width=1920, height=1080` viewport, and an inline dark
   background fallback (`#0e0e11`, to avoid a flash of white on load).
4. Create the directory skeleton (empty files or placeholder exports are fine):
   `src/{config,api,hooks,store,components,pages,player,styles}`.
5. `package.json` scripts: `dev` / `build` / `preview`, plus `sim` (build, merge
   `webos-meta/` into `dist/`, and launch in the webOS simulator via
   `ares-launch`).
6. Do not introduce a routing library, state library, CSS framework, or test
   framework; do not configure TypeScript (use plain JS throughout, to reduce
   toolchain variables given the Chromium 108 target). No ESLint is configured
   either — the toolchain is just Vite + the React plugin.

## Explicitly out of scope

- webos-meta / appinfo.json content and the root `build.sh` packaging script (T23);
- any page, style, or API code.

## Acceptance criteria

- [ ] `npm run dev` serves the app on port 5173 with a dark background and no
      console errors;
- [ ] `npm run build` succeeds, with react and hls.js each in their own chunk in
      the output;
- [ ] the built `index.html` references assets via relative paths (`./assets/...`).
