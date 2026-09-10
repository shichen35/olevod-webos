/*
 * Category taxonomy — the single configuration-driven extension point for
 * navigation. Adding a category here makes it appear in the tab bar (nav.js),
 * get a route, and gain a category page automatically; no other file changes.
 *
 * Option data (genres/areas/years) is captured from the live API
 * (/v1/pub/vod/list/type) and frozen here as static config so the first paint
 * never waits on a network round trip. GUI labels are intentionally Chinese —
 * the app's interface language is Chinese.
 *
 * Sentinel value '0' means "All" for the genre/area/year filter segments.
 */

// Shared across categories (identical in the live data).
const YEARS = [
  '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2018',
  '2017', '2016', '2015', '2014', '2013', '2012', '2011', '2010', '2009',
  '2008', '2007', '2006', '2005', '2004', '2003', '2002', '2001', '2000',
]

const AREAS_COMMON = [
  '大陆', '香港', '台湾', '美国', '韩国', '日本', '印度', '英国', '法国',
  '加拿大', '西班牙', '俄罗斯', '意大利', '泰国', '新加坡', '马来西亚', '其它',
]

// Movies carry an extra region (德国) in the live data.
const AREAS_MOVIE = [
  '大陆', '香港', '台湾', '美国', '韩国', '日本', '印度', '英国', '法国',
  '加拿大', '西班牙', '德国', '俄罗斯', '意大利', '泰国', '新加坡', '马来西亚', '其它',
]

// Turn a genre id/name list into filter options with an "All" entry up front.
function genreOptions(pairs) {
  return [{ value: '0', label: '全部' }, ...pairs.map(([id, label]) => ({ value: String(id), label }))]
}
function stringOptions(values) {
  return [{ value: '0', label: '全部' }, ...values.map((v) => ({ value: v, label: v }))]
}

// Sort options apply to every category. The `order` segment must never be empty
// (an empty order makes the server return total-only with a null list).
// Membership range — the list path's `member` segment. 3 returns everything,
// 1 only member titles (empty outside VIP Blu-ray), 2 only free ones.
export const MEMBERS = [
  { value: '3', label: '全部影片' },
  { value: '1', label: '会员' },
  { value: '2', label: '免费' },
]
export const DEFAULT_MEMBER = '3'

export const SORTS = [
  { value: 'update', label: '最新' },
  { value: 'hot', label: '最热' },
  { value: 'score', label: '评分' },
]
export const DEFAULT_SORT = 'update'

// Display order: Movies, TV Series, Variety, Anime, Short Drama, VIP Blu-ray
// (typeIds 1, 2, 3, 4, 14, 6). VIP titles only play for a signed-in VIP session; the detail page
// gates playback (DetailPage.jsx), the tab itself is always shown.
export const CATEGORIES = [
  {
    id: 1,
    name: '电影',
    genres: genreOptions([
      [101, '动作片'], [102, '喜剧片'], [103, '爱情片'], [104, '科幻片'],
      [105, '恐怖片'], [106, '剧情片'], [107, '战争片'], [108, '动画片'],
      [109, '悬疑片'], [110, '惊悚片'], [111, '纪录片'], [112, '奇幻片'],
      [113, '犯罪片'],
    ]),
    areas: stringOptions(AREAS_MOVIE),
    years: stringOptions(YEARS),
  },
  {
    id: 2,
    name: '连续剧',
    genres: genreOptions([
      [202, '国产剧'], [201, '欧美剧'], [203, '港台剧'], [204, '日韩剧'], [1207, '短剧'],
    ]),
    areas: stringOptions(AREAS_COMMON),
    years: stringOptions(YEARS),
  },
  {
    id: 3,
    name: '综艺',
    genres: genreOptions([
      [305, '真人秀'], [302, '音乐'], [304, '搞笑'], [301, '家庭'], [303, '曲艺'],
    ]),
    areas: stringOptions(AREAS_COMMON),
    years: stringOptions(YEARS),
  },
  {
    id: 4,
    name: '动漫',
    genres: genreOptions([
      [401, '日本'], [402, '国产'], [403, '欧美'],
    ]),
    areas: stringOptions(AREAS_COMMON),
    years: stringOptions(YEARS),
  },
  {
    id: 14,
    name: '短剧',
    genres: genreOptions([
      [1209, '言情'], [1210, '都市'], [1211, '甜宠'], [1212, '逆袭'],
      [1213, '玄幻'], [1214, '仙侠'], [1215, '穿越'], [1216, '重生'],
      [1217, '王妃'], [1218, '总裁'], [1219, '离婚'], [1220, '其他'],
    ]),
    // Short dramas carry the movie region list (德国 included) in the live data.
    areas: stringOptions(AREAS_MOVIE),
    years: stringOptions(YEARS),
  },
  {
    // Upstream name 「VIP蓝光影院」, shortened for the tab bar.
    id: 6,
    name: 'VIP蓝光',
    genres: genreOptions([
      [601, '动作片'], [602, '喜剧片'], [603, '爱情片'], [604, '科幻片'],
      [605, '恐怖片'], [606, '剧情片'], [607, '战争片'], [608, '动画片'],
      [609, '悬疑片'], [610, '惊悚片'], [611, '纪录片'], [612, '奇幻片'],
      [613, '犯罪片'],
    ]),
    areas: stringOptions(AREAS_COMMON),
    years: stringOptions(YEARS),
  },
]

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === Number(id)) || null
}
