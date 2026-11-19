\# Sammy's Palate (UCSC dining hall macro tracker)



\## What this is

A web app that lets UCSC students track macros from dining hall menus.

\- Frontend: Next.js 16 (App Router) + React + Tailwind v4, in `web-app/`

\- Backend: Supabase (auth, Postgres). Auth `user\_metadata` holds dietary\_preferences, text\_size, mascot\_animations, favorites.

\- iOS: Capacitor wrapper that loads the live Vercel site (https://ucsc-dining-tracker.vercel.app/). UI changes reach the iPhone app when merged to main.

\- Scraper: Python + Playwright, run by GitHub Actions.



\## Where to edit

\- Only edit under `web-app/app` and `web-app/lib`.

\- New database changes go in new files under `web-app/supabase/\*.sql`. Do not run them; I run them in the Supabase SQL Editor.

\- Do NOT touch the scraper, backend, or GitHub workflows unless I ask.



\## Data

\- Tables: `food\_items`, `daily\_menus` (columns: id, date, dining\_hall, meal\_type, station, food\_item\_id, created\_at), `meal\_logs`, `saved\_recipes`.

\- PostgREST returns at most 1000 rows. Page large reads, or use an RPC that returns one jsonb value.

\- Dining halls (cafes and markets are excluded): John R. Lewis \& College Nine, Cowell \& Stevenson, Crown \& Merrill, Porter \& Kresge, Rachel Carson \& Oakes.



\## UI rules

\- Use the existing Tailwind tokens: `bg-surface`, `bg-surface-2`, `text-fg`, `text-fg-muted`, `text-gold`, `text-sky`, `macro-\*`. Do not add hard-coded colors.

\- Keep the 93.75% default text size.

\- Respect Reduce Motion and Reduce Transparency.

\- Tap targets at least 44px (`size-tap`, `min-h-btn`). Use `text-input` for inputs so iOS does not zoom.

\- Keep haptics (`@capacitor/haptics`) and spring sheet behavior.

\- Do not use boxes inside boxes or pills inside pills. Prefer plain text and fewer containers.

\- No new libraries unless I approve them first.



## Design rules (the "ledger" look)

The look: dark navy (`bg-app`) with gold. Content is plain text rows straight on the page background, split by hairlines, not cards. Gold marks one thing per screen (the main action or the selected state). No boxes inside boxes, no pills inside pills. Applies to Menu, Browse, Recipes, Progress and the header.

### Tokens (`web-app/app/globals.css`, `@theme static`)
- Hairline: `line` (`border-line`, `divide-line`, `bg-line`). It is 8% white and goes to 40% under Increase Contrast. Do not use `border-white/10` or `bg-white/5` for new dividers or fills.
- Radii: controls (buttons, inputs, steppers, Filters button) `rounded-lg`. Banners and cards `rounded-2xl`. Sheets `rounded-t-2xl`. Full-width sheet buttons (Done) `rounded-xl`. `rounded-full` only for the tab bar, switches, dots, avatar, the sheet grab handle, icon-only close buttons, and the station chips in `FiltersSheet`.
- Type: `text-9`, `text-10`, `text-11` (named for px at the default size), then `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`. Inputs use `text-input`. No arbitrary `text-[..px]`. Weights: `font-medium` (muted), `font-semibold` (names, emphasis), `font-bold` (buttons, headings). No `font-black`. Use `tabular-nums` on numbers.
- Colors: tokens only (`app`, `surface`, `surface-2`, `fg`, `fg-muted`, `fg-subtle`, `gold`, `on-gold`, `sky`, `danger`, `line`). No hex, no `text-[#...]`, no opacity on muted text. Tints like `bg-gold/15` are fine.
- Serif numerals: `font-numeral` (Source Serif 4, Georgia fallback, lining tabular figures; utility in `globals.css`, font loaded in `layout.tsx`) is for big numbers only: Progress ring percents and "N left/over", and the Analytics sheet's stat values and totals. Labels, units and body text stay in the sans. A number with a target reads big serif number + small muted sans `/target` (for example "81 /96g").
- Macro colors (`macro-cal/protein/carbs/fat`) belong to the Progress rings (`ProgressRing` in `dashboard/page.tsx`) and the Analytics sheet's macro split (the held bar's segments and popup dots in `dashboard/WeekAnalytics.tsx`). Do not add them elsewhere. Existing exceptions (logged check, favorite heart, error text) stay as they are.

