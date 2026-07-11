# T06 Category Configuration and Business Endpoints

> Milestone A | Prerequisite: T05 | Output: `src/config/taxonomy.js`, `src/config/nav.js`, `src/api/olevod.js`

## Goal

Implement the "configuration-driven navigation" extension point and wrap all
business endpoints. Adding a new category (e.g. Anime) should only require
changing `taxonomy.js`, with the tab bar, routing, and category page picking it
up automatically.

## Reference

- Endpoint spec: [doc/olevod-api.md](../olevod-api.md) §4.3-§4.4

## Requirements

### Configuration

1. `taxonomy.js`: three categories (Movies / typeId=1, TV Series / typeId=2,
   Variety Shows / typeId=3, displayed in the order Movies, Variety Shows, TV
   Series), each with sub-genre (genre typeId), region, year, and sort options
   (latest `update` / most popular `hot` / rating `score`). Option data should
   be captured from live API responses (`/v1/pub/index/navs`,
   `/v1/pub/vod/list/type`) and hardcoded as static configuration.
2. `nav.js`: `TABS = ["首页" (Home), ...taxonomy categories, "我的" (Mine)]`,
   derived from taxonomy.

### olevod.js business endpoints

3. `categoryList({category, genre, area, year, sort, page, size})` ->
   `GET /v1/pub/vod/list/{flag}/{vip}/{letter}/{area}/{category}/{genre}/{year}/{order}/{page}/{size}`:
   - fixed segments: `flag=true`, `vip=3` (no VIP filtering), `letter=0`;
   - "All" for area/year/genre sends `0`; the area value is
     `encodeURIComponent`-encoded;
   - **the `order` segment must not be empty** (if empty, the server only
     returns `total` with `list` as null), defaulting to `update`;
   - returns `{ items, total, page, size }`, with each item normalized
     (id/name/pic/score/remarks/year/area/vip/hits/vodTime); **`pic` is stored
     as the raw relative path**, with sizing left to `imageUrl`.
4. `detail(id)` -> `GET /v1/pub/vod/detail/{id}/true`:
   - `urls[]` contains the m3u8 for each episode inline; **`.reverse()` it** so
     the newest episode is first;
   - the synopsis field is **`info.content`** (not `blurb`); normalize into
     title/rating/year/region/genre names/director/cast/remarks/episodes.
5. `imageUrl(pic, size)`: prepend `https://static.olelive.com/` to the relative
   path, with an optional `_WxH.<ext>` thumbnail suffix. Two pitfalls to avoid:
   the file extension in the suffix must match the source file's (don't append
   `.jpg` to a `.png` source); and if the path already contains a `_WxH` suffix,
   don't append another (to avoid a 404 like `..._384x560.jpg_384x560.jpg`).
6. `streamUrl(url)`: passes through to `luna.js`'s `mediaUrl()` (unchanged in
   the browser, proxied on the real device).

## Explicitly out of scope

- Search/trending-search endpoints (this version has no search UI, so these are
  not wrapped);
- Login and VIP stream access.

## Acceptance criteria

- [ ] Live browser test: `categoryList` for all three categories returns 24
      items on the first page each, with a sane `total`; switching
      genre/area/year/sort changes the results accordingly;
- [ ] `detail` for a multi-episode series: episodes are ordered newest-first,
      each episode has an accessible master.m3u8 URL, and the synopsis is
      non-empty;
- [ ] `imageUrl` produces URLs that return 200 for both a `.png` source and a
      path that already has a size suffix;
- [ ] temporarily add a fake category to `taxonomy.js` and confirm `nav.js`'s
      TABS gains an extra entry automatically (then revert).
