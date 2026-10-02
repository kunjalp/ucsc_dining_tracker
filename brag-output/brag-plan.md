# Brag Plan: Sammy's Palate

## What is this app?
A macro tracker built for UC Santa Cruz dining halls: a scraper pulls every hall's menu each morning, you log what you eat in two taps, and your calorie/protein/carb/fat rings fill up, with history saved. Live on the web and on the iOS App Store.

## The angle
The official UCSC nutrition calculator has all the data but forgets everything you eat: "it doesn't save anything. Every day starts from zero." The video is a gentle roast of that amnesia. It opens on a calculator that starts over every day, then Sammy the banana slug shows up and remembers. The payoff is the four macro rings filling from real logged food, a working app moment rather than a feature list.

## Hook (first 2-3 seconds)
Big type on the dark navy ground: **"UCSC's nutrition calculator saves nothing."** Then a second beat that lands the joke: **"Day 1. Every day."** with a "0 / 2377 kcal" style counter snapping back to zero. The viewer instantly gets the pain point, and it is specific to UCSC.

## Key moments (the middle)
- **Reveal:** Sammy the banana slug logo (`web-app/public/sammy-logo-transparent.png`) with the wordmark "Sammy's Palate" and "UCSC MACRO TRACKER".
- **Log it in two taps:** a recreation of the Log Menu, "Today's Menu (Lunch)", GRILL station, Halal Chicken Nuggets (Serving Size: 3 oz, Cals 182, P 14.5g, C 14.5g, F 6g). A cursor taps the 1.5x serving chip, then taps the gold **Log** button. The header totals tick up.
- **The rings fill:** "Today's Progress Breakdown" with four rings arriving one by one: Calories 57% (1362 / 2377 kcal), Protein 49% (88 / 178 g), Carbs 67% (140 / 208 g), Fat 67% (61 / 92 g). These are the real values from `screenshots/progress.png`.

## Outro / punchline
**"Sammy's Palate."** then **"It remembers what you ate."** then a small line: "On the App Store · ucsc-dining-tracker.vercel.app". The final beat pays off the hook (saves nothing, so it remembers).

## User flow worth showing
1. Entry: Log Menu with a dining hall's lunch menu (stations, serving chips).
2. Key action: pick a serving size (1.5x), tap Log.
3. Result: Progress rings fill against daily targets.

## Tone
- Preset: default
- Creative direction: a friendly roast of the official calculator, followed by a warm "finally, something that remembers" reveal
- Interpretation: playful and clean, with one idea per scene and room to breathe. The joke comes from the calculator's amnesia, not from wacky visuals, and the UI is the hero.

## Format: vertical — 1080x1920
Product screens are portrait, so they appear as phone-shaped frames centered or offset against wide type. (`--format vertical` is an easy re-run if this is for Reels/TikTok.)

## Duration: 20.5s

## Visual identity (from the project)
- Background: `#0b1326` (auth page) with a soft `#003c6c` glow at the top; cards `rgba(30,41,59,0.6)` / `#1e293b`
- Accent: `#d6b93a` gold (buttons, brand), ring colors: calories `#d8b61c`, protein `#5bb448`, carbs `#bd5db8`, fat `#fb7185`; station chips light blue `#93c5fd`-ish
- Text: `#dae2fd`, muted `#c2c6d0`
- Display font: Plus Jakarta Sans (800)
- Body font: Plus Jakarta Sans; JetBrains Mono for small uppercase labels
- Strongest visual element: the four macro progress rings, plus the Sammy slug logo

## Share copy (draft)
I built a macro tracker for UCSC dining halls because the official calculator forgets everything you eat. Sammy's Palate is on the App Store now.

## Audio direction
- Role: warm bed with sparse professional accents
- Music: `happy-beats-business-moves-vol-1-by-ende-dot-app.mp3`, an upbeat, friendly business groove
- Music treatment: starts at 0s at a low-to-moderate level with a short fade-in, sits under everything, fades out over the last ~1.5s under the final tagline
- Music cue guidance: preset read from `assets/music/cues/happy-beats-business-moves-vol-1-by-ende-dot-app.music-cues.md`. About 120 BPM (beats every ~0.5s, grid starts at 3.02s). Strong cues to lock: 17.02s (outro name slam, cut from rings to logo), and optionally 12.02s (rings scene entrance) and 8.02s (Log Menu phone entrance) from the beat grid. Sequential ring reveals snap to every other beat (13.02, 14.02, 15.02, 16.02) so each ring's label stays readable.
- Audio-reactive treatment: subtle; music energy gently drives the top-of-screen navy glow and the slug logo's soft halo, with no waveform bars
- SFX posture: sparse, motion-matched
- Audio-coupled moments: hook line typing with soft key ticks, cursor tap and Log press (click, then a small confirm), each ring arriving (soft card or pop sound), the outro name landing
- Restraint rule: nothing loud or comedic (no record-scratch or airhorn). The roast is dry and the warmth comes in with the logo.

