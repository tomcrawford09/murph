# Murph-ish: prototype and build plan

Created 27 September 2026. Personal fitness logging concept for Tom. Working name and interface choices remain proposals. The attached screenshot supplied the visual reference only: charcoal, off-white, fine rules, square controls and a mix of bold sans serif and editorial serif.

## Recommendation

Build a small installable web app with immediate local logging and automatic private cloud backup. Open it, tap a number, close it. No form submission or session setup is necessary for scattered sets through the day.

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

## Storage decision

| Option | Strength | What it still needs | Decision |
| --- | --- | --- | --- |
| Browser only | Immediate response, simplest prototype | Backup and recovery; browser data can disappear; no automatic device transfer | Good for this prototype and a short interface trial |
| Front end → n8n → Google Sheet | Familiar, inspectable rows; convenient reporting | Authentication, offline queue, retries, duplicate protection, read-back endpoint, undo semantics | Viable if a Sheet is specifically wanted, but not the simplest dependable app |
| Local app storage + Supabase | Immediate logging plus authenticated database backup across devices | A small event-sync routine, sign-in and row-level access policies | Recommended first dependable version |

The recommendation is an engineering judgment based on the small personal workload. There is no need for AI inference, paid exercise APIs, GPS, a native mobile build or a workflow execution for every tap.

In production, use IndexedDB for local entries and a pending sync queue. The app confirms once the local transaction succeeds, then syncs in the background while the app is open. Retry on reopening, connectivity returning and explicit retry; do not depend on mobile background sync being universally available. A service worker caches the app shell so it reopens offline after initial loading. A small HTTPS static host serves the UI.

Use Supabase Auth and one entries table, protected by row-level policies tied to the signed-in user. Only the publishable client key belongs in the browser; never a database service-role key. A unique `(user_id, entry_id)` constraint makes retries idempotent. Download changes when opening the app. Display `Saved on this phone`, `Sync pending`, `Backed up` and actionable failure states accurately.

Use server-confirmed deletion markers or immutable reversal entries for production undo, so deleted sets cannot return from another device or an old backup. The prototype simply removes a local entry and does not implement this sync model.

Keep n8n optional: it can copy backed-up records into a Sheet on a schedule if the spreadsheet proves useful. The app remains usable while n8n is unavailable.

If the Sheet route is chosen, host the front end separately, use an authenticated endpoint and confirm a successful durable write before acknowledging remote backup. Do not embed a shared secret in frontend JavaScript. Queue offline events locally, carry a stable entry ID, enforce serialized/idempotent ingestion, and return explicit acknowledgements. n8n's immediate “workflow started” response is not evidence that the Sheet write finished. Provide a read endpoint for recovery; a write-only webhook cannot restore a new phone. Sheet deletion by mutable row number is too fragile for reliable undo.

## Minimal data model

Store one record per tap, not an overwritten running total. This preserves correction, history, backup and future session grouping.

```json
{
  "entry_id": "client-generated UUID",
  "user_id": "authenticated owner",
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

## Build sequence and acceptance

1. **Choose the interface.** Try A/B/C using the demo. Confirm the name, increments, rounded running target and shared active-day definition. The prototype is delivered; these choices are proposed rather than approved.
2. **Build the daily-use version.** Keep the chosen logger, history, undo and charts. Add IndexedDB, durable pending events, install metadata, app icons and offline shell caching. Remove prototype/demo controls from the daily home screen. Import the prototype JSON format.
3. **Add private backup.** Add sign-in, the one-table backend, owner-only policies, idempotent sync and deletion handling. Verify restore on a second browser before relying on it. Publish to HTTPS and add it to the actual phone's home screen.
4. **Use it in ordinary life.** Confirm that opening and logging a set takes a few seconds, preferably one tap after opening. Make the usual increments configurable only if the trial shows a need. Keep the version small.
5. **Add a one-session attempt later.** Start/end a session, separate the opening and closing runs, group all entries under that session and record elapsed time. Keep daily totals working alongside it. Session completion and daily volume need separate labels.

Release checks for the dependable version:

- At a 360–430 CSS-pixel phone width, the common logging controls are easy to hit without horizontal scrolling. Actual phone testing covers thumb reach, keyboard and add-to-home-screen behaviour.
- Multiple intentional quick taps are all retained. Retries of the same queued event never double-count it. Network requests never block the visible count.
- Airplane-mode entry, force-close/reopen, reconnect and new-browser restore retain exactly the expected totals.
- Undo before and after sync does not resurrect entries. Repeated restore is idempotent.
- Empty history, one/two active days, long gaps, only-one-exercise days, more than 100%, the 14-day boundary, backfilled days, midnight and Sydney DST behave as specified.
- Browser failure, denied storage, expired authentication or failed sync must never claim that an unsaved entry is backed up.
- One user's authenticated session cannot read or alter another user's entries.

## Documentation checked

Current primary documentation checked 27 September 2026:

- [MDN: offline and background operation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation) — service workers, offline caching and deferred operations.
- [MDN: Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API) — browser storage and persistence. Local storage is not a cloud backup.
- [MDN: making PWAs installable](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) — manifest, secure serving and platform installation behaviour.
- [Supabase: row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security) — per-user protection for database access from a browser client.
- [n8n: Webhook node](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/) — authentication and the distinction between immediate response and workflow completion. Its HTML responses also have sandbox restrictions, another reason to host the front end independently.
- [n8n: Google Sheets operations](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.googlesheets/sheet-operations/) — supported append/read/update operations.

No cloud accounts, workflows, database tables, live Sheets or public deployments were created for this prototype.
