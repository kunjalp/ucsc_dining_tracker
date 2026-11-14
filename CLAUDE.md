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



\## Checks before saying you are done

\- Run `npx tsc --noEmit` inside `web-app/` and fix errors.

\- For UI changes, run the dev server and take a screenshot at phone width (390px) in light and dark.

\- Tell me what I need to check on my phone, because you cannot see it.



\## Git

\- Do not commit or push unless I ask.

\- When I ask, make small commits, one per change, so Vercel rollback stays useful.

\- Rollback path: Vercel > Deployments > previous deployment > Promote to Production. Vercel does not roll back database changes.

