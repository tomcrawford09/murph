# Murph-ish: prototype and build plan

Created 27 September 2026. Personal fitness logging concept for Tom. Working name and interface choices remain proposals. The attached screenshot supplied the visual reference only: charcoal, off-white, fine rules, square controls and a mix of bold sans serif and editorial serif.

## Recommendation

Build a small installable web app with immediate local logging and automatic private cloud backup. Host the static app on Cloudflare Pages from Tom's GitHub repository and use Supabase for authentication and the exercise log. Open it, tap a number, close it. No form submission or session setup is necessary for scattered sets through the day.

Use the four-column layout as the starting point. It exposes all four exercises and all sixteen increments at once, with one tap per entry. Use a separate progress section below it. An exercise filter keeps the chart to three readable lines rather than twelve overlapping ones.

The delivered prototype answers the interface and calculation questions. It runs locally and is not yet an installed phone app, offline PWA or cloud-backed service. It uses sample data by default. Choosing **My log** starts a separate browser-local log and remembers that choice. A real log can be exported to JSON or CSV; JSON restores merge by entry ID. The prototype is disposable code, not a production implementation.

## Name shortlist

| Name | Character |
| --- | --- |
| **Murph-ish** | Recommended. Short, playful and right for gradual progress. Tagline: Every rep counts. |
| **How Murph Are You?** | The clearest expression of the score; used as the prototype's chart title. |
| **Murph in Progress** | Warm, understated and forgiving of rest days. |
| **The Murphening** | A little ridiculous, in a good way. |
| **Murph by a Thousand Reps** | Best as a tagline; deliberately melodramatic. |
| **Murph, Eventually** | Dry humour; avoids the pressure of a streak. |
| **You Can't Hurry Murph** | A longer, singable option for the daily groove. |

These are creative suggestions; availability and trademarks have not been checked.

## What to try

Run from this directory:

```powershell
python -m http.server 8876 --bind 127.0.0.1
```

Open `http://127.0.0.1:8876`. No dependency install or build is needed. That address is on this computer only; opening it on a phone does not connect to this computer. An HTTPS deployment is the next step for everyday phone use.

The arrows at the bottom switch three structurally different layouts. `?variant=A`, `?variant=B` and `?variant=C` preserve the chosen layout in the URL. Left and right arrow keys also work outside input controls.

| Layout | Interaction | Main trade-off |
| --- | --- | --- |
| A: Four columns | All exercises with vertical +1/+5/+10/+25 buttons | Fastest cross-exercise entry; narrow columns on small phones |
| B: Exercise rows | One broad row per exercise, increments across the row | More legible labels; requires more vertical scrolling |
| C: One at a time | Choose exercise, then use a large counter and keypad | Biggest controls; changing exercise costs one extra tap |

Run increments are +100 m, +250 m, +500 m and +1 km. Custom run input is in kilometres; integer metres are stored. Rep increments are +1, +5, +10 and +25. Each exercise supports a custom amount. One-tap undo and individual entry undo repair mistakes. The date selector supports backfilling previous days and updates the chart's ending date to match.

Demo edits stay in memory and reset on reload. My log is saved under a clearly marked prototype browser-storage key. Browser clearing, a new origin/port, a new browser or a different phone will not carry that log across. Export before moving to a real app. Restoring an old backup intentionally brings back entries from that backup, including entries subsequently undone; there is no production deletion-sync protocol yet.

## Exact measurement rules

The target follows Tom's rounded kilometre version: **3.2 km total running, 100 pull-ups, 200 push-ups, 300 squats**. The running total combines 1.6 km out and 1.6 km back. Two exact international miles are 3.218688 km; the production settings should offer rounded 3.2 km or exact two miles and preserve the selected target alongside historical calculations. The prototype consistently uses 3.2 km.

