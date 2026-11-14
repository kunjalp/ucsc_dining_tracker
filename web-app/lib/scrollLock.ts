// Background scroll lock for overlays. Plain `overflow: hidden` on body does
// not stop iOS Safari / the Capacitor WebView from scrolling the page, so the
// body is pinned with position: fixed at the current scroll offset, and the
// exact offset is restored on unlock. A lock count (not a boolean) keeps it
// correct when sheets stack or unmount out of order.

let count = 0
let savedY = 0
let saved: { position: string; top: string; left: string; right: string; width: string; paddingRight: string } | null = null

export function lockScroll() {
  if (typeof document === 'undefined') return
  count += 1
  if (count > 1) return
  const body = document.body
  const root = document.documentElement
  savedY = window.scrollY
  const scrollbar = window.innerWidth - root.clientWidth
  saved = {
    position: body.style.position,
    top: body.style.top,
    left: body.style.left,
    right: body.style.right,
    width: body.style.width,
    paddingRight: body.style.paddingRight,
  }
  body.style.position = 'fixed'
  body.style.top = `-${savedY}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  // Desktop: keep the layout from shifting when the scrollbar disappears
  if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`
}

export function unlockScroll() {
  if (typeof document === 'undefined' || count === 0) return
  count -= 1
  if (count > 0) return
  const body = document.body
  if (saved) {
    body.style.position = saved.position
    body.style.top = saved.top
    body.style.left = saved.left
    body.style.right = saved.right
    body.style.width = saved.width
    body.style.paddingRight = saved.paddingRight
    saved = null
  }
  // 'instant' so a smooth-scroll rule on html can't animate the restore
  window.scrollTo({ top: savedY, left: 0, behavior: 'instant' })
}
