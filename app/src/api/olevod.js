/*
 * Business endpoint wrappers. Everything above this layer works with normalized
 * shapes and never sees raw gateway responses or builds URLs by hand.
 * See doc/olevod-api.md §4.3-§4.4 for the underlying endpoints.
 */
import { apiGet } from './http.js'
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
