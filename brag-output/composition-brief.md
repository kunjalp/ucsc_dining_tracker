# Hyperframes Composition Brief: Sammy's Palate

## Objective
Create a short launch-style brag video for Sammy's Palate, a UCSC dining hall macro tracker.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 20.5 seconds

## Source Material
- Project root: `C:\Users\kunja\ucsc_dining_tracker`
- Primary files read: `README.md`, `web-app/app/page.tsx`, `web-app/app/layout.tsx`, `web-app/app/globals.css`, `web-app/app/dashboard/page.tsx` (grep), `screenshots/log-menu.png`, `screenshots/progress.png`
- Product name: Sammy's Palate
- Tagline / strongest claim: "UCSC Macro Tracker" / the official calculator "doesn't save anything"
- Key UI or visual moment to recreate: (1) Log Menu card for Halal Chicken Nuggets with serving chips and Log button; (2) the four macro progress rings. Reference images: `screenshots/log-menu.png`, `screenshots/progress.png`; logo: `assets/img/sammy-logo-transparent.png`
- Copy that must appear verbatim:
  - UCSC's nutrition calculator saves nothing.
  - Day 1. Every day.
  - Sammy's Palate
  - UCSC MACRO TRACKER
  - Today's Menu (Lunch) / GRILL / Halal Chicken Nuggets / Serving Size: 3 oz
  - 1/4x · 1/2x · 1x · 1.5x · 2x / Log
  - Today's Progress Breakdown
  - Calories 1362 / 2377 kcal · Protein 88 / 178 g · Carbs 140 / 208 g · Fat 61 / 92 g
  - It remembers what you ate.

## Creative Direction
- Tone preset: default
- Creative direction: a friendly roast of the official calculator that forgets everything, then a warm reveal of the app that remembers
- Interpretation: playful and clean pacing, one idea per scene, the UI is the hero, and humor stays dry
- Angle: The official UCSC nutrition calculator has the data but saves nothing, so every day starts from zero. Sammy's Palate scrapes the menus every morning, lets you log in two taps, and fills your macro rings from real logged food.
- Hook: "UCSC's nutrition calculator saves nothing." (typed), then "Day 1. Every day." with a "0 kcal logged" counter.
- Outro / punchline: "Sammy's Palate" then "It remembers what you ate." then a small footer, "On the App Store · ucsc-dining-tracker.vercel.app"
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `#0b1326`, with a soft `#003c6c` glow at ~20% opacity at the top
- Text: `#dae2fd` (muted `#c2c6d0`)
- Accent: `#d6b93a` gold; ring colors calories `#d8b61c`, protein `#5bb448`, carbs `#bd5db8`, fat `#fb7185`; cards `rgba(30,41,59,0.6)` with a thin white/10 border and rounded corners
- Display font: Plus Jakarta Sans 800
- Body font: Plus Jakarta Sans; JetBrains Mono for small uppercase labels
- Visual references from the project: dark navy glass cards, gold Log button, the slug logo, colored macro stat line (gold/green/purple/pink), ring cards

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3.5s — typed "UCSC's nutrition calculator saves nothing." then "Day 1. Every day." with a 0 kcal counter
2. Reveal — 4.0s — slug logo, "Sammy's Palate", "UCSC MACRO TRACKER", "Menus pulled fresh every morning at 6 AM."
3. Log flow — 5.0s — phone frame with Log Menu, cursor taps 1.5x then Log, callout "Pick a serving. Tap Log."
4. Rings — 4.5s — four ring cards arrive one at a time on every other beat, caption "History saved. Every day."
5. Outro — 3.5s — "Sammy's Palate" slam on the 17.02s cue, "It remembers what you ate.", footer, fade out

## Audio
- Audio role: warm bed with sparse professional accents
- Audio arc: quiet key ticks, then a warm lift at the reveal, tactile clicks in the log flow, pops on the ring beats, a soft accent on the final name, music fades out
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`
- Music treatment: low-to-moderate bed, ~0.5s fade-in, fade out over the last ~1.5s under the tagline
- Music cue guidance: bundled preset at `<skill-dir>/assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.json` (~120 BPM; beat grid 3.02, 3.52, 4.02 … 24.52). Strong cues: 17.02 (outro slam, the main lock), optional 8.02 and 12.02 for phone and rings entrances. Ring cards on every other beat: 13.02, 14.02, 15.02, 16.02. Ignore cues when they hurt readability.
- Audio-reactive treatment: subtle; music RMS/bass gently drives the top glow and the logo halo. No waveform bars.
- Audio-coupled moments:
  - Scene 1 hook — typed text with soft key ticks
  - Scene 3 — simulated cursor taps on 1.5x and Log with click and confirm sounds
  - Scene 4 — four ring cards on beats with soft pop and counter ticks
  - Scene 5 — name slam on the 17.02s strong cue
- SFX selection guidance: match motion; repeated sounds should be soft, low high-frequency risk; keep restraint (no comedic stingers).
- SFX analysis guidance: `<skill-dir>/assets/sfx/sfx-analysis.md` if present
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: chosen music is already at `brag-output/composition/assets/music/`; copy chosen SFX into `brag-output/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli`. /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render (short labels ~0.8s settled; sentences ~0.3s per word).
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer.
- Treat music cue metadata as optional timing hints; lock 1-3 strong cues, snap sequential ring reveals within ±0.10s of the beat grid, and mark them `// beat-locked` / `// beat-grid`.
- Use local assets for audio and any media. The Google Fonts stylesheets may be unavailable offline, so fall back to a system sans if Plus Jakarta Sans or JetBrains Mono cannot be loaded locally.
- Run `hyperframes check` before render.
