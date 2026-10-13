// web-app/lib/textSize.ts
// The "Text size" setting in Edit Profile. Each option is the root <html>
// font-size, so every rem-based size in the app scales with it. 'default'
// (93.75%) is the size globals.css ships with -- picking it leaves the app
// looking exactly as it always has.
//
// Persisted two places: Supabase user_metadata.text_size (follows the
// student across devices) and localStorage (read by the inline script in
// app/layout.tsx before first paint, so there's no flash of the wrong size).

export type TextSize = 'small' | 'default' | 'large' | 'xlarge'

export const TEXT_SIZE_OPTIONS: { value: TextSize; label: string; fontSize: string }[] = [
  { value: 'small', label: 'Small', fontSize: '87.5%' },
  { value: 'default', label: 'Default', fontSize: '93.75%' },
  { value: 'large', label: 'Large', fontSize: '106%' },
  { value: 'xlarge', label: 'Extra Large', fontSize: '120%' },
]

export const DEFAULT_TEXT_SIZE: TextSize = 'default'
export const TEXT_SIZE_STORAGE_KEY = 'text-size'

export function isTextSize(value: unknown): value is TextSize {
  return TEXT_SIZE_OPTIONS.some((o) => o.value === value)
}

// Sets the <html> font-size for this page view. Doesn't persist anything.
export function applyTextSize(size: TextSize) {
  const option = TEXT_SIZE_OPTIONS.find((o) => o.value === size)
  if (!option) return
  // 'default' clears the inline style so globals.css's 93.75% applies.
  document.documentElement.style.fontSize = size === DEFAULT_TEXT_SIZE ? '' : option.fontSize
}

// Applies the size and remembers it on this device for the next first paint.
export function setLocalTextSize(size: TextSize) {
  applyTextSize(size)
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size)
  } catch {
    // Private mode / storage blocked: the size still applies for this visit.
  }
}

// Inline <head> script for app/layout.tsx. Runs during HTML parsing, before
// React loads, so a saved non-default size is in place for the first paint.
export const TEXT_SIZE_BOOT_SCRIPT = `(function(){try{var m=${JSON.stringify(
  Object.fromEntries(TEXT_SIZE_OPTIONS.filter((o) => o.value !== DEFAULT_TEXT_SIZE).map((o) => [o.value, o.fontSize]))
)};var s=localStorage.getItem(${JSON.stringify(TEXT_SIZE_STORAGE_KEY)});if(s&&m[s])document.documentElement.style.fontSize=m[s]}catch(e){}})()`

// The size saved on this device, or 'default' if none (or storage is blocked).
export function getLocalTextSize(): TextSize {
  try {
    const saved = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    if (isTextSize(saved)) return saved
  } catch {}
  return DEFAULT_TEXT_SIZE
}
