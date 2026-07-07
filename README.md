# OleVod webOS TV

A video client for LG webOS TV, targeting the OleVod service. Top tab bar +
full-width content area, 10-foot UI, fully operated via remote D-pad,
performance-first — zero re-render focus, no animation, no translucency.

- **Target device**: LG webOS 24 (Chromium 108, service side Node.js 16) / 1080p /
  D-pad remote (aligned to LG C4).
- **Stack**: Vite + React 19.2 (frontend) · Node.js 16 Luna background service
  (API/media dual channel) · hls.js (playback).
- **Feature scope**: home shelves · Movies/Variety/TV Series sections · detail page ·
  HLS playback · Library (favorites/history/settings).
  No login, VIP, search, live streaming, screen casting, or danmaku (comment overlay).

## Directory Structure

```
app/        frontend (Vite + React 19.2)
  src/{config,api,hooks,store,components,pages,player,styles}
  webos-meta/   appinfo.json + icons (for packaging)
service/    Luna background service (Node 16 CommonJS): API fetch + local HLS proxy
tools/      deployment and CDP-over-SSH debugging scripts
doc/        development plan, API integration notes, and per-task docs
build.sh    build -> package .ipk -> optional deploy
```

## Development

```bash
cd app
npm install
npm run dev        # dev server, browser connects directly to the API (both API and CDN allow CORS, no proxy needed)
npm run build      # production build to app/dist (target chrome108, base './')
npm run preview    # preview the build output locally
```

No automated tests; verification is via `npm run build` passing plus manual
remote-control walkthroughs in the browser/preview. For on-device debugging,
use the CDP-over-SSH toolchain in `tools/` to read console/performance/network
data before making code changes.

In the browser, use the keyboard to simulate the remote: arrow keys to
navigate, Enter to select, Esc to go back (the real device's back key is
webOS keyCode 461).

## Build and Deploy (webOS)

Requires the official LG CLI and Developer Mode on the TV:

```bash
npm install -g @webos-tools/cli     # ares-* commands; verify with ares -V
# Install the Developer Mode App on the TV and enable developer mode; note the
# passphrase (it rotates each session)

bash build.sh --no-deploy           # build + package .ipk only
bash build.sh <passphrase>          # build + package + deploy + launch
```

Standard pipeline: `ares-package` -> `ares-setup-device` -> `ares-novacom --getkey`
-> `ares-install` -> `ares-launch`. When the official CLI isn't usable under
some newer Node versions, `tools/deploy.mjs` uses `ssh2` to run the equivalent
pipeline. See [doc/tasks/T23](doc/tasks/T23-packaging-deploy.md) for details.

## Architecture Highlights

- **Dual-channel data layer**: API JSON goes through the Luna service; media
  (m3u8/.ts) goes through the local `127.0.0.1` proxy opened by the service;
  in the browser dev environment everything connects directly. Channel
  selection is centralized in `app/src/api/luna.js`, transparent to the
  business layer. All data fetching goes through `apiGet` in
  `app/src/api/http.js` (sign -> transport -> validate -> decrypt).
- **Config-driven navigation**: the section tree lives in
  `app/src/config/taxonomy.js`; adding a section only requires editing this
  file — tab bar / routing / section pages pick it up automatically.
- **Zero re-render focus**: `app/src/hooks/useFocus.js` — focus movement only
  toggles a DOM class + `scrollIntoView`.
- **Request signing**: every GET carries `?_vv=<signature>`
  (`app/src/api/sign.js`, generated locally from a timestamp).

See [doc/olevod-api.md](doc/olevod-api.md) for API details, and
[doc/README.md](doc/README.md) for the full development plan and task
breakdown.
