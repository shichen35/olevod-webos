# Feature gap vs. the OleVod web client — and what to build next

> Written 2026-07-25. Compares the TV app in this repo (as of `cb43ad4`) against the
> PC web client at `www.olevod.com`, and turns the differences into a prioritized
> backlog.

## How this was compared

The web client was walked through in a browser (home, a category page, two detail
pages, the ranking page, the navigation mega-menu) and its network traffic was read
to recover the endpoints behind each surface. The TV app was compared by reading
`app/src/`.

One thing could **not** be verified: the web player itself. Pressing 立刻播放 never
navigated for a signed-out visitor, so nothing here claims anything about the web
player's controls (倍速 / 清晰度 / 线路). Player items in the backlog below are framed
as gaps in our own player, judged against what a TV player is normally expected to do.

## Where the two clients stand today

| Surface | Web client | TV app | Verdict |
| --- | --- | --- | --- |
| Categories | 短剧(14) · 电影(1) · 连续剧(2) · 综艺(3) · 动漫(4) · VIP蓝光(6) · 直播 | 电影 · 连续剧 · 综艺 · 动漫 | app is missing 短剧 and VIP蓝光 |
| Home layout | Per-category block with 最近更新 / 最新添加 / 热播 sub-tabs, plus a hero carousel and a live strip | One 热门 shelf per category, plus local 继续观看 / 我的收藏 | app shows roughly a third of the content the web home does |
| Rankings | 榜单 page: 日/周/月/总 × per-category top 20 | — | whole surface missing |
| Category page | Hero carousel + 类型/地区/年代 filters + 热门推荐 (换一批) + 最近添加 | 类型/地区/年代/排序 filters + infinite-scroll grid | app is ahead on filtering, behind on curated rows |
| Detail page | Synopsis with 展开, 播放列表 with 升序/降序, 猜你喜欢, per-genre hot list, 点赞/评分/收藏 | Synopsis clamped to 3 lines, episode grid (fixed newest-first), 收藏 | app dead-ends after the episode grid |
| Search | Box + suggestions | Box + system keyboard + hot keywords + autocomplete + infinite-scroll grid | app is at parity or ahead; no local search history |
| Player | (not inspected — sign-in required) | HLS, auto ABR, seek with long-press ramp, resume, autoplay-next, episode strip, stall recovery | solid; no speed / manual quality / skip-intro |
| Account | 登录 · VIP · 消息 · server-synced 历史 | Local favorites / history / settings only | out of scope by design |
| Misc | 简/繁 toggle, 换肤, 导航 mega-menu, app downloads | Tab reordering, home-shelf toggles, smooth-scroll toggle | 简/繁 is a real gap for the overseas audience |

## Deliberately out of scope

The README already rules these out and nothing found here argues for reopening them:
login / VIP, live TV and sports (`/v1/pub/index/live/data/*`), casting, danmaku, and
the web's 点赞 / 评分 / 消息 (all account-bound). VIP蓝光影院 (typeId 6) is listed as a
gap for completeness, but its titles are membership-gated — browsing would work,
playback probably would not, so it stays parked until someone confirms the stream
behaviour for an anonymous client.

---

## Backlog

Grouped by priority. Effort is S (a day or less) / M (a few days) / L (a week or more).

### P0 — worth doing next

**1. 短剧 category (typeId 14) · S**
Short-form drama leads the web home page, which says a lot about what the audience
actually watches, and the app doesn't carry it at all. `taxonomy.js` is the single
extension point, so this is one config entry: genres are 言情都市 / 甜宠逆袭 / 玄幻仙侠 /
穿越重生 / 王妃总裁 / 离婚 / 其他 (ids need capturing from `/v1/pub/vod/list/type`), and
the tab bar, routing, filters and category page all follow automatically. The one thing
to check is the poster aspect ratio — short drama art is often not 2:3.

**2. Richer home page off the aggregate endpoint · M**
The web home calls `/v1/pub/index/vod/data/{typeId}` once per category and gets
最近更新 / 最新添加 / 热播 back together. The app instead fires four `categoryList`
calls with `sort=hot` and renders one row each. Switching to the aggregate endpoint
costs the same number of requests but yields about three times the content, and it
matches what the site's own editors consider the front page. Fold it into
`feeds.js::loadHomePopular` so the prefetch path picks it up unchanged; the only
real work is deciding how many rows a TV screen should carry before vertical
navigation gets tedious (suggestion: 热播 for every category, plus 最近更新 for the
two or three categories the user visits most).

**3. 猜你喜欢 on the detail page · S**
`/v1/pub/vod/random/{typeId}/{genreId}/{count}` — the same call the web detail page
makes. Right now the app's detail page ends at the episode grid, so a title the user
doesn't want is a dead end back to the grid they came from. A single shelf below the
episodes turns detail into a browsing surface. `Shelf.jsx` and the detail focus layer
already do everything needed; it's one fetch and one row.

**4. Episode-order toggle and long-list handling · S**
Episodes are hardcoded newest-first (`olevod.js::detail` reverses `urls`). That's right
for a weekly drama and wrong for anything being watched from the start — and 吞噬星空
carries 233 episodes, which is a 39-row grid to scroll through either way. Add a
升序/降序 toggle next to 播放列表 (the web has one), and for anything past ~60 episodes
add range chips (1-50 / 51-100 / …) so the grid stays navigable. Persist the choice
per title alongside the watch state.

### P1 — clear value, more work

