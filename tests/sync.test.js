// Run: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const Y = require('../sync.js');

const OWNER = '11111111-1111-4111-8111-111111111111';
let n = 0;
const local = (extra = {}) => ({ entry_id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`, owner: OWNER, occurred_at: '2026-09-27T01:00:00.000Z', local_date: '2026-09-27', timezone: 'Australia/Sydney', exercise: 'pull', quantity: 5, target_version: 'rounded-km-v1', deleted_at: null, pushed: false, delete_pushed: false, ...extra });

/* In-memory stand-in for the entries table, following the migration's rules: insert ignores duplicates, deletion is one-way,
   updated_at is server time (with microseconds, like Postgres). `loseNextResponse` applies a write but reports a network error. */
function fakeServer() {
  const rows = new Map();
  let clock = Date.parse('2026-09-27T02:00:00Z'), loseNextResponse = false;
  const stamp = () => new Date(clock += 1000).toISOString().replace('Z', '123+00:00');
  const respond = result => { if (loseNextResponse) { loseNextResponse = false; return Promise.resolve({ error: { message: 'Failed to fetch' } }); } return Promise.resolve(result); };
  function query(kind, payload) {
    const filters = [];
    let range = [0, Infinity];
    const q = {
      eq(col, v) { filters.push(r => r[col] === v); return q; },
      in(col, vs) { filters.push(r => vs.includes(r[col])); return q; },
      is(col, v) { filters.push(r => r[col] === v); return q; },
      gte(col, v) { filters.push(r => Y.ms(r[col]) >= Y.ms(v)); return q; },
      order() { return q; },
      range(a, b) { range = [a, b]; return q; },
      then(resolve, reject) {
        const matched = [...rows.values()].filter(r => filters.every(f => f(r)));
        if (kind === 'update') { for (const r of matched) if (r.deleted_at === null) { r.deleted_at = stamp(); r.updated_at = stamp(); } return respond({ error: null }).then(resolve, reject); }
        const data = matched.sort((a, b) => Y.ms(a.updated_at) - Y.ms(b.updated_at) || a.entry_id.localeCompare(b.entry_id)).slice(range[0], range[1] + 1).map(r => ({ ...r }));
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      }
    };
    return q;
  }
  const client = {
    from: () => ({
      upsert(list) { for (const r of list) { const key = r.user_id + r.entry_id; if (!rows.has(key)) { const t = stamp(); rows.set(key, { ...r, deleted_at: r.deleted_at ? t : null, updated_at: t }); } } return respond({ error: null }); },
      update() { return query('update'); },
      select() { return query('select'); }
    })
  };
  return { client, rows, loseNext() { loseNextResponse = true; } };
}

/* A device: its local entries plus the same serialised mutate() the app uses. */
function device(server, entries = []) {
  const d = { entries, cursor: undefined };
  let queue = Promise.resolve();
  d.mutate = fn => (queue = queue.then(() => { const changed = fn(d.entries); const byId = new Map(d.entries.map(e => [e.entry_id, e])); for (const e of changed) byId.set(e.entry_id, e); d.entries = [...byId.values()]; return changed; }));
  d.sync = () => Y.run({ client: server.client, owner: OWNER, getEntries: () => d.entries, mutate: d.mutate, getCursor: async () => d.cursor, setCursor: async v => { d.cursor = v; } });
  d.live = () => d.entries.filter(e => !e.deleted_at);
  return d;
}
const serverLive = server => [...server.rows.values()].filter(r => !r.deleted_at);

test('rapid taps all back up exactly once, even when a response is lost and the push is retried', async () => {
  const server = fakeServer(), phone = device(server, Array.from({ length: 25 }, () => local()));
  server.loseNext();
  await assert.rejects(phone.sync());
  assert.equal(server.rows.size, 25, 'the write landed although the phone never heard back');
  assert.equal(Y.pendingCount(phone.entries, OWNER), 25, 'unconfirmed entries are still pending, never claimed as backed up');
  const result = await phone.sync();
  assert.equal(server.rows.size, 25, 'retry did not double count');
  assert.equal(result.pending, 0);
  assert.ok(phone.entries.every(e => e.pushed));
});

test('undo before and after backup never resurrects an entry', async () => {
  const server = fakeServer(), [a, b] = [local(), local()], phone = device(server, [a, b]);
  await phone.mutate(es => [{ ...es.find(e => e.entry_id === a.entry_id), deleted_at: '2026-09-27T01:30:00Z' }]);
  await phone.sync();
  await phone.mutate(es => [{ ...es.find(e => e.entry_id === b.entry_id), deleted_at: '2026-09-27T02:30:00Z' }]);
  await phone.sync();
  assert.equal(serverLive(server).length, 0);
  assert.equal(phone.live().length, 0);
  assert.equal(Y.pendingCount(phone.entries, OWNER), 0);
});

test('a second phone restores the log, then receives deletions made on the first', async () => {
  const server = fakeServer(), first = device(server, [local({ quantity: 10 }), local({ quantity: 25 })]);
  await first.sync();
  const second = device(server);
  await second.sync();
  assert.deepEqual(second.live().map(e => e.quantity).sort(), [10, 25]);
  const gone = first.entries[0].entry_id;
  await first.mutate(es => [{ ...es.find(e => e.entry_id === gone), deleted_at: '2026-09-27T03:00:00Z' }]);
  await first.sync();
  await second.sync();
  assert.deepEqual(second.live().map(e => e.quantity), [25]);
});

test('restoring an old backup cannot bring back an entry deleted elsewhere', async () => {
  const server = fakeServer(), first = device(server, [local()]);
  await first.sync();
  const backup = first.entries.map(({ pushed, delete_pushed, ...e }) => e);
  await first.mutate(es => [{ ...es[0], deleted_at: '2026-09-27T03:00:00Z' }]);
  await first.sync();
  const restored = device(server, backup.map(e => ({ ...e, pushed: false, delete_pushed: false })));
  await restored.sync();
  assert.equal(serverLive(server).length, 0, 'server kept the deletion');
  assert.equal(restored.live().length, 0, 'restored phone learned the deletion');
});

test('a local undo waiting to upload wins over an older live copy from the server', () => {
  const e = local({ pushed: true, deleted_at: '2026-09-27T03:00:00Z' });
  const [next] = Y.apply([e], [{ type: 'remote', row: { ...e, deleted_at: null } }], OWNER);
  assert.equal(next, undefined, 'nothing changed: still deleted and still pending');
  assert.equal(Y.pending([e], OWNER).deletes.length, 1);
});

test('rows are never merged into another participant’s local entries', () => {
  const other = local({ owner: '22222222-2222-4222-8222-222222222222' });
  assert.deepEqual(Y.apply([other], [{ type: 'remote', row: { ...other, deleted_at: '2026-09-27T03:00:00Z' } }], OWNER), []);
});

test('Postgres microsecond timestamps parse in every browser', () => {
  assert.equal(Y.ms('2026-09-27T02:00:01.123456+00:00'), Date.parse('2026-09-27T02:00:01.123Z'));
});
