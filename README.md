# Murph-ish prototype

Phone-first personal Murph volume logger. Throwaway UI prototype, using plain HTML/CSS/JavaScript with no external runtime dependencies.

```powershell
python -m http.server 8876 --bind 127.0.0.1
```

Open [the local prototype](http://127.0.0.1:8876/?variant=A). This address works only on the computer running the server.

- `?variant=A`: four columns (recommended)
- `?variant=B`: exercise rows
- `?variant=C`: one exercise at a time

The floating arrows switch layouts; desktop also has a Phone view control. Try the demo without creating real training history. My log stores entries in this browser and remembers the selected mode. Export JSON for recovery or CSV for a spreadsheet. JSON restore merges by ID and preserves existing entries. Browser data is not a cloud backup.

[PLAN.md](PLAN.md) contains naming suggestions, formulas, the Cloudflare Pages + Supabase architecture, Google-only launch sign-in for invited friends, an optional later email/password fallback, a proposed weekly leaderboard, rollout stages, acceptance criteria and documentation sources. [CONTEXT.md](CONTEXT.md) defines the app's key terms, including the leaderboard name, which is not a login credential.

The prototype implements daily totals, presets, custom entries, undo, backfill, sparse last-three-active averages and rolling 14-day active averages. It does not implement a service worker, install manifest, cloud sync, authentication or single-session completion tracking.

Targets: 3,200 metres, 100 pull-ups, 200 push-ups, 300 squats. Calendar boundary: Australia/Sydney. Overall score caps each exercise at 100%; exercise-specific charts do not cap volume.

Checked in this iteration: JavaScript syntax, calculation edge cases with independent expected values, tap logging and undo, kilometre conversion, all three layout interactions and browser storage surviving reload. Mobile layout inspected in the browser at approximately 325 and 390 CSS-pixel widths. Actual iOS/Android installation and offline reliability remain future work.

No design has been selected by the user yet. Retain this prototype as the reference for the next design decision; build the production version separately after selection.
