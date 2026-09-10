/*
 * Business endpoint wrappers. Everything above this layer works with normalized
 * shapes and never sees raw gateway responses or builds URLs by hand.
 */
import { apiGet, apiPost, ApiError } from './http.js'
import { mediaUrl } from './luna.js'

const IMG_BASE = 'https://static.olelive.com/'

// ---------------------------------------------------------------------------
// images
// ---------------------------------------------------------------------------
/**
 * Build a full image URL from a raw relative `pic` path, optionally at a
 * thumbnail size (e.g. '384x560').
 *
 * The CDN's thumbnail form appends the size AFTER the full filename and repeats
 * the source extension: `foo.jpg` -> `foo.jpg_384x560.jpg` (matches the API's
 * own `picThumb` field). Two pitfalls handled:
 *   - the trailing extension must match the SOURCE extension (a `.png` source
 *     becomes `foo.png_384x560.png`, never `..._384x560.jpg`);
 *   - if the path already carries a `_WxH.<ext>` suffix, don't append another
 *     (that 404s, e.g. `..._384x560.jpg_384x560.jpg`).
 */
export function imageUrl(pic, size) {
  if (!pic) return ''
  const full = /^https?:\/\//.test(pic) ? pic : IMG_BASE + pic.replace(/^\/+/, '')
  if (!size) return full
  if (/_\d+x\d+\.[a-zA-Z0-9]+$/.test(full)) return full // already sized — leave it

  const extMatch = full.match(/\.([a-zA-Z0-9]+)$/)
  const ext = extMatch ? extMatch[1] : 'jpg'
  return `${full}_${size}.${ext}`
}

// Pass a media (m3u8) URL through the active transport (unchanged in the
// browser, proxied on the real device).
export function streamUrl(url) {
  return mediaUrl(url)
}

// ---------------------------------------------------------------------------
// normalization
// ---------------------------------------------------------------------------
function normalizeItem(raw) {
  return {
    id: raw.id,
    name: raw.name,
    pic: raw.pic, // raw relative path; sizing is imageUrl's job
    score: raw.score,
    remarks: raw.remarks,
    year: raw.year,
    area: raw.area,
    vip: raw.vip,
    hits: raw.hits,
    vodTime: raw.vodTime,
    typeId: raw.typeId,
  }
}

// ---------------------------------------------------------------------------
// category listing
// ---------------------------------------------------------------------------
/**
 * Filtered, sorted, paginated category listing.
 * Path: /v1/pub/vod/list/{flag}/{vip}/{letter}/{area}/{category}/{genre}/{year}/{order}/{page}/{size}
 * Returns { items, total, page, size }.
 */
export async function categoryList({
  category,
  genre = '0',
  area = '0',
  year = '0',
  sort = 'update',
  page = 1,
  size = 24,
}) {
  const flag = 'true'
  const vip = 3 // never filter by membership tier
  const letter = 0
  const areaSeg = area && area !== '0' ? encodeURIComponent(area) : '0'
  const genreSeg = genre && genre !== '0' ? genre : '0'
  const yearSeg = year && year !== '0' ? year : '0'
  const order = sort || 'update' // must be non-empty or the list comes back null

  const path = `/v1/pub/vod/list/${flag}/${vip}/${letter}/${areaSeg}/${category}/${genreSeg}/${yearSeg}/${order}/${page}/${size}`
  const data = await apiGet(path)

  return {
    items: (data?.list || []).map(normalizeItem),
    total: data?.total || 0,
    page: data?.page || page,
    size: data?.pageSize || size,
  }
}

// ---------------------------------------------------------------------------
// home banners
// ---------------------------------------------------------------------------
/**
 * Featured titles for the home page.
 * Path: /v1/pub/index/banners
 * The endpoint mixes several banner kinds; type 4 is the editorial pick, and
 * its `id` is a vod id the detail page can open directly.
 */