Daily logging captures accumulated volume. It cannot establish that the prescribed sequence was completed in a single workout. A separate session feature is needed for the eventual one-round goal. Chin-ups can be logged against the pull-up goal in this first version, as requested; future variation labels can distinguish them without changing the tap flow.

For exercise e on calendar date d:

```text
daily[e,d] = sum of valid, non-undone entry amounts for that exercise/date
exercisePercent[e,d] = 100 × daily[e,d] / target[e]
overallPercent[d] = mean(min(100, exercisePercent[e,d]) for each of 4 exercises)
active[d] = at least one exercise has positive volume on that date
```

Individual exercise percentages may exceed 100%. The overall score caps each component first. Four hundred percent of the squat target with nothing else done is therefore 25% overall. Getting to 100% overall requires reaching all four volume targets that day. It is a volume score, not a fitness estimate or proof of being able to complete an unbroken Murph.

For each plotted date, use only dates up to and including that date; future entries must never influence historical averages.

| Line | Included dates | Divisor | When nothing qualifies |
| --- | --- | --- | --- |
| Daily | Every calendar day in the chart | None | Zero |
| Last 3 active days | Latest 3 dates with any activity, with no age limit | Actual included count: 1, 2 or 3 | No average; show a dash/gap |
| 14-day active average | Date shown plus preceding 13 calendar days, with any activity | Number of active dates inside that window | No average; show a dash/gap |

An active date is shared across all exercises. A run-only day contributes zero pull-ups, zero push-ups and zero squats to their averages. This follows the phrase “days that I actually did any activity.” Exercise-specific active dates would be a different metric and could make neglected exercises look misleadingly strong.

Example: overall scores of 100%, 25% and 25% on 1, 20 and 27 September respectively produce a last-three-active average of **50%** on 27 September. The 14-day window includes only 20 and 27 September, so its average is **25%**. The run chart uses those same dates, even if the 27 September activity was only pull-ups.

The current partial day joins both averages as soon as the first activity is logged. This can make the average dip early in the day; it then grows as more sets are added. It is the requested active-day interpretation, not a bug. Label it clearly rather than silently excluding today.

Use Australia/Sydney calendar dates by default, including daylight saving. Save the attributed local date and time zone at entry time as well as an absolute timestamp. Travelling or viewing from another time zone must not reassign existing entries. A visible date lets Tom intentionally backfill; switching back to Today must be easy.

Always show the active-day count near the averages. One excellent day in fourteen can yield a high active-day average while consistency remains low. No streak penalties or automatic workout prescriptions are required.

## Hosting and storage decision

