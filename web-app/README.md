# Sammy's Palate — Web App

This is the Next.js frontend for [Sammy's Palate](../README.md), a macro and nutrition tracker for UC Santa Cruz dining halls.

For the full project overview — features, architecture, and the Python scraper — see the [main README](../README.md).

## Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

Create a `.env.local` file in this folder with:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

## Tech Stack

- **Next.js** (App Router) + TypeScript
- **Supabase** — auth, database, storage
- **Tailwind CSS**
- **Capacitor** — wraps this app as a native iOS app

## Project Structure

```
app/
  page.tsx              # Sign in / sign up
  dashboard/             # Main app (menu, progress, logging)
  onboarding/            # Post-signup target-setting flow
  auth/                  # Auth callback, password reset
  privacy/               # Privacy policy page
lib/
  supabase.ts             # Supabase client
  diningHours.ts          # Instant open/closed status from published hours
  stationClassifier.ts   # Name-based menu categorization fallback
```

## iOS Build

This app is wrapped as a native iOS app via Capacitor and built through Codemagic. See `codemagic.yaml` in the repo root for the CI/CD pipeline.