export async function banners() {
  const data = await apiGet('/v1/pub/index/banners')
  return (data || [])
    .filter((b) => b.bannerType === 4)
    .map((b) => ({ id: b.id, title: b.title, pic: b.img, remarks: b.desc }))
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------
// All three search endpoints group results by content type; we only consume
// the `vod` group (`live` etc. are out of scope for this app).
function vodGroup(groups) {
  return (groups || []).find((g) => g.type === 'vod')
}

/**
 * Autocomplete suggestions while typing.
 * Path: /v1/pub/index/search/keywords/{keyword}
 * Returns a deduped list of suggestion words (the API repeats some).
 */
export async function searchSuggest(keyword) {
  const data = await apiGet(`/v1/pub/index/search/keywords/${encodeURIComponent(keyword)}`)
  return [...new Set(vodGroup(data)?.words || [])]
}

/**
 * Trending search terms, shown before the user has typed anything.
 * Path: /v1/pub/index/search/hot/keywords?limit={n}
 */
export async function searchHotKeywords(limit = 10) {
  const data = await apiGet(`/v1/pub/index/search/hot/keywords?limit=${limit}`)
  return [...new Set(vodGroup(data)?.words || [])]
}

/**
 * Full-text search, paginated.
 * Path: /v1/pub/index/search/{keyword}/vod/0/{page}/{size}
 * (the `0` segment is the sub-type filter; 0 = all).
 * Response nests the list one level deeper than categoryList:
 * data = { total, data: [{ type: 'vod', list: [...] }] }.
 */
export async function searchList({ keyword, page = 1, size = 24 }) {
  const data = await apiGet(
    `/v1/pub/index/search/${encodeURIComponent(keyword)}/vod/0/${page}/${size}`,
  )
  const list = vodGroup(data?.data)?.list || []
  return {
    items: list.map(normalizeItem),
    total: data?.total || 0,
    page,
    size,
  }
}

// ---------------------------------------------------------------------------
// detail
// ---------------------------------------------------------------------------
/**
 * Title detail + episode list. The `urls[]` array inlines each episode's m3u8,
 * reversed so the newest episode is first. Synopsis is `content` (not `blurb`).
 */
export async function detail(id) {
  const d = await apiGet(`/v1/pub/vod/detail/${id}/true`)
  const episodes = (d?.urls || [])
    .slice()
    .reverse()
    .map((u) => ({
      index: u.index,
      title: u.title,
      url: u.url,
      vip: u.vip,
      seekStart: u.seek_start,
      seekEnd: u.seek_end,
    }))

  return {
    id: d.id,
    title: d.name,
    pic: d.pic,
    rating: d.score,
    year: d.year,
    region: d.area,
    genreName: d.typeIdName,
    director: d.director,
    cast: d.actor,
    remarks: d.remarks,
    synopsis: d.content, // detail synopsis field is `content`
    episodeCount: episodes.length, // d.total is unreliable; derive from urls
    episodes,
  }
}

// ---------------------------------------------------------------------------
// account (POST endpoints: no `v1` prefix, no `_vv`)
// ---------------------------------------------------------------------------
/**
 * A fresh captcha challenge. Every call invalidates the previous image.
 * Path: POST /pub/captcha
 * `image` is a `data:image/png;base64,...` URI (160x80, transparent background,
 * four digits).
 */
export async function captcha() {
  const d = await apiPost('/pub/captcha')
  if (!d?.captchaId || !d?.picPath) throw new Error('empty captcha')
  return { id: d.captchaId, image: d.picPath }
}

/**
 * Exchange credentials + captcha answer for a session.
 * Path: POST /pub/user/login
 * Returns { token, name, userId }; `token` is the three-part value http.js
 * splits into _he/_pl/_si.
 */
export async function login({ username, password, captcha: answer, captchaId }) {
  const d = await apiPost('/pub/user/login', {
    username,
    password,
    captcha: answer,
    captcha_id: captchaId,
  })
  if (!d?.token) throw new ApiError('登录失败，请重试', -1)
  const user = d.user || {}
  return {
    token: d.token,
    name: user.userNickName || user.userName || '已登录',
    userId: user.userId != null ? String(user.userId) : '',
  }
}

/**
 * The signed-in account's profile. groupId 3 = active VIP.
 * Path: POST /pub/user/info (code 12 when called without a session)
 */
export async function userInfo() {
  const d = await apiPost('/pub/user/info')
  return { userId: d?.userId, groupId: d?.groupId }
}