Tom chose **Supabase**, with **Cloudflare Pages** the recommended free host for the web app. The GitHub repository is [tomcrawford09/murph](https://github.com/tomcrawford09/murph). The prototype was saved on branch `codex/murph-ish-prototype` at commit `74bd35a`; it is not yet a live app. Once the daily-use version is ready, use a production branch for automatic Pages deployments. A static site needs no build command. Keep runtime exercise data in Supabase, with a local copy for instant taps and offline use.

Cloudflare Pages serves static assets on its free plan and can automatically deploy from GitHub. Supabase's current free plan includes a small database and authentication, which is ample for two people's exercise logs. The material limits for this use are that free Supabase projects pause after one week of inactivity and do not include automatic database backups. Keep a downloadable personal backup even after sync is working. These terms can change; check the official pricing pages when creating the projects.

Tom's personal Supabase dashboard login is an administrator account for Supabase. It does not itself create a Supabase project or automatically sign him in to Murph-ish. Create a separate Supabase project, configure Google sign-in for Tom and his friend, and set the Cloudflare Pages URL as an allowed redirect. Google login requires a Google Cloud OAuth client and Supabase provider configuration. Keep sessions so ordinary tap logging does not repeatedly interrupt users. An email sign-in fallback can be added if needed; Supabase's default email sender is restricted and should not be assumed to deliver to arbitrary friends.

The GitHub repository is public, so commit no service-role key, database password, access token or private exercise data. The browser may use a Supabase publishable client key only after owner-only row-level policies are in place. Cloudflare serving a public login page is fine; Supabase protects each person's records. Initial app access is by invitation even when the sign-in page is public.

The recommendation is an engineering judgment based on the small personal workload. There is no need for AI inference, paid exercise APIs, GPS or a native mobile build.

In production, use IndexedDB for local entries and a pending sync queue. The app confirms once the local transaction succeeds, then syncs in the background while the app is open. Retry on reopening, connectivity returning and explicit retry; do not depend on mobile background sync being universally available. A service worker caches the app shell so it reopens offline after initial loading. A small HTTPS static host serves the UI.

Use Supabase Auth and an entries table, protected by row-level policies tied to the signed-in user. Only the publishable client key belongs in the browser; never a database service-role key. A unique `(user_id, entry_id)` constraint makes retries idempotent. Download only that person's entries when opening the app. Display `Saved on this phone`, `Sync pending`, `Backed up` and actionable failure states accurately.

Use server-confirmed deletion markers or immutable reversal entries for production undo, so deleted sets cannot return from another device or an old backup. The prototype simply removes a local entry and does not implement this sync model.

## Sharing and leaderboard proposal

Start with **Google sign-in** for both people through Supabase Auth. Tom can invite his friend by email; a signed-in account gains app access only after its verified email matches an invitation. Knowledge of the public Pages URL does not count as an invitation. The Supabase dashboard login remains separate from app participant accounts. Add Facebook sign-in if someone needs it: it requires a Meta developer app, the Facebook `email` permission and live-app configuration. Supabase can link providers with the same verified email, but a different Facebook email could create a second account unless it is explicitly linked.

Each participant has their own entries and personal graphs. Row-level security permits one participant to read, add, correct and delete only their own entries. A profile holds a display name and a **Show me on the leaderboard** choice, off by default. The leaderboard exposes no email addresses or individual sets. It returns weekly points and active-day count for current, invited, opted-in members only. Perform this aggregation in a carefully scoped database function, so the browser never downloads a friend's private entries.

The proposed first leaderboard is **weekly Murph points**: add each daily overall score in a Monday–Sunday week. This can rise as high as 700 points and gives scattered training a reason to return throughout the week. Show active days beside points for context. A single 100% day scores 100 points; three 50% days score 150. A rolling three-active-day or 14-day average remains a personal trend measure and does not determine rank. Equal points share a rank. The score is self-reported and does not claim that either person completed a full Murph in one session.

Use a common leaderboard week in Australia/Sydney for the initial two-person challenge. If the friend lives in another time zone, confirm a common challenge time zone before launch; otherwise midnight, backfilled entries and the Monday reset can surprise one person. Preserve each participant's chosen training-day date in their personal log.

The home screen still opens on the logger. A small **Friends** tab opens the leaderboard. Signing in happens at first use or when the session expires, not before every set. An uninvited login sees an explanation rather than another person's data. A participant can hide themselves from future rankings without losing their log.

## Minimal data model

Store one record per tap, not an overwritten running total. This preserves correction, history, backup and future session grouping.

```json
{
  "entry_id": "client-generated UUID",
  "user_id": "authenticated participant",
  "occurred_at": "2026-09-26T23:10:00Z",
  "local_date": "2026-09-27",
  "timezone": "Australia/Sydney",
  "exercise": "pull",
  "quantity": 5,
  "unit": "reps",
  "session_id": null,
  "target_version": "rounded-km-v1",
  "deleted_at": null
}
```

Use exercise keys `run`, `pull`, `push`, `squat`; distance uses integer metres. Enforce positive finite whole quantities, valid dates and owner access on the server. Totals and averages are derived from entries; they should not be independently edited or stored as the source of truth.

The shared version also needs an invitation record, a participant profile (`user_id`, display name, leaderboard opt-in), and a server-side leaderboard calculation. Authentication identities come from Supabase Auth. Do not duplicate Google/Facebook credentials or provider tokens in application tables.

## Build sequence and acceptance

1. **Choose the interface.** Try A/B/C using the demo. Confirm the name, increments, rounded running target and shared active-day definition. The prototype is delivered; these choices are proposed rather than approved.
2. **Build the daily-use version.** Keep the chosen logger, history, undo and charts. Add IndexedDB, durable pending events, install metadata, app icons and offline shell caching. Remove prototype/demo controls from the daily home screen. Import the prototype JSON format.
3. **Add private backup and invited access.** Create the Supabase project and Google OAuth configuration. Add invitation checks, private entries, owner-only policies, idempotent sync and deletion handling. Test Tom and the friend's accounts separately. Verify restore on a second browser before relying on it. Connect GitHub to Cloudflare Pages, publish over HTTPS and add it to both phones' home screens.
4. **Add the Friends view.** Let each participant choose a display name and opt in. Calculate weekly points in the database and display only opted-in aggregate results. Check weekly reset, no-activity weeks, late backfills and removal from the leaderboard.
5. **Use it in ordinary life.** Confirm that opening and logging a set takes a few seconds, preferably one tap after opening. Make the usual increments configurable only if the trial shows a need. Keep the version small.
6. **Add a one-session attempt later.** Start/end a session, separate the opening and closing runs, group all entries under that session and record elapsed time. Keep daily totals working alongside it. Session completion and daily volume need separate labels.

Release checks for the dependable version:

- At a 360–430 CSS-pixel phone width, the common logging controls are easy to hit without horizontal scrolling. Actual phone testing covers thumb reach, keyboard and add-to-home-screen behaviour.
- Multiple intentional quick taps are all retained. Retries of the same queued event never double-count it. Network requests never block the visible count.
- Airplane-mode entry, force-close/reopen, reconnect and new-browser restore retain exactly the expected totals.
- Undo before and after sync does not resurrect entries. Repeated restore is idempotent.
- Empty history, one/two active days, long gaps, only-one-exercise days, more than 100%, the 14-day boundary, backfilled days, midnight and Sydney DST behave as specified.
- Browser failure, denied storage, expired authentication or failed sync must never claim that an unsaved entry is backed up.
- One user's authenticated session cannot read or alter another user's entries.
- An uninvited Google account cannot read an entry, create a participant profile or appear in the leaderboard.
- Opting out removes a participant's name and aggregate score from future leaderboard responses; it does not delete their private log.
- Logging on either phone updates only its owner's personal totals; the leaderboard changes after the relevant entry is backed up.

## Documentation checked

Current primary documentation checked 27 September 2026:

- [MDN: offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — service workers, offline caching and deferred operations.
- [MDN: Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API) — browser storage and persistence. Local storage is not a cloud backup.
- [MDN: making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — manifest, secure serving and platform installation behaviour.
- [Supabase: row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) — per-user protection for database access from a browser client.
- [Cloudflare Pages: Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/) and [Pages limits](https://developers.cloudflare.com/pages/platform/limits/) — static GitHub deployment and free-tier limits.
- [Cloudflare Pages: static asset pricing](https://developers.cloudflare.com/pages/functions/pricing/) — static requests are free on the current plan.
- [Supabase pricing](https://supabase.com/pricing) — free-tier size, project pausing and backup limitations.
- [Supabase email passwordless sign-in](https://supabase.com/docs/guides/auth/auth-email-passwordless) and [Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google) — authentication setup choices.
- [Supabase Facebook sign-in](https://supabase.com/docs/guides/auth/social-login/auth-facebook) — extra Meta app, email-permission and production setup.
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) — joining providers with the same verified email.

The prototype was pushed to GitHub. No Supabase project, database table, Cloudflare Pages project or live deployment was created for this prototype.
