/*
 * Top tab bar. Renders the shell's ordered tabs (nav.js orderedTabs, applied in
 * App.jsx) as focus group "tabbar" (row 0, col=index) in the "home" focus layer.
 *
 * Three zones on one focus row: tabs with an icon render as round glass
 * buttons — the ones before 首页 (搜索) hug the left safe margin, the ones after
 * the last text tab (收藏 / 历史 / 设置 / 账号) hug the right — and the text tabs
 * sit in the centered glass capsule between them. Because col is the index in
 * the full list, Left/Right walk straight across all three zones.
 *
 * Hover-switching: moving focus left/right across tabs switches the content area
 * below after a 150ms debounce (focus stays on the tab bar). Only Enter/click
 * commits — it switches immediately and bumps the tab's refresh nonce so the
 * page refetches (wired in T15). Down leaves the bar for the content area.
 *
 * The white focus fill slides between the capsule's tabs via useSlidingCursor;
 * see that hook for the animation and the cursor-vs-selection rules. Icon
 * buttons sit outside the capsule, so the sliding pill does not serve them:
 * each is its own pill instead, a circle at rest that grows sideways on focus
 * to show its label beside the icon and shrinks back when the cursor leaves.
 * Both directions animate through the Web Animations API, the same sanctioned
 * mechanism as the sliding pill (the CSS transition/animation ban does not
 * cover WAAPI, see styles/index.css).
 */
import { useLayoutEffect, useRef } from 'react'
import { getCurrentFocus, useFocusable } from '../hooks/useFocus.js'
import { useSlidingCursor } from '../hooks/useSlidingCursor.js'

// 24-grid line icons, keyed by tab.icon.
const ICONS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4.5 4.5" />
    </>
  ),
  bookmark: <path d="M6 3h12v18l-6-4-6 4z" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  gear: (
    <>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
}

function useTabFocus({ col, onHover, onSelect, onFocusChange }) {
  return useFocusable({
    layer: 'home',
    group: 'tabbar',
    row: 0,
    col,
    onSelect,
    onFocusChange: (focused) => {
      if (focused) onHover()
      onFocusChange?.(focused)
    },
  })
}

function TabItem({ tab, col, active, showSelection, onHover, onSelect }) {
  const { props } = useTabFocus({ col, onHover, onSelect })
  // The sliding white pill IS the focus fill, so the focused tab clears its own
  // background to let the pill show through and flips its label to dark text —
  // the same white-fill/dark-text look the old instant `.focused` state had.
  // The active tab's glass selection mark shows only when focus is off the bar
  // (showSelection), so it never trails the moving cursor.
  return (
    <div
      className={`relative z-1 rounded-full px-7 py-2 text-label focused:bg-transparent focused:text-inverse ${active && showSelection ? 'bg-glass-active text-fg' : 'text-fg-2'}`}
      {...props}
    >
      {tab.label}
    </div>
  )
}

// Geometry of an icon pill, mirroring its classes below: the collapsed circle
// is 1px border + 14px padding + 26px icon + 14px padding + 1px border, and
// expanding adds the gap, the label at its natural width, and the extra right
// padding that keeps the label off the pill's round end (the icon keeps the
// circle's symmetric 14px; only the text side is widened).
const PILL_SIZE = 56 // size-14
const PILL_GAP = 10 // gap-2.5
const PILL_LABEL_PAD = 5 // pr-[19px] over the circle's own 14px
const EXPAND_MS = 140

// Size the pill around `label` for `expanded`, sliding there from wherever it
// is now. The pill is reached through the label because the focus engine owns
// the button's own ref (it re-asserts `.focused` through it) and its props are
// spread last, so a second ref on that element would be dropped.
//
// The label never shrinks (shrink-0) and is clipped by overflow-hidden while
// collapsed, so its box is always its natural width and measuring it needs no
// reflow of the button. The target is written to the element's own style
// first, then animated from the previous width, so the resting state is real
// CSS and nothing accumulates — the same approach as the sliding cursor.
// Opacity rides along, so a half-open pill never shows a sliced word.
function sizePill(label, expanded, animate) {
  const el = label?.parentElement
  if (!el) return
  const from = el.getBoundingClientRect().width
  const to = expanded
    ? PILL_SIZE + PILL_GAP + Math.ceil(label.getBoundingClientRect().width) + PILL_LABEL_PAD
    : PILL_SIZE
  const opacity = expanded ? 1 : 0

  el.getAnimations().forEach((a) => a.cancel())
  label.getAnimations().forEach((a) => a.cancel())
  el.style.width = `${to}px`
  label.style.opacity = `${opacity}`
  if (!animate || from === to) return

  el.animate([{ width: `${from}px` }, { width: `${to}px` }], { duration: EXPAND_MS, easing: 'ease' })
  label.animate([{ opacity: 1 - opacity }, { opacity }], { duration: EXPAND_MS, easing: 'ease' })
}