### Reuse these, do not fork them
- Food row: `app/components/FoodRow.tsx`, used by Menu and Browse. Name with chevron (opens the food sheet), two `text-xs text-fg-muted` lines (portion and cal, then P/C/F), `FavoriteButton` heart, a quiet `1×` button that opens the stepper under the row, and a tinted Log (`bg-gold/15 text-gold`, becomes a green check once logged). Rows sit in `divide-y divide-line`. Need something new? Add a prop.
- Section header: the sticky station `<h3>` in `dashboard/page.tsx` (search "cleanStationName(parent)"): `text-base font-semibold`, item count on the right in `text-fg-muted`, a hairline under it. Progress meal groups use `text-xs font-bold uppercase tracking-wider` with the calorie total on the right.
- Filters: `FiltersButton` and `FiltersSheet` in `app/components/FiltersSheet.tsx`. The button sits beside the search field and shows a gold dot when a filter is on. The sheet holds diet Show/Hide, Favorites only, and stations. Browse adds `halls` and `sort`. Add new filters there, not as extra chips on the page.
- "Log to" line: plain text `Log to {meal}` plus a chevron that opens a radio sheet (`BrowseTab.tsx`, `RecipesTab.tsx`). No box around it.
- Macro bar: the sticky "cal left" line with the 2px gold calorie bar under the header (`dashboard/page.tsx`, search "What's left today"). Menu and Browse only. It previews a row's servings while the stepper is in use.
- Delete: meal history rows on Progress swipe left past `SWIPE_DELETE_THRESHOLD` and always have a visible trash button. Deleting shows an undo toast (`handleDeleteLog`). Swipe is a shortcut, never the only way. Inline deletes (recipe delete, Remove photo) use `ConfirmTapButton` (`app/components/ConfirmTapButton.tsx`): first tap turns the label red "Tap again to delete" for 3 seconds, second tap deletes. Do not hand-roll this.
- Empty, loading and error states: `EmptyState` and `LoadingRows` in `app/components/EmptyState.tsx`. One short muted line (red only for errors) plus at most one quiet text action. No card, no pill button, no Sammy.
- Sheets: always `BottomSheet` (`app/components/BottomSheet.tsx`) with `SheetCloseButton`. It locks background scroll (`lockScroll` in `lib/scrollLock.ts`, counted so stacked sheets work). Never a hand-rolled modal for new work.

### Sammy
One live Sammy, in the header (`dashboard/page.tsx`, "The one live Sammy"). He reacts to logs, ring closes and errors from there. No inline Sammy in lists, rows, or empty, loading and error states. None on Progress.

### Must not regress
- Haptics: `Haptics.selectionChanged()` on taps that change state, `NotificationType.Success` on a log.
- Spring sheets: drag to dismiss, rubber band, velocity (`@/lib/spring`).
- Text size: html is 93.75% and the Text size setting scales it. Use rem sizes, never px, so it scales.
- Reduce Motion: `motion-reduce:` variants, the `press` utility, and `useReducedMotion` for JS animation.
- Reduce Transparency: use `glass-bar` and `glass-scrim` on translucent chrome so they go solid.
- Tap targets 44px: `min-h-tap`, `size-tap`, `min-h-btn` with the `after:` padding trick.

### Before finishing any UI change
1. `npx tsc --noEmit` in `web-app/`.
2. Screenshot at 390px, light and dark.
3. Open Menu, Browse, Recipes and Progress. Rows, headers, dividers and radii must still match each other.
4. Grep your diff for `#`, `rounded-full`, `font-black`, `macro-` and `bg-white/`. Each hit needs a reason.
5. Tell me what to check on my phone (haptics, sheet drag, swipe delete, Text size).

\## Checks before saying you are done

\- Run `npx tsc --noEmit` inside `web-app/` and fix errors.

\- For UI changes, run the dev server and take a screenshot at phone width (390px) in light and dark.

\- Tell me what I need to check on my phone, because you cannot see it.



\## Git

\- Do not commit or push unless I ask.

\- When I ask, make small commits, one per change, so Vercel rollback stays useful.

\- Rollback path: Vercel > Deployments > previous deployment > Promote to Production. Vercel does not roll back database changes.

