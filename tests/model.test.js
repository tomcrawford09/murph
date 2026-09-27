// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const entry = (local_date, exercise, quantity, extra = {}) => ({ entry_id: id(), local_date, exercise, quantity, occurred_at: local_date + 'T01:00:00.000Z', ...extra });
const full = day => [entry(day, 'run', 3200), entry(day, 'pull', 100), entry(day, 'push', 200), entry(day, 'squat', 300)];

test('plan example: 100%, 25%, 25% gives 50% last-three and 25% fourteen-day', () => {
  const entries = [...full('2026-09-01'), entry('2026-09-20', 'squat', 1200), entry('2026-09-27', 'pull', 100)];
  const s = M.summary(M.totals(entries), '2026-09-27');
  assert.equal(s.daily, 25);
  assert.equal(s.three, 50);
  assert.equal(s.fourteen, 25);
  assert.deepEqual(s.last3, ['2026-09-01', '2026-09-20', '2026-09-27']);
  assert.deepEqual(s.last14, ['2026-09-20', '2026-09-27']);
  const run = M.summary(M.totals(entries), '2026-09-27', 'run');
  assert.ok(Math.abs(run.three - 100 / 3) < 1e-9, 'run-only averages still use every active date');
  assert.equal(run.fourteen, 0);
});

test('each exercise is capped at 100% overall but not on its own chart', () => {
  const days = M.totals([entry('2026-09-27', 'squat', 1200)]);
  assert.equal(M.score(days['2026-09-27']), 25);
  assert.equal(M.score(days['2026-09-27'], 'squat'), 400);
  assert.equal(M.score(M.totals(full('2026-09-27'))['2026-09-27']), 100);
});

test('empty history has no averages and zero daily score', () => {
  const s = M.summary({}, '2026-09-27');
  assert.deepEqual([s.daily, s.three, s.fourteen], [0, null, null]);
});

test('fewer than three active days average what exists, with no age limit', () => {
  const entries = [entry('2025-01-01', 'pull', 50), entry('2026-09-27', 'pull', 100)];
  const s = M.summary(M.totals(entries), '2026-09-27');
  assert.equal(s.three, (12.5 + 25) / 2);
  assert.equal(s.fourteen, 25);
});

test('the fourteen-day window is the date shown plus the 13 before it', () => {
  const days = M.totals([entry('2026-09-14', 'pull', 100), entry('2026-09-13', 'push', 200)]);
  assert.deepEqual(M.summary(days, '2026-09-27').last14, ['2026-09-14']);
});

test('later entries never change an earlier date', () => {
  const entries = [entry('2026-09-20', 'pull', 100), entry('2026-09-27', 'pull', 20)];
  const s = M.summary(M.totals(entries), '2026-09-21');
  assert.deepEqual([s.daily, s.three, s.fourteen], [0, 25, 25]);
});

test('undone entries do not count', () => {
  const entries = [entry('2026-09-27', 'pull', 100), entry('2026-09-27', 'pull', 100, { deleted_at: '2026-09-27T02:00:00Z' })];
  assert.equal(M.totals(entries)['2026-09-27'].pull, 100);
});

test('Sydney calendar dates across midnight and the October 2026 DST change', () => {
  assert.equal(M.today(new Date('2026-09-27T13:59:00Z')), '2026-09-27'); // 23:59 AEST
  assert.equal(M.today(new Date('2026-09-27T14:00:00Z')), '2026-09-28'); // 00:00 AEST
  assert.equal(M.today(new Date('2026-10-04T12:59:00Z')), '2026-10-04'); // 23:59 AEDT after clocks go forward
  assert.equal(M.today(new Date('2026-10-04T13:00:00Z')), '2026-10-05'); // 00:00 AEDT
  assert.equal(M.shift('2026-10-03', 2), '2026-10-05');
});

test('weeks run Monday to Sunday and weekly points add daily scores', () => {
  assert.equal(M.weekStart('2026-09-27'), '2026-09-21');
  assert.equal(M.weekStart('2026-09-28'), '2026-09-28');
  const days = M.totals([...full('2026-09-21'), entry('2026-09-23', 'squat', 300), entry('2026-09-27', 'pull', 100), entry('2026-09-28', 'pull', 100)]);
  assert.deepEqual(M.weeklyPoints(days, '2026-09-24'), { start: '2026-09-21', points: 150, active: 3 });
});

test('prototype My log backups import; demo, malformed and duplicate data do not', () => {
  const event = { id: 'A1B2C3D4-0000-4000-8000-000000000001', date: '2026-09-26', exercise: 'push', amount: 25, createdAt: '2026-09-26T03:00:00.000Z', timeZone: 'Australia/Sydney' };
  const [e] = M.parseBackup({ schema: 1, mode: 'mine', events: [event] }, new Date('2026-09-27T00:00:00Z'));
  assert.deepEqual(e, { entry_id: 'a1b2c3d4-0000-4000-8000-000000000001', occurred_at: event.createdAt, local_date: '2026-09-26', timezone: 'Australia/Sydney', exercise: 'push', quantity: 25, target_version: 'rounded-km-v1', deleted_at: null });
  assert.throws(() => M.parseBackup({ schema: 1, mode: 'demo', events: [event] }));
  assert.throws(() => M.parseBackup({ schema: 1, mode: 'mine', events: [event, event] }));
  assert.throws(() => M.parseBackup({ schema: 1, mode: 'mine', events: [{ ...event, id: 'demo-1-push' }] }));
  assert.throws(() => M.parseBackup({ schema: 1, mode: 'mine', events: [{ ...event, amount: 2.5 }] }));
  assert.throws(() => M.parseBackup({ schema: 1, mode: 'mine', events: [{ ...event, date: '2026-02-30' }] }));
  const round = M.parseBackup({ schema: 2, entries: [{ ...e, deleted_at: '2026-09-26T04:00:00Z' }] }, new Date('2026-09-27T00:00:00Z'));
  assert.equal(round[0].deleted_at, '2026-09-26T04:00:00Z');
});