**5. 榜单 tab · M**
`/v1/pub/index/vod/data/rank/{day|week|month|all}/{typeId}/{limit}` returns a ranked
top-20 per category. This is one of the better fits for a 10-foot UI: a numbered list
is easy to read from the couch and needs almost no interaction. Structure it like the
Library tab — a segment control for 日/周/月/总, then a row per category. Add it to
`nav.js` as a new tab kind rather than folding it into home.

**6. Synopsis 展开 on the detail page · S**
The synopsis is clamped with `line-clamp-3` and there is no way to read the rest. Give
it a focusable 展开 affordance that expands in place (the detail overlay already
scrolls). Small, but it's a visible "the app is worse than the website" moment.

**7. Player settings panel · M**
T20 was specced and then dropped — the header comment in `PlayerPage.jsx` records the
decision. Worth revisiting now for playback speed (1.0 / 1.25 / 1.5 / 2.0) and a manual
quality override for when ABR picks badly on a weak connection. Both are single video /
hls.js properties; the cost is entirely the panel UI and one more level in the player's
key machine, which is already the most intricate state machine in the app. Keep the
existing "no bottom panel by default" behaviour — the panel should be a deliberate
Down-Down, not something that appears on every seek.

**8. Local search history · S**
The search page opens on hot keywords and forgets everything between sessions. Typing
on a TV remote is expensive enough that repeat searches should be one click. Store the
last ~10 committed keywords (same `createStore` pattern as favorites), show them above
the hot-keyword strip, and add a clear action to the Library settings list next to
清除观看历史.

**9. 简 / 繁 toggle · M**
The web keeps a 繁 switch pinned to the side rail — for an overseas-Chinese audience
this is not cosmetic. The API returns Simplified, so this is a client-side conversion
over rendered text plus a settings toggle. Sizing it honestly: a good conversion table
is a real dependency and everything user-visible has to route through it, which is why
this is M and not S despite sounding trivial.

### P2 — nice to have

**10. Category-page hero and 热门推荐 row · M**
`/v1/pub/index/vod/level/{typeId}/{genre}/{count}` feeds the web's carousel, and
`/v1/pub/vod/rank/week/{typeId}/{genre}/false/{limit}` its 热门推荐 row with 换一批.
Both would enrich the category pages — but a carousel is animation, and the project's
performance red lines rule that out. If this gets built it should be a static featured
card, not a rotating one.

**11. Per-genre hot list on the detail page · S**
`/v1/pub/vod/rank/week/{typeId}/{genreId}/true/{limit}` — the web's detail sidebar.
Largely redundant with item 3 (猜你喜欢); build it only if the random endpoint's
recommendations turn out to be poor in practice.

**12. VIP蓝光影院 (typeId 6) · S, blocked**
One taxonomy entry away from browsable, but the titles are membership-gated. Needs
someone to check whether an anonymous client can play them at all before it's worth
adding a tab that might dead-end at every title.

---

## Endpoint reference

Captured from the web client's own traffic on 2026-07-25. Everything is `GET` under
`https://api.olelive.com`, and everything needs the `?_vv=` signature the app already
generates (`app/src/api/sign.js`).

| Endpoint | Purpose | Used by the app? |
| --- | --- | --- |
| `/v1/pub/index/vod/data/{typeId}` | Home block for one category (最近更新 / 最新添加 / 热播) | no — item 2 |
| `/v1/pub/index/vod/data/rank/{period}/{typeId}/{limit}` | Ranking board; period is `day` / `week` / `month` / `all` | no — item 5 |
| `/v1/pub/index/vod/level/{typeId}/{genreId}/{count}` | Category-page featured carousel | no — item 10 |
| `/v1/pub/vod/rank/{period}/{typeId}/{genreId}/{bool}/{limit}` | Hot list scoped to a genre | no — items 10, 11 |
| `/v1/pub/vod/random/{typeId}/{genreId}/{count}` | 猜你喜欢 / 换一批 | no — item 3 |
| `/v1/pub/vod/list/{flag}/{vip}/{letter}/{area}/{type}/{genre}/{year}/{order}/{page}/{size}` | Filtered listing | yes — `categoryList` |
| `/v1/pub/vod/detail/{id}/{bool}` | Detail + episode URLs | yes — `detail` |
| `/v1/pub/index/search/{keyword}/vod/0/{page}/{size}` | Full-text search | yes — `searchList` |
| `/v1/pub/index/search/keywords/{keyword}` | Autocomplete | yes — `searchSuggest` |
| `/v1/pub/index/search/hot/keywords?limit={n}` | Trending searches | yes — `searchHotKeywords` |
| `/v1/pub/index/live/data/{n}` | Live channels and sports | no — out of scope |
| `/pub/index/message/state` | Account message badge | no — out of scope |

Two notes on the listing endpoint: the app pins `letter` to `0`, so alphabetical
browsing (which the web exposes) is available for free if it ever seems worth a TV
surface; and the web uses `desc` as the `order` value for 最近添加, which the app's
`SORTS` doesn't offer — worth checking whether it differs from the app's `update`.

## Suggested order

Items 1, 3, 4 and 6 are all small, all touch code that already exists, and together
they close the most visible "the website has more than the app" gaps — a reasonable
first pass. Item 2 is the biggest single improvement to what the app feels like on
launch and should follow. Item 5 is the one genuinely new surface and deserves its own
slot rather than being squeezed in alongside anything else.
