# Murph in Progress

Every rep counts. A phone-first web app for building up Murph volume through the day: one tap adds running, pull-ups, push-ups or squats to today's total. It shows the daily Murph score, a last-three-active-day average and a 14-day active average, keeps each person's log private, and has an opt-in weekly leaderboard for invited friends.

Plain HTML, CSS and JavaScript with no framework. Hosted on Cloudflare Pages; Supabase provides Google sign-in and the backup database.

## How it works

- **Saved on the phone first.** Each tap is written to IndexedDB and only then shown. A service worker caches the app so it opens and logs with no signal.
- **Backed up in the background.** When signed in, entries upload to Supabase, keyed by a client-generated ID so retries never double count. The status line only says "Backed up" after the server confirms it.
- **Undo is permanent.** Undo writes a deletion marker that the server will not reverse, so an undone set cannot return from another phone or an old backup file.
- **Invite-only.** A database hook refuses to create an account for an email without an invitation. Row-level security limits every read and write to the owner's own entries. The leaderboard is a database function that returns only opted-in names, weekly points and active days.

Targets: 3.2 km running (1.6 km out and back), 100 pull-ups, 200 push-ups, 300 squats. Calendar days and leaderboard weeks (Monday to Sunday) use Australia/Sydney time. The overall score caps each exercise at 100%, so it measures volume and is not proof of a single unbroken Murph.

## Files

| Path | Role |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Interface: layout A (four columns), charts, history, Friends view |
| `model.js` | Scoring, Sydney calendar rules, backup parsing |
| `store.js` | IndexedDB persistence |
| `sync.js` | Supabase push, deletion markers and pull |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline shell and install metadata |
| `config.js` | Supabase URL and publishable key (browser-safe by design) |
| `_headers` | Cloudflare security headers, including a strict CSP |
| `supabase/migrations/` | Schema, row-level security, leaderboard and sign-up hook |
| `vendor/supabase.js` | Pinned `@supabase/supabase-js` 2.117.2 UMD build (MIT) |
| `tests/` | Unit tests, plus `rls-e2e.mjs` for a live security check |

## Run locally

```sh
python -m http.server 8876 --bind 127.0.0.1
```

Open http://127.0.0.1:8876. Google sign-in works locally because that address is on the project's redirect allowlist.

## Test

```sh
node --test "tests/*.test.js"
```

`tests/rls-e2e.mjs` checks the live project through the same REST API the browser uses. It creates throwaway accounts, confirms that participants are isolated, deletion is permanent, invalid data is rejected, the leaderboard hides private data and uninvited emails cannot sign up, then deletes everything it created. It needs the variables in `.env.example`, and password sign-in switched on while it runs. Switch it off again afterwards, because Google is the only launch sign-in method.

## Deploy

```sh
node scripts/build.mjs
npx wrangler pages deploy dist --project-name murph-in-progress --branch main
```

The build copies only browser files into `dist/`. Database changes go in a new file under `supabase/migrations/`.

## Invite someone

Add their Google email to `private.invitations` in the Supabase SQL editor. Invitations live only in the database, never in this public repository.

```sql
insert into private.invitations (email) values ('friend@example.com');
```

Removing the row cuts off that person's access to backup and the leaderboard. Entries already on their phone stay there.

The product and technical plan is in [PLAN.md](PLAN.md), and the vocabulary in [CONTEXT.md](CONTEXT.md). The original three-layout prototype remains on the `codex/murph-ish-prototype` branch.
