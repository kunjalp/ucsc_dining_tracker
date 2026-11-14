// Search fields sit in the page under a fixed header and a sticky totals
// bar. When one is focused, iOS scrolls it to the top of the screen, which is
// behind those two. Each field carries a scroll-mt-* class as tall as the
// header + bar; this asks the browser to honor it once the keyboard is up.
const KEYBOARD_OPEN_MS = 350

export function revealBelowStickyBar(el: HTMLElement) {
  window.setTimeout(() => {
    if (document.activeElement === el) el.scrollIntoView({ block: 'nearest' })
  }, KEYBOARD_OPEN_MS)
}
