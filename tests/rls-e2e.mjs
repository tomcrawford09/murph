// Live security check against a real Supabase project, through the same REST API the browser uses.
// Creates throwaway participants, proves isolation and the invitation gate, then deletes everything it made.
// Needs password sign-in enabled while it runs. Secrets come from the environment only:
//   SUPABASE_URL  SUPABASE_PUBLISHABLE_KEY  SUPABASE_SECRET_KEY  SUPABASE_ACCESS_TOKEN (management API)  SUPABASE_PROJECT_REF
// Run: node tests/rls-e2e.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const { SUPABASE_URL: URL_, SUPABASE_PUBLISHABLE_KEY: PUB, SUPABASE_SECRET_KEY: SECRET, SUPABASE_ACCESS_TOKEN: MGMT, SUPABASE_PROJECT_REF: REF } = process.env;
for (const [k, v] of Object.entries({ URL_, PUB, SECRET, MGMT, REF })) if (!v) throw new Error('Missing env ' + k);

const run = Math.random().toString(36).slice(2, 8);
const email = who => `murph-rls-${run}-${who}@example.com`;
const password = randomUUID();
const sydneyToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const plusDays = (day, n) => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const results = [];
const check = async (name, fn) => { try { await fn(); results.push(['PASS', name]); } catch (e) { results.push(['FAIL', name, e.message]); } };

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${MGMT}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  if (!r.ok) throw new Error(`SQL ${r.status}: ${await r.text()}`);
  return r.json();
}
async function admin(path, method, body) {
  const r = await fetch(`${URL_}/auth/v1/admin/${path}`, { method, headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function signIn(who) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email(who), password }) });
  const b = await r.json();
  if (!b.access_token) throw new Error(`sign-in ${who} failed: ${JSON.stringify(b)}`);
  return { token: b.access_token, id: b.user.id };
}
async function rest(user, path, { method = 'GET', body, prefer } = {}) {
  const headers = { apikey: PUB, 'Content-Type': 'application/json' };
  if (user) headers.Authorization = `Bearer ${user.token}`;
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  return { status: r.status, body: json };
}
const rpc = (user, fn, args = {}) => rest(user, `rpc/${fn}`, { method: 'POST', body: args });
const entry = (user, extra = {}) => ({ user_id: user.id, entry_id: randomUUID(), occurred_at: new Date().toISOString(), local_date: sydneyToday, timezone: 'Australia/Sydney', exercise: 'pull', quantity: 100, target_version: 'rounded-km-v1', deleted_at: null, ...extra });
const insert = (user, rows) => rest(user, 'entries?on_conflict=user_id,entry_id', { method: 'POST', body: rows, prefer: 'resolution=ignore-duplicates,return=minimal' });
const rowsOf = r => (Array.isArray(r.body) ? r.body : []);

