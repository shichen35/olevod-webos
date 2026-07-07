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
export const SORTS = [
  { value: 'update', label: '最新' },
  { value: 'hot', label: '最热' },
  { value: 'score', label: '评分' },
]
export const DEFAULT_SORT = 'update'

// Display order: Movies, Variety, TV Series (typeIds 1, 3, 2 respectively).
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
    id: 3,
    name: '综艺',
    genres: genreOptions([
      [305, '真人秀'], [302, '音乐'], [304, '搞笑'], [301, '家庭'], [303, '曲艺'],
    ]),
    areas: stringOptions(AREAS_COMMON),
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
]

export function getCategory(id) {
  return CATEGORIES.find((c) => c.id === Number(id)) || null
}
