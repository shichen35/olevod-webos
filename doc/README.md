# OleVod webOS TV Client — Development Plan and Task Breakdown

Development plan for a video client for LG webOS TV built against the OleVod
service. Stack: Vite + React 19.2 (frontend) + Node.js 16 Luna background
service (data/media channel). The design avoids any implementation choice
that would hurt TV rendering performance (frosted glass, translucent overlays,
transition animations, etc. — see "Hard Constraints" below).

- Target device: LG webOS 24 (Chromium 108, service side Node.js 16) / 1080p /
  D-pad remote (aligned to LG C4).
- Data source: `api.olelive.com` (`_vv` signature), HLS CDN
  `*.olemovienews.com`, images at `static.olelive.com`. See
  [doc/olevod-api.md](olevod-api.md) for API details.
- Feature scope: home shelves / Movies · Variety · TV Series sections /
  detail page / HLS playback / Library (favorites · history · settings) /
  full D-pad navigation. **Out of scope**: login, VIP, search, live
  streaming, screen casting, danmaku (comment overlay).

## webOS Platform Notes

Based on LG's official developer docs and community practice (see
[Building apps for LG TVs ft. webOS](https://medium.com/@pradyumna.ferrari/building-apps-for-lg-tvs-ft-webos-4513523b1858)):

- **App form factor**: chose **Packaged Web App** — all resources bundled
  into a single `.ipk`, no server dependency, can launch offline (a Hosted
  Web App needs a stable external network and its first paint is bound by
  network conditions, which doesn't fit this use case).
- **Toolchain**: `npm install -g @webos-tools/cli` (verify with `ares -V`);
  an LG developer account (webostv.developer.lge.com) + the Developer Mode
  App on the TV. Standard flow: `ares-package` to package -> `ares-setup-device`
  to configure the device -> `ares-novacom --getkey` to fetch the SSH key
  (passphrase comes from the Developer Mode App and **rotates each
  session**) -> `ares-install` to install -> `ares-launch` to launch ->
  `ares-inspect` to debug.
- **Engine compatibility is a hard constraint**: the webOS version determines
  the web engine — older models (webOS 5.x–19 generation) run Chromium 68,
  capping React at 16. This project **targets webOS 24 (Chromium 108) only**,
  which allows React 19.2, but the Vite build target must be pinned to
  `chrome108`.
- **Simulator != real device**: the webOS Simulator uses a newer Chromium
  than real hardware — working in the simulator doesn't guarantee it works
  on-device. Final acceptance is always on real hardware (Milestone D).
- **Remote control keys**: arrow keys 37/38/39/40, OK 13 are the standard
  keyCodes; webOS's **back key is 461** (not Backspace). The SPA must set
  `disableBackHistoryAPI:true` in `appinfo.json`, otherwise the system
  intercepts the back key and exits the app directly.
- **appinfo.json**: `id` (reverse domain), `version` (semver), `vendor`,
  `type:"web"`, `main`, `title`, `icon`, `uiRevision:2`; resolution pinned to
  `1920x1080`.
- **On-device debugging**: `ares-inspect` shows a blank DevTools window on
  some models; the fallback is the CDP-over-SSH toolchain (T24) — pull
  logs/performance/network data first, then fix the code.

## Hard Constraints (mandatory for every task)

### Performance Red Lines

1. **Zero re-render focus**: focus movement only toggles a DOM class +
   `scrollIntoView`, never `setState`.
2. **No CSS transitions or animations of any kind**: no `transition` /
   `animation` / `@keyframes`; focus state, panel open/close, and toasts are
   all instant switches. `scrollIntoView` always uses `behavior:'auto'`.
3. **No frosted glass or translucency**: no `backdrop-filter`; no `rgba()` /
   `opacity` for panel backgrounds, overlays, or gradient scrims. All
   surfaces and text use **opaque solid colors** (palette defined in T02).
   Scenarios that need a "dimmed background" (detail page, player, modals)
   use opaque, sectioned layouts instead.
4. **No scaling, no shadows**: focus state is expressed via opaque borders +
   background/text color swaps, not `scale()` zoom or `box-shadow`.
5. Scrolling uses `transform: translateY` or container `overflow` +
   immediate `scrollIntoView`; no smooth scrolling.
6. List components use `React.memo`; card containers use
   `content-visibility:auto` + `contain:content`.
7. Pages stay mounted, hidden via `display:none`, never unmounted (preserves
   state, avoids refetching).
8. Request thumbnails with a size suffix; build target `chrome108`,
   `base:'./'`.

### React 19.2 Conventions

- `react` / `react-dom` pinned to 19.2; entry uses `createRoot`, dev build
  wraps in `<StrictMode>`.
- **`ref` is passed directly as a prop**, no `forwardRef` (React 19 removed
  the need for it).
- Store subscriptions always use **`useSyncExternalStore`**.
- The player is loaded via `lazy()` + `<Suspense>`; hls.js is not part of the
  startup bundle.
- Minimize side effects: data fetching lives in explicit loader functions;
  `useEffect` is only for subscriptions/event binding; callbacks go into
  `useRef` rather than the dependency array (to avoid infinite loops in
  focus registration).
- No `defaultProps`, no legacy Context API, no routing library (the view
  stack manages itself).

### Engineering Conventions

- No automated tests; acceptance for each task = `npm run build` passing +
  actually checking the task's acceptance checklist via `npm run dev`/preview.
  Add CDP checks once on real hardware (Milestone D).
- Service side (Luna service) is Node 16, **CommonJS** (`require`).
- All data fetching goes through `apiGet` in `api/http.js`, with transport
  selection centralized in `api/luna.js`; adding a section only requires
  editing `config/taxonomy.js` — these are the two fixed extension points.

## Target Directory Structure

```
app/        frontend (Vite + React 19.2)
  src/{config,api,hooks,store,components,pages,player,styles}
  webos-meta/   appinfo.json + icons
service/com.olevod.app.service/   Luna background service (Node 16 CJS)
tools/      deployment and CDP debugging scripts
doc/        this plan, API notes, and task docs
build.sh    build + package + optional deploy
```

## Milestones and Task Index

Each task implements exactly one feature; docs live in
[doc/tasks/](tasks/). "Prereq" denotes a hard dependency; tasks within the
same milestone with no dependency between them can proceed in parallel.

### Milestone A — Engineering Baseline (data layer runnable in the browser)

| Task | Description | Prereq |
|------|------|------|
| [T01](tasks/T01-project-scaffold.md) | Project scaffold and build config | — |
| [T02](tasks/T02-design-tokens.md) | Design tokens and global style baseline | T01 |
| [T03](tasks/T03-focus-engine.md) | D-pad zero re-render focus engine | T01 |
| [T04](tasks/T04-sign-and-crypto.md) | `_vv` request signing and AES payload decryption | T01 |
| [T05](tasks/T05-transport-http.md) | Data channel abstraction and unified fetching | T04 |
| [T06](tasks/T06-taxonomy-and-api.md) | Category config and business API | T05 |
| [T07](tasks/T07-local-stores.md) | Local persistence and page cache | T01 |

### Milestone B — Pages and Navigation (fully usable in browser, except playback)

| Task | Description | Prereq |
|------|------|------|
| [T08](tasks/T08-app-shell-tabbar.md) | App shell, tab bar, and back-navigation stack | T02 T03 |
| [T09](tasks/T09-card-components.md) | Content card system (VideoCard/Thumb/Shelf) | T02 T06 |
| [T10](tasks/T10-home-page.md) | Home shelves | T08 T09 T07 |
| [T11](tasks/T11-category-page.md) | Category page: sub-type filter + grid + infinite scroll | T08 T09 |
| [T12](tasks/T12-filter-panel.md) | Filter panel (region/year/sort) | T11 |
| [T13](tasks/T13-detail-page.md) | Detail page | T08 T09 T07 |
| [T14](tasks/T14-library-page.md) | Library page (favorites/history/settings) and confirmation modal | T08 T09 T07 |
| [T15](tasks/T15-prefetch-cache.md) | Startup prefetch and tab refresh | T10 T11 |

### Milestone C — Player

| Task | Description | Prereq |
|------|------|------|
| [T16](tasks/T16-player-basic.md) | Basic HLS playback and quality selection | T13 |
| [T17](tasks/T17-player-controls.md) | Remote key bindings and progress bar UI | T16 |
| [T18](tasks/T18-player-resume.md) | Resume playback and watch-progress persistence | T16 T07 |
| [T19](tasks/T19-player-autoplay-next.md) | Autoplay next and Up Next | T17 T18 |
| [T20](tasks/T20-player-panel.md) | Player panel (episode selector/speed/quality) and first-use hint | T17 |

### Milestone D — On webOS Hardware

| Task | Description | Prereq |
|------|------|------|
| [T21](tasks/T21-luna-service.md) | Luna background service: fetch + local HLS proxy | — |
| [T22](tasks/T22-tv-transport.md) | Frontend wired to the real-device dual channel | T21 T05 T16 |
| [T23](tasks/T23-packaging-deploy.md) | webOS packaging and deployment | T22 |
| [T24](tasks/T24-debug-toolchain.md) | CDP debugging toolchain | T23 |
| [T25](tasks/T25-device-validation.md) | On-device acceptance and performance baseline | T23 T24 |

## Key Design Decisions

1. **No animation / no translucency is a design premise, not a downgrade
   switch**: focus state uses "opaque border + color change" rather than
   "scale + shadow"; the detail page and player use opaque, sectioned
   layouts rather than gradient scrims; accordingly, the settings page does
   not offer appearance toggles like "reduce motion" or "disable frosted
   glass".
2. **Layout is annotated directly in real 1920x1080 px**: no logical stage +
   root `scale()` scaling (scaling the root node adds ongoing compositing
   overhead and makes size annotations confusing).
3. **Dual-channel data layer**: API JSON goes through the Luna service;
   media goes through the local proxy (`127.0.0.1`); in the browser dev
   environment everything connects directly (both API and CDN allow CORS)
   — channel selection is transparent to the business layer.
4. **Minimal outbound request headers on the service side**: the API
   gateway only validates `_vv` and does not check Referer/Origin; only the
   CDN proxy path injects a Referer — no browser fingerprint spoofing is
   done.