const made = [];
try {
  await sql(`insert into private.invitations (email) values ('${email('a')}'), ('${email('b')}'), ('${email('c')}') on conflict do nothing`);
  for (const who of ['a', 'b', 'c']) {
    const r = await admin('users', 'POST', { email: email(who), password, email_confirm: true });
    if (r.status >= 300) throw new Error(`create ${who}: ${r.status} ${JSON.stringify(r.body)}`);
    made.push(r.body.id);
  }
  const [A, B, C] = [await signIn('a'), await signIn('b'), await signIn('c')];

  await check('anonymous visitors cannot read entries or call functions', async () => {
    const r = await rest(null, 'entries?select=entry_id');
    assert.ok(r.status >= 400 || rowsOf(r).length === 0, `status ${r.status}`);
    for (const fn of ['leaderboard', 'my_status']) assert.ok((await rpc(null, fn)).status >= 400, fn);
  });

  const mine = [entry(A), entry(A, { exercise: 'push', quantity: 200 }), entry(A, { exercise: 'squat', quantity: 300 })];
  await check('a participant adds entries, and retries never double count', async () => {
    assert.ok((await insert(A, mine)).status < 300);
    assert.ok((await insert(A, mine)).status < 300);
    assert.equal(rowsOf(await rest(A, 'entries?select=entry_id')).length, 3);
  });

  await check('another participant cannot read, add, delete or alter those entries', async () => {
    assert.equal(rowsOf(await rest(B, 'entries?select=entry_id')).length, 0);
    assert.equal(rowsOf(await rest(B, `entries?select=entry_id&user_id=eq.${A.id}`)).length, 0);
    assert.ok((await insert(B, [entry(A)])).status >= 400, 'insert as someone else');
    const del = await rest(B, `entries?entry_id=eq.${mine[0].entry_id}`, { method: 'PATCH', body: { deleted_at: new Date().toISOString() }, prefer: 'return=representation' });
    assert.equal(rowsOf(del).length, 0, 'deletion marker on someone else');
    assert.ok((await rest(B, `entries?entry_id=eq.${mine[0].entry_id}`, { method: 'DELETE' })).status >= 400, 'hard delete');
    assert.equal(rowsOf(await rest(A, 'entries?select=entry_id&deleted_at=is.null')).length, 3);
  });

  await check('owners can only mark entries deleted, and deletion is permanent', async () => {
    assert.ok((await rest(A, `entries?entry_id=eq.${mine[2].entry_id}`, { method: 'PATCH', body: { quantity: 5 } })).status >= 400, 'quantity change refused');
    assert.ok((await rest(A, `entries?entry_id=eq.${mine[2].entry_id}`, { method: 'PATCH', body: { deleted_at: new Date().toISOString() } })).status < 300);
    await rest(A, `entries?entry_id=eq.${mine[2].entry_id}`, { method: 'PATCH', body: { deleted_at: null } });
    await insert(A, [mine[2]]);
    const [row] = rowsOf(await rest(A, `entries?select=deleted_at&entry_id=eq.${mine[2].entry_id}`));
    assert.ok(row.deleted_at, 'still deleted after an undelete attempt and a stale re-insert');
  });

  await check('the server rejects invalid entries', async () => {
    for (const bad of [{ local_date: plusDays(sydneyToday, 5) }, { quantity: 0 }, { quantity: 2.5 }, { exercise: 'bench' }]) assert.ok((await insert(A, [entry(A, bad)])).status >= 400, JSON.stringify(bad));
  });

  await check('leaderboard shows opted-in aggregates only, and names are unique', async () => {
    assert.equal((await rpc(A, 'save_profile', { p_leaderboard_name: `Tester A ${run}`, p_show: true })).status, 200);
    assert.equal((await rpc(B, 'save_profile', { p_leaderboard_name: `Tester B ${run}`, p_show: false })).status, 200);
    const seenByB = rowsOf(await rpc(B, 'leaderboard', { week_offset: 0 })).filter(r => r.leaderboard_name.endsWith(run));
    assert.deepEqual(seenByB.map(r => [r.leaderboard_name, Number(r.points), r.active_days, r.is_me]), [[`Tester A ${run}`, 50, 1, false]]);
    assert.deepEqual(Object.keys(seenByB[0]).sort(), ['active_days', 'is_me', 'leaderboard_name', 'points', 'rank', 'week_start']);
    assert.equal((await rpc(B, 'save_profile', { p_leaderboard_name: `tester a ${run}`, p_show: true })).body?.code, '23505');
    assert.equal((await rpc(A, 'save_profile', { p_leaderboard_name: '', p_show: true })).status >= 400, true);
  });

  await check('removing an invitation cuts off data, profile and leaderboard access', async () => {
    assert.ok((await insert(C, [entry(C)])).status < 300);
    assert.equal((await rpc(C, 'save_profile', { p_leaderboard_name: `Tester C ${run}`, p_show: true })).status, 200);
    await sql(`delete from private.invitations where email = '${email('c')}'`);
    assert.equal((await rpc(C, 'my_status')).body?.participant, false);
    assert.equal(rowsOf(await rest(C, 'entries?select=entry_id')).length, 0);
    assert.ok((await insert(C, [entry(C)])).status >= 400);
    assert.equal(rowsOf(await rpc(C, 'leaderboard', { week_offset: 0 })).length, 0);
    assert.equal((await rpc(C, 'save_profile', { p_leaderboard_name: 'x', p_show: false })).body?.code, '42501');
    assert.equal(rowsOf(await rpc(A, 'leaderboard', { week_offset: 0 })).some(r => r.leaderboard_name === `Tester C ${run}`), false);
  });

  // Public sign-up is the path Google sign-in takes. (Admin calls with the secret key skip auth hooks by design.)
  await check('an uninvited email cannot create an account', async () => {
    const r = await fetch(`${URL_}/auth/v1/signup`, { method: 'POST', headers: { apikey: PUB, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email('d'), password }) });
    const b = await r.json().catch(() => ({}));
    if (b?.id || b?.user?.id) made.push(b.id || b.user.id);
    assert.equal(r.status, 403, JSON.stringify(b));
    assert.match(b.msg || '', /invite-only/);
  });
} finally {
  for (const id of made) await admin(`users/${id}`, 'DELETE');
  await sql(`delete from private.invitations where email like 'murph-rls-${run}-%'`).catch(() => {});
  const left = await sql(`select (select count(*) from auth.users where email like 'murph-rls-${run}-%') as users, (select count(*) from public.entries e left join auth.users u on u.id = e.user_id where u.id is null) as orphans`);
  results.push([Number(left[0].users) === 0 ? 'PASS' : 'FAIL', `cleanup removed test users (${left[0].users} left, ${left[0].orphans} orphan entries)`]);
}
for (const r of results) console.log(r.join('  '));
if (results.some(r => r[0] === 'FAIL')) process.exit(1);
