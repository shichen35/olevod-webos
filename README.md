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
doc/        per-task development docs (T01-T25)
build.sh    build -> package .ipk
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
remote-control walkthroughs in the browser/preview and the webOS Simulator.

In the browser, use the keyboard to simulate the remote: arrow keys to
navigate, Enter to select, Esc to go back (the real device's back key is
webOS keyCode 461).

## Build and Package (webOS)

Requires the official LG CLI:

```bash
npm install -g @webos-tools/cli     # ares-* commands; verify with ares -V

bash build.sh                       # build + package .ipk into out/
```

See [doc/T23](doc/T23-packaging-deploy.md) for packaging details.

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

See the per-task docs in [doc/](doc/) (T01-T25) for the design and acceptance
criteria of each subsystem.