// Glass pill: the same material and lift as the capsule, the instant white
// fill on focus, and the glass selection mark when it is the active tab and
// the cursor is elsewhere. A circle showing just the icon until focus expands
// it into icon + label.
function IconTab({ tab, col, active, showSelection, onHover, onSelect }) {
  const labelRef = useRef(null)
  const expandedRef = useRef(false)

  const setExpanded = (expanded, animate) => {
    expandedRef.current = expanded
    sizePill(labelRef.current, expanded, animate)
  }
  const { id, props } = useTabFocus({ col, onHover, onSelect, onFocusChange: (f) => setExpanded(f, true) })

  // onFocusChange only fires on a focus MOVE, so a button that mounts (or
  // remounts, when the tab list reorders) already focused would sit collapsed
  // under the cursor. Re-assert the width after every commit, without animating
  // into it. The engine's current id is the authority, NOT the `.focused` class
  // on the element: React rewrites className whenever this tab's active state
  // changes, which drops that class for the rest of the commit, and reading it
  // here would collapse the pill under the cursor and pop it back open.
  useLayoutEffect(() => {
    const focused = getCurrentFocus() === id
    if (focused !== expandedRef.current) setExpanded(focused, false)
  })

  return (
    <div
      className={`glass flex size-14 items-center gap-2.5 overflow-hidden rounded-full border border-glass-edge pr-[19px] pl-[14px] shadow-[0_8px_28px_rgba(0,0,0,0.35)] focused:bg-focus focused:text-inverse ${active && showSelection ? 'bg-glass-active text-fg' : 'text-fg-2'}`}
      aria-label={tab.label}
      {...props}
    >
      <svg
        className="shrink-0"
        viewBox="0 0 24 24"
        width="26"
        height="26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONS[tab.icon]}
      </svg>
      <span ref={labelRef} className="shrink-0 whitespace-nowrap text-label opacity-0">
        {tab.label}
      </span>
    </div>
  )
}

export default function TabBar({ tabs, activeTab, onHoverTab, onCommitTab }) {
  const debounceRef = useRef(null)
  const capsuleRef = useRef(null)

  const activeIndex = tabs.findIndex((t) => t.key === activeTab)
  const { pillProps, cursorOnBar } = useSlidingCursor({
    containerRef: capsuleRef,
    group: 'tabbar',
    activeIndex,
    revision: tabs, // re-measure when the tab list reorders
  })

  // Zones by position: icon tabs before the first text tab, the text tabs, icon
  // tabs after the last one. `col` stays the index in `tabs` throughout.
  const firstText = tabs.findIndex((t) => !t.icon)
  const lastText = tabs.length - 1 - [...tabs].reverse().findIndex((t) => !t.icon)
  const zone = (i) => (i < firstText ? 'leading' : i > lastText ? 'trailing' : 'capsule')

  const render = (tab, i) => {
    const shared = {
      key: tab.key,
      tab,
      col: i,
      active: tab.key === activeTab,
      showSelection: !cursorOnBar,
      onHover: () => {
        clearTimeout(debounceRef.current)
        // Debounce so quickly passing through tabs doesn't flash a load.
        debounceRef.current = setTimeout(() => onHoverTab(tab.key), 150)
      },
      onSelect: () => {
        clearTimeout(debounceRef.current)
        onCommitTab(tab.key)
      },
    }
    return tab.icon ? <IconTab {...shared} /> : <TabItem {...shared} />
  }
  const inZone = (name) => tabs.map((t, i) => (zone(i) === name ? render(t, i) : null))

  return (
    // The bar itself is fully transparent (z-1 keeps it above the tab-content
    // scrollers that extend beneath it); the glass lives on the capsule and the
    // round buttons so content scrolling past shows through around them. The
    // 1fr side columns keep the capsule centered however many buttons flank
    // it. The shadow is a static lift, painted once.
    <div className="absolute inset-x-0 top-0 z-1 grid h-21 grid-cols-[1fr_auto_1fr] items-center px-safe pt-5">
      <div className="flex gap-3 justify-self-start">{inZone('leading')}</div>
      <div
        ref={capsuleRef}
        className="glass relative flex items-center gap-2 rounded-full border border-glass-edge px-2.5 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
      >
        {/* The single sliding white focus pill, behind the tabs (z-0). */}
        <div {...pillProps} />
        {inZone('capsule')}
      </div>
      <div className="flex gap-3 justify-self-end">{inZone('trailing')}</div>
    </div>
  )
}
