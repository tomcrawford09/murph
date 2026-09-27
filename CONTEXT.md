# Murph-ish

Murph-ish records a person's daily training volume against a Murph-shaped target and lets invited friends compare progress when they choose to appear on a leaderboard.

## Language

**Participant**:
A person invited to use Murph-ish who owns their own training history. Provider accounts are ways to identify the same participant, not separate training histories.
_Avoid_: Supabase account, Google account

**Leaderboard name**:
The participant-chosen name shown to other invited participants on the leaderboard. It is not a sign-in credential; a participant's email address stays private.
_Avoid_: Login username, email address

**Entry**:
One addition of distance or repetitions to a participant's log, attributed to a training day.
_Avoid_: Workout, session

**Training day**:
A calendar date used to group a participant's entries for daily totals. It can include entries made in several separate bouts.
_Avoid_: Workout, round

**Active day**:
A training day with at least one positive entry for any of the four exercise types.
_Avoid_: Completed day

**Daily Murph score**:
The average of the four target percentages on a training day, with each exercise percentage capped at 100%. It measures logged volume and ranges from zero to 100.
_Avoid_: Fitness level, completed Murph

**Weekly points**:
The sum of daily Murph scores across the seven days of a shared calendar week. It rewards repeated activity, with a maximum of 700 points in one week.
_Avoid_: Weekly average, total repetitions

**Leaderboard**:
A comparison of weekly points among invited participants who have chosen to show their result. It reveals a leaderboard name, weekly points and active-day count, while each person's entries remain private.
_Avoid_: Shared log

**Murph attempt**:
A deliberately started and ended session intended to complete the full exercise sequence. Its completion and time are distinct from a training day's accumulated volume.
_Avoid_: 100% daily score