## Storyboard

### Scene 1 — Hook: the calculator that forgets — 3.5s (0.0–3.5)
Navy ground with a faint glow. Line 1 types in: "UCSC's nutrition calculator saves nothing." (about 6 words, settled by ~1.2s and held). At ~2.2s a counter reading "0 kcal logged" flashes in below with "Day 1. Every day." Hold to 3.5s.
Sequential/interaction: yes, line 1 types character by character. Hold fully typed for at least 1.8s.
Audio intent: dry and curious; music fades in, key ticks on the typing.
Audio-coupled idea: typed text with subtle key ticks.
Music: upbeat bed enters softly.
Transition mood: clean → Scene 2

### Scene 2 — Reveal: Sammy — 4.0s (3.5–7.5)
The slug logo scales in with a soft gold halo, then "Sammy's Palate" slides in beside it with "UCSC MACRO TRACKER" in mono caps underneath. A line follows: "Menus pulled fresh every morning at 6 AM." (holds about 1.6s). Music beat starts to be felt here (grid begins at 3.02s).
Sequential/interaction: none
Audio intent: warm lift
Audio-coupled idea: a soft chime as the logo lands, snapped to a nearby beat (~4.02s)
Music: upbeat
Transition mood: clean slide → Scene 3

### Scene 3 — Log it in two taps — 5.0s (7.5–12.5)
A phone frame slides in showing the real Log Menu: header with logo, "Today's Menu (Lunch)", GRILL chip, "Halal Chicken Nuggets", "Serving Size: 3 oz", then the colored stat line (Cals 182 / P 14.5g / C 14.5g / F 6g), then the 1/4x · 1/2x · 1x · 1.5x · 2x selector and the gold Log button. Beside it, a callout: "Pick a serving. Tap Log." A cursor moves, taps 1.5x (chip highlights gold), then taps Log (button press, check-pop). Stats scale to 1.5x (272 kcal). Phone entrance locks near the 8.02s beat.
Sequential/interaction: yes, simulated cursor tap on 1.5x, then tap on Log (about 1.2s apart); callout "Pick a serving. Tap Log." holds about 2s.
Audio intent: satisfying and tactile
Audio-coupled idea: click on 1.5x, click plus small confirm on Log
Music: bed continues
Transition mood: clean wipe → Scene 4

### Scene 4 — The rings fill — 4.5s (12.5–17.0)
Phone slides away and the "Today's Progress Breakdown" card fills the frame (or a wide 2x2 grid of ring cards). Four ring cards arrive one at a time, each ring sweeping to its value with the number counting up: Calories 57% (1362 / 2377 kcal), Protein 49% (88 / 178 g), Carbs 67% (140 / 208 g), Fat 67% (61 / 92 g). A header line reads "Today's Progress Breakdown". After all four land, a small caption: "History saved. Every day." holds about 1.2s.
Sequential/interaction: yes, four ring cards on every other beat (13.02, 14.02, 15.02, 16.02). Full set stays on screen at least 1s after the last lands before cutting at 17.02.
Audio intent: momentum building to the payoff
Audio-coupled idea: card-style pop per ring, counter ticks
Music: bed builds toward the 17.02 strong cue
Transition mood: hard-ish cut on beat → Scene 5

### Scene 5 — Outro: it remembers — 3.5s (17.0–20.5)
Cut on the strong cue at 17.02s. "Sammy's Palate" slams in over the slug logo, then "It remembers what you ate." settles below (about 1.5s hold), then a small footer: "On the App Store · ucsc-dining-tracker.vercel.app". Music fades out over the final ~1.5s.
Sequential/interaction: none
Audio intent: warm, confident landing
Audio-coupled idea: name lands on the strong beat with one soft accent
Music: fade out under the final tagline
Transition mood: none (end)

**Music mood for this video:** upbeat, warm business groove
**Audio summary:** a quiet key-tick hook, a warm music lift when Sammy appears, tactile clicks during the log flow, ring-fill pops on the beat, and a soft accent on the final name before the music fades.
