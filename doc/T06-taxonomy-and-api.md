# T06 Category Configuration and Business Endpoints

> Milestone A | Prerequisite: T05 | Output: `src/config/taxonomy.js`, `src/config/nav.js`, `src/api/olevod.js`, `src/api/feeds.js`

## Goal

Implement the "configuration-driven navigation" extension point and wrap all
business endpoints. Adding a new category (e.g. Anime) should only require
changing `taxonomy.js`, with the tab bar, routing, and category page picking it
up automatically.

## Reference

- Implementation: `app/src/api/olevod.js` (endpoint wrappers, URL shapes,
  normalization), `app/src/config/taxonomy.js` (frozen option data),
  `app/src/api/feeds.js` (shared feed loaders and cache keys)

## Requirements

### Configuration

1. `taxonomy.js`: three categories (Movies / typeId=1, TV Series / typeId=2,
   Variety Shows / typeId=3, displayed in the order Movies, Variety Shows, TV
   Series), each with sub-genre (genre typeId), region, and year options;
   sort options are shared across categories and exported as `SORTS` (latest
   `update` / most popular `hot` / rating `score`) with
   `DEFAULT_SORT='update'`. The sentinel value `'0'` means "All" for the
   genre/area/year filter segments; `getCategory(id)` looks a category up by
   id. Option data should be captured from live API responses
   (`/v1/pub/vod/list/type`) and hardcoded as static configuration so the
   first paint never waits on a network round trip.
2. `nav.js`: `TABS = ["首页" (Home), "搜索", ...taxonomy categories, "收藏", "历史", "设置"]`,
   derived from taxonomy — each tab is
   `{ key, label, kind, categoryId?, pinned? }`, with `tabByKey(key)` as the
   lookup. The trailing personal tabs are pinned: always shown, never reordered.

### olevod.js business endpoints

3. `categoryList({category, genre, area, year, sort, page, size})` ->
   `GET /v1/pub/vod/list/{flag}/{vip}/{letter}/{area}/{category}/{genre}/{year}/{order}/{page}/{size}`:
   - fixed segments: `flag=true`, `vip=3` (no VIP filtering), `letter=0`;
   - "All" for area/year/genre sends `0`; the area value is
     `encodeURIComponent`-encoded;
   - **the `order` segment must not be empty** (if empty, the server only
     returns `total` with `list` as null), defaulting to `update`;
   - returns `{ items, total, page, size }`, with each item normalized
     (id/name/pic/score/remarks/year/area/vip/hits/vodTime/typeId); **`pic` is
     stored as the raw relative path**, with sizing left to `imageUrl`.
4. `detail(id)` -> `GET /v1/pub/vod/detail/{id}/true`:
   - `urls[]` contains the m3u8 for each episode inline; **`.reverse()` it** so
     the newest episode is first; each episode is normalized to
     `{ index, title, url, vip, seekStart, seekEnd }`;
   - the synopsis field is **`content`** (not `blurb`); normalize into
     title/pic/rating/year/region/genreName/director/cast/remarks/synopsis/
     episodeCount/episodes — `episodeCount` is derived from the length of
     `urls[]` (the response's `total` is unreliable).
5. `imageUrl(pic, size)`: prepend `https://static.olelive.com/` to the relative
   path (an already-absolute URL passes through unchanged); an optional `size`
   (e.g. `'384x560'`) appends the CDN's thumbnail form AFTER the full filename,
   repeating the source extension (`foo.jpg` -> `foo.jpg_384x560.jpg`, matching
   the API's own `picThumb` field). Two pitfalls to avoid: the file extension
   in the suffix must match the source file's (don't append `.jpg` to a `.png`
   source); and if the path already contains a `_WxH.<ext>` suffix, don't
   append another (to avoid a 404 like `..._384x560.jpg_384x560.jpg`).
6. `streamUrl(url)`: passes through to `luna.js`'s `mediaUrl()` (unchanged in
   the browser, proxied on the real device).

### feeds.js shared feed loaders

7. Shared loaders + cache keys, so pages and the startup prefetch (T15) hit the
   SAME `pageCache` keys and dedupe into one request:
   - `POPULAR`: the home page's three popular rows (热门电影 / 热门综艺 /
     热门连续剧), each loaded with `sort='hot'`, `size=12`;
   - `loadHomePopular()`: loads the three rows concurrently
     (`Promise.allSettled`, a failed row becomes an empty list) but caches them
     as one unit under `HOME_POPULAR_KEY='home:popular'`;
   - `defaultFilter()` / `currentFilterFor(category)`: the all-'0' +
     `DEFAULT_SORT` filter, or the category's last persisted selection (T07);
   - `categoryFirstPageKey(category, f)` ->
     `cat:{category}:{genre}:{area}:{year}:{sort}:p1`, and
     `loadCategoryFirstPage(category, f, size=24)` caches under that key;
   - `prefetchAll(shouldStop)`: sequential background prefetch (home first,
     then each category's first screen — concurrent signed requests starve
     each other), swallowing failures; the `shouldStop()` predicate aborts
     early.

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
