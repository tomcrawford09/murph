/* Murph in Progress. A tap saves to this phone first (IndexedDB), then backs up to Supabase in the background. */
const $=s=>document.querySelector(s),M=Murph,S=MurphStore,Y=MurphSync,C=window.MURPH_CONFIG||{};
const client=C.supabaseUrl&&C.supabaseKey&&window.supabase?window.supabase.createClient(C.supabaseUrl,C.supabaseKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const state={entries:[],owner:null,session:null,participant:null,profile:null,notice:'',storageOk:true,loaded:false,
  today:M.today(),date:M.today(),metric:'overall',customKey:'run',view:'log',week:0,
  sync:{phase:'idle',error:'',lastOk:null},board:{phase:'idle',rows:[],error:''}};
const channel='BroadcastChannel' in window?new BroadcastChannel('murph-in-progress'):null;
const icons={run:'<circle cx="15" cy="4" r="2"/><path d="m12 8 4 3 4 1M7 9l5-1-2 7 5 3 2 4M10 15l-4 5H2"/>',pull:'<path d="M2 3h20M5 3v6l4 3m10-9v6l-4 3M9 12v5l-2 5m8-10v5l2 5M9 12h6"/><circle cx="12" cy="8" r="2"/>',push:'<path d="m2 15 6-5 8 2 5 2M8 10l1 8m7-6 1 6M3 19h19"/><circle cx="20" cy="9" r="2"/>',squat:'<circle cx="13" cy="4" r="2"/><path d="m12 8-3 6 7 1-2 6h6M12 8l5 3h5M9 14l-5 2v5h5"/>'};
function icon(key){return '<span class="exercise-icon" aria-hidden="true"><svg viewBox="0 0 24 24">'+icons[key]+'</svg></span>';}
function fmt(n){return Number(n.toFixed(3)).toLocaleString('en-AU',{maximumFractionDigits:3});}
function percent(n){return n===null?'–':Math.round(n)+'%';}
function shortDate(day){return new Date(day+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});}
function clock(d){return new Date(d).toLocaleTimeString('en-AU',{timeZone:M.TIME_ZONE,hour:'numeric',minute:'2-digit'});}
function announce(message){$('#feedback').textContent=message;}
function exercise(key){return M.exercises.find(x=>x.key===key);}
function amountLabel(key,n){return key==='run'?fmt(n/1000)+' km':n+' '+exercise(key).name.toLowerCase();}
function visible(){return state.entries.filter(e=>e.owner===state.owner&&!e.deleted_at);}
function pendingCount(){return Y.pendingCount(state.entries,state.owner);}

/* Every change to local entries runs through one queue, so each step sees the latest committed state. */
let queue=Promise.resolve();
function mutate(fn){
  const step=queue.then(async()=>{
    const changed=fn(state.entries)||[];
    if(!changed.length)return changed;
    await S.putEntries(changed);
    const byId=new Map(state.entries.map(e=>[e.entry_id,e]));for(const e of changed)byId.set(e.entry_id,e);
    state.entries=[...byId.values()];state.storageOk=true;channel?.postMessage('changed');
    return changed;
  });
  queue=step.catch(()=>{});
  return step;
}
function purge(owner){
  const step=queue.then(async()=>{const ids=state.entries.filter(e=>e.owner===owner).map(e=>e.entry_id);if(ids.length)await S.removeEntries(ids);state.entries=state.entries.filter(e=>e.owner!==owner);channel?.postMessage('changed');});
  queue=step.catch(()=>{});return step;
}
function reloadFromDisk(){const step=queue.then(async()=>{state.entries=await S.allEntries();});queue=step.catch(()=>{});return step.then(render,()=>{});}

let persistAsked=false;
function requestPersistence(){if(persistAsked)return;persistAsked=true;try{navigator.storage?.persist?.().catch(()=>{});}catch{}}
function refreshDay(){const now=M.today();if(now!==state.today){if(state.date===state.today)state.date=now;state.today=now;render();}}

let lastTap=0;
async function add(key,amount){
  refreshDay();
  if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000)return;
  lastTap=Math.max(Date.now(),lastTap+1); // strictly increasing, so "undo last" and the history agree on order
  const e={entry_id:crypto.randomUUID(),owner:state.owner,occurred_at:new Date(lastTap).toISOString(),local_date:state.date,timezone:M.TIME_ZONE,exercise:key,quantity:amount,target_version:M.TARGET_VERSION,deleted_at:null,pushed:false,delete_pushed:false};
  try{await mutate(()=>[e]);}catch{state.storageOk=false;render();announce('Not saved: this phone refused to store the entry. Nothing was added.');return;}
  render();announce(`+${amountLabel(key,amount)} added${state.date!==state.today?' to '+shortDate(state.date):''}.`);
  requestPersistence();scheduleSync();
}
async function undo(id,message){
  try{await mutate(entries=>{const e=entries.find(x=>x.entry_id===id);return e&&!e.deleted_at?[{...e,deleted_at:new Date().toISOString(),delete_pushed:false}]:[];});}
  catch{state.storageOk=false;render();announce('Could not undo: this phone refused the change.');return;}
  render();announce(message);scheduleSync();
}

/* Reset: clears one exercise, or everything, for the date shown. Same one-way deletion markers as undo. */
let resetKey=null;
function resetScope(key){return visible().filter(e=>e.local_date===state.date&&(key==='all'||e.exercise===key));}
function setsLabel(n){return n+(n===1?' set':' sets');}
function dayLabel(){return state.date===state.today?'today':shortDate(state.date);}
function renderReset(){
  const total=M.totals(visible())[state.date]||{},box=$('#reset-options');
  $('#reset-title').textContent='Reset '+dayLabel();box.replaceChildren();
  for(const e of [...M.exercises,{key:'all',name:'Everything'}]){
    const n=resetScope(e.key).length,b=document.createElement('button'),name=document.createElement('span'),detail=document.createElement('small');
    b.type='button';b.dataset.reset=e.key;b.disabled=!n;b.setAttribute('aria-pressed',resetKey===e.key);
    name.textContent=e.name;detail.textContent=e.key==='all'?setsLabel(n):`${e.key==='run'?fmt((total.run||0)/1000)+' km':(total[e.key]||0)+' reps'} · ${setsLabel(n)}`;
    b.append(name,detail);box.append(b);
  }
  const n=resetKey?resetScope(resetKey).length:0,chosen=n?resetKey:null;
  $('#reset-copy').textContent=!chosen?`Choose what to clear from ${dayLabel()}.`:`This removes ${chosen==='all'?'all '+setsLabel(n):setsLabel(n)+' of '+exercise(chosen).name.toLowerCase()} from ${dayLabel()}, on every device. It can’t be undone.`;
  $('#confirm-reset').disabled=!chosen;$('#confirm-reset').textContent=!chosen?'Reset':chosen==='all'?'Reset everything':'Reset '+exercise(chosen).name.toLowerCase();
}
function openReset(){resetKey=null;renderReset();$('#reset-dialog').showModal();}
async function confirmReset(){
  const key=resetKey,ids=new Set(resetScope(key).map(e=>e.entry_id)),day=dayLabel();
  if(!ids.size)return;
  const now=new Date().toISOString();
  try{await mutate(entries=>entries.filter(e=>ids.has(e.entry_id)&&!e.deleted_at).map(e=>({...e,deleted_at:now,delete_pushed:false})));}
  catch{state.storageOk=false;render();announce('Could not reset: this phone refused the change.');return;}
  $('#reset-dialog').close();resetKey=null;render();
  announce(`${key==='all'?'Everything':exercise(key).name} reset for ${day}.`);scheduleSync();
}

/* Backup */
let syncTimer=null,syncing=null,again=false;
function describe(err){
  const text=String(err?.message||err||'');
  if(!navigator.onLine||/failed to fetch|networkerror|load failed|network request failed/i.test(text))return 'offline, will retry';
  if(err?.status===401||/jwt|token|session/i.test(text))return 'sign in again';
  if(err?.code==='42501')return 'this account can’t back up';
  return text.slice(0,80)||'backup failed';
}
function canSync(){return !!(client&&state.session&&state.participant===true&&state.owner===state.session.user.id);}
function scheduleSync(delay=1200){clearTimeout(syncTimer);syncTimer=setTimeout(syncNow,delay);}
function syncNow(){
  clearTimeout(syncTimer);
  if(!canSync())return Promise.resolve();
  if(syncing){again=true;return syncing;}
  state.sync={...state.sync,phase:'syncing'};renderStatus();
  const owner=state.owner;
  syncing=(async()=>{
    let retry=0;
    try{
      const result=await Y.run({client,owner,getEntries:()=>state.entries,mutate,getCursor:()=>S.getMeta('cursor:'+owner),setCursor:v=>S.setMeta('cursor:'+owner,v)});
      state.sync={phase:'idle',error:'',lastOk:new Date()};
      if(result.pending)again=true;
    }catch(err){
      state.sync={...state.sync,phase:'failed',error:describe(err)};retry=30000;
      if(err?.code==='42501')state.participant=null;
    }finally{syncing=null;}
    render();
    if(state.view==='friends')loadBoard();
    if(again||retry){again=false;if(!document.hidden)scheduleSync(retry||300);}
  })();
  return syncing;
}

/* Accounts */
async function verify(session){
  const uid=session.user.id;
  let status;
  try{const {data,error}=await client.rpc('my_status');if(error)throw error;status=data;await S.setMeta('status:'+uid,status).catch(()=>{});}
  catch{status=await S.getMeta('status:'+uid).catch(()=>undefined);}
  if(status?.participant===false){
    state.notice=`${session.user.email||'That Google account'} isn’t invited yet. Your entries stay on this phone.`;
    state.participant=null;await client.auth.signOut({scope:'local'}).catch(()=>{});return;
  }
  state.notice='';
  if(status?.participant!==true){state.participant=null;render();return;}
  state.participant=true;state.profile=status;
  if(state.owner!==uid){state.owner=uid;await S.setMeta('last_owner',uid).catch(()=>{});}
  try{await mutate(entries=>entries.filter(e=>e.owner==null).map(e=>({...e,owner:uid})));}catch{state.storageOk=false;}
  render();syncNow();
  if(state.view==='friends')loadBoard();
}
async function onAuth(event,session){
  const was=state.session?.user?.id;state.session=session;
  if(!session){state.participant=null;state.profile=null;state.owner=(await S.getMeta('last_owner').catch(()=>null))||null;render();return;}
  if(event==='TOKEN_REFRESHED'||(was===session.user.id&&state.participant===true)){render();return;}
  await verify(session);
}
async function signIn(){
  if(!client)return;
  if(!navigator.onLine){$('#account-copy').textContent='You’re offline. Sign in when you have signal; your entries are safe on this phone meanwhile.';return;}
  const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname,queryParams:{prompt:'select_account'}}});
  if(error)$('#account-copy').textContent='Could not start Google sign-in: '+describe(error)+'.';
}
async function signOut(){
  const owner=state.owner,n=pendingCount();
  if(n&&!confirm(`${n} ${n===1?'entry hasn’t':'entries haven’t'} backed up yet. They’ll stay hidden on this phone and back up when you next sign in. Sign out anyway?`))return;
  await S.setMeta('last_owner',undefined).catch(()=>{});
  if(!n&&owner){await purge(owner).catch(()=>{});await S.setMeta('cursor:'+owner,undefined).catch(()=>{});}
  await client.auth.signOut({scope:'local'}).catch(()=>{});
  state.session=null;state.participant=null;state.profile=null;state.owner=null;state.sync={phase:'idle',error:'',lastOk:null};
  $('#account-dialog').close();render();announce('Signed out.');
}

/* Friends */
async function loadBoard(){
  if(!canSync()){renderFriends();return;}
  state.board={...state.board,phase:'loading'};renderFriends();
  const week=state.week,{data,error}=await client.rpc('leaderboard',{week_offset:week});
  if(week!==state.week)return;
  state.board=error?{phase:'failed',rows:[],error:describe(error)}:{phase:'ready',rows:data||[],error:''};
  renderFriends();
}

/* Rendering */
function statusInfo(){
  if(!state.loaded)return {text:'Opening your log…'};
  if(!state.storageOk)return {text:'This phone isn’t saving entries. Check storage settings or leave private browsing.',tone:'bad'};
  const n=pendingCount(),waiting=`${n} ${n===1?'entry':'entries'} not backed up`;
  if(!client)return {text:'Saved on this phone · cloud backup not set up yet'};
  if(!state.session)return {text:state.notice||(n?`Saved on this phone · ${waiting}`:'Saved on this phone'),action:'Sign in to back up',tone:state.notice?'warn':''};
  if(state.participant!==true)return {text:'Saved on this phone · checking your invitation',action:'Retry',tone:'warn'};
  if(state.sync.phase==='syncing')return {text:'Backing up…'};
  if(state.sync.phase==='failed')return {text:`Sync pending · ${n?waiting+', ':''}${state.sync.error}`,action:'Retry',tone:'warn'};
  if(n)return {text:`Sync pending · ${waiting}`,action:'Back up now'};
  return {text:`Backed up${state.sync.lastOk?' · '+clock(state.sync.lastOk):''}`,tone:'ok'};
}
function renderStatus(){
  const s=statusInfo(),b=$('#status-action');
  $('#status').textContent=s.text;$('#status').dataset.tone=s.tone||'';
  b.hidden=!s.action;b.textContent=s.action||'';
}
function head(e){return `<div class="exercise-head"><div class="exercise-name">${icon(e.key)}${e.name}</div><div class="total"><span data-total="${e.key}">0</span><small>${e.key==='run'?'km':'reps'}</small></div><div class="target" data-target="${e.key}"></div><div class="mini-track"><i data-track="${e.key}"></i></div></div>`;}
/* The button grid is built once and then updated in place, so a fast second tap never lands on a replaced button. */
function renderLogger(total){
  if(!$('#logger').firstChild)$('#logger').innerHTML=`<div class="exercise-grid">${M.exercises.map(e=>`<div class="exercise-col">${head(e)}${buttons(e)}</div>`).join('')}</div>`;
  for(const e of M.exercises){const n=total[e.key]||0;$(`[data-total="${e.key}"]`).textContent=e.key==='run'?fmt(n/1000):n;$(`[data-target="${e.key}"]`).textContent=`of ${e.key==='run'?'3.2 km':e.goal} · ${Math.round(n/e.goal*100)}%`;$(`[data-track="${e.key}"]`).style.width=Math.min(100,n/e.goal*100)+'%';}
}
function buttons(e){return `<div class="add-buttons">${e.steps.map(n=>`<button class="add" data-add="${e.key}" data-amount="${n}" aria-label="Add ${n} ${e.unit} ${e.name.toLowerCase()}">+${e.key==='run'&&n===1000?'1':n}<span class="unit">${e.key==='run'?(n===1000?'km':'m'):''}</span></button>`).join('')}<button class="custom" data-custom="${e.key}">Custom +</button></div>`;}
function path(rows,key,x,y){let d='',connected=false;rows.forEach((r,i)=>{if(r[key]===null){connected=false;return;}d+=(connected?' L':' M')+x(i).toFixed(1)+' '+y(r[key]).toFixed(1);connected=true;});return d;}
function renderChart(){
  const rows=M.series(visible(),state.date,Number($('#range').value),state.metric),last=rows.at(-1),max=Math.max(100,...rows.flatMap(r=>[r.daily,r.three||0,r.fourteen||0])),ceiling=Math.ceil(max/25)*25;
  $('#last3').textContent=percent(last.three);$('#last14').textContent=percent(last.fourteen);
  $('#last3-caption').textContent=last.last3.length?last.last3.map(shortDate).join(' · '):'No active days yet';
  $('#last14-caption').textContent=last.last14.length?`Across ${last.last14.length} active ${last.last14.length===1?'day':'days'}`:'No activity in this window';
  $('#active-count').innerHTML=last.last14.length+'<span>/14</span>';
  const w=600,h=260,left=40,right=12,top=20,bottom=35,x=i=>left+i/(rows.length-1)*(w-left-right),y=n=>h-bottom-n/ceiling*(h-top-bottom);
  const grid=[0,.25,.5,.75,1].map(t=>{const n=t*ceiling;return `<line x1="${left}" x2="${w-right}" y1="${y(n)}" y2="${y(n)}" stroke="#454047" stroke-dasharray="${n===100?'4 4':'0'}"/><text x="${left-8}" y="${y(n)+4}" text-anchor="end">${Math.round(n)}%</text>`;}).join('');
  const labels=[0,Math.floor(rows.length/2),rows.length-1].map(i=>`<text x="${x(i)}" y="${h-8}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${shortDate(rows[i].date)}</text>`).join('');
  const dots=rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.daily)}" r="2.5" fill="#8c8595"><title>${shortDate(r.date)}: daily ${percent(r.daily)}, last 3 ${percent(r.three)}, 14-day ${percent(r.fourteen)}</title></circle>`).join('');
  $('#chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${state.metric==='overall'?'Overall':exercise(state.metric).name} progress for ${rows.length} days ending ${state.date}. Daily ${percent(last.daily)}, last three active days ${percent(last.three)}, fourteen day active average ${percent(last.fourteen)}.">${grid}<path d="${path(rows,'daily',x,y)}" fill="none" stroke="#827b8b" stroke-width="1.3"/>${dots}<path d="${path(rows,'fourteen',x,y)}" fill="none" stroke="#c0b9c8" stroke-width="2.2" stroke-dasharray="6 5"/><path d="${path(rows,'three',x,y)}" fill="none" stroke="#f6f5f1" stroke-width="2.8"/>${labels}</svg>`;
  $('#chart-note').textContent=`${last.last14.length} active ${last.last14.length===1?'day':'days'} in the last 14. Rest days stay in the daily line; averages use active days. ${state.date!==state.today?'As of '+shortDate(state.date)+'.':''}`;
  $('#chart-table').innerHTML='<table><thead><tr><th>Date</th><th>Daily</th><th>Last 3 active</th><th>14-day active</th></tr></thead><tbody>'+rows.slice().reverse().map(r=>`<tr><td>${r.date}</td><td>${percent(r.daily)}</td><td>${percent(r.three)}</td><td>${percent(r.fourteen)}</td></tr>`).join('')+'</tbody></table>';
}
function renderHistory(){
  const list=visible().filter(e=>e.local_date===state.date).sort((a,b)=>b.occurred_at.localeCompare(a.occurred_at));
  $('#history-heading').textContent=state.date===state.today?"Today's sets.":shortDate(state.date)+' · sets.';
  $('#set-count').textContent=list.length+(list.length===1?' entry':' entries');
  $('#entries').replaceChildren();
  if(!list.length){$('#entries').innerHTML='<div class="empty">A clean slate.<small>One set is a perfectly good place to start.</small></div>';return;}
  for(const e of list){
    const row=document.createElement('div');row.className='entry';
    const label=document.createElement('div');label.innerHTML=icon(e.exercise);
    const name=document.createElement('b');name.textContent=exercise(e.exercise).name+' +'+(e.exercise==='run'?fmt(e.quantity/1000)+' km':e.quantity);label.append(name);
    const right=document.createElement('div'),time=document.createElement('time'),remove=document.createElement('button');
    time.textContent=clock(e.occurred_at)+(e.pushed?'':' · on phone');
    remove.className='quiet';remove.type='button';remove.textContent='Undo';remove.setAttribute('aria-label','Undo '+name.textContent);
    remove.onclick=()=>undo(e.entry_id,'Entry undone.');
    right.append(time,remove);row.append(label,right);$('#entries').append(row);
  }
}
function renderLog(){
  const total=M.totals(visible())[state.date]||{},score=M.score(total);
  document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.metric===state.metric));
  $('#log-date').value=state.date;$('#log-date').max=state.today;
  $('#today-heading').textContent=state.date===state.today?"Today's little victories.":shortDate(state.date)+' · little victories.';
  $('#day-score').textContent=score>0&&score<1?'<1':Math.floor(score);$('#overall-fill').style.width=score+'%';
  $('#score-caption').textContent=score>=100?'A full day’s volume. Nicely done.':'Daily volume, gathered as you go.';
  $('#undo').disabled=$('#reset').disabled=!visible().some(e=>e.local_date===state.date);
  renderLogger(total);renderChart();renderHistory();
}
function renderFriends(){
  const gate=$('#friends-gate'),wrap=$('#board-wrap'),profile=$('#profile-section');
  let message='';
  if(!client)message='The leaderboard switches on once cloud backup is set up.';
  else if(!state.session)message=state.notice||'Sign in to see how your week stacks up against friends. Your log keeps working without it.';
  else if(state.participant!==true)message='Checking your invitation. The leaderboard needs a connection.';
  gate.hidden=!message;wrap.hidden=!!message;profile.hidden=!!message;
  if(message){gate.replaceChildren();const p=document.createElement('p');p.textContent=message;gate.append(p);if(client&&!state.session){const b=document.createElement('button');b.className='primary';b.type='button';b.textContent='Sign in';b.onclick=openAccount;gate.append(b);}return;}
  const start=M.shift(M.weekStart(state.today),7*state.week),mine=M.weeklyPoints(M.totals(visible()),start);
  $('#week-label').textContent=`Week of ${shortDate(start)} to ${shortDate(M.shift(start,6))}. On this phone you have ${Math.round(mine.points*10)/10} points across ${mine.active} active ${mine.active===1?'day':'days'}.`;
  const board=$('#board');board.replaceChildren();
  if(state.board.phase==='loading'&&!state.board.rows.length){board.textContent='Loading the leaderboard…';}
  else if(state.board.phase==='failed'){board.textContent='Could not load the leaderboard: '+state.board.error+'.';}
  else if(!state.board.rows.length){const p=document.createElement('p');p.className='empty';p.textContent='Nobody on the board yet.';const s=document.createElement('small');s.textContent='Choose a leaderboard name below and switch on “Show me” to be the first.';p.append(s);board.append(p);}
  else{
    const table=document.createElement('table');table.className='board';
    table.innerHTML='<thead><tr><th>#</th><th>Name</th><th>Points</th><th>Active days</th></tr></thead>';
    const body=document.createElement('tbody');
    for(const r of state.board.rows){const tr=document.createElement('tr');if(r.is_me)tr.className='me';for(const v of [r.rank,r.leaderboard_name+(r.is_me?' (you)':''),Number(r.points).toLocaleString('en-AU',{maximumFractionDigits:1}),r.active_days]){const td=document.createElement('td');td.textContent=String(v);tr.append(td);}body.append(tr);}
    table.append(body);board.append(table);
  }
  const form=$('#profile-form');
  if(!form.contains(document.activeElement)){$('#leaderboard-name').value=state.profile?.leaderboard_name||'';$('#show-me').checked=!!state.profile?.show_on_leaderboard;}
}
function renderAccount(){
  const signedIn=!!state.session,email=state.session?.user?.email||'';
  $('#account-title').textContent=!client?'Backup isn’t set up yet.':signedIn?'Your log is backing up.':'Back up your log.';
  $('#account-copy').textContent=!client?'Entries are saved on this phone only.':signedIn?`Signed in as ${email}. ${statusInfo().text}.`:(state.notice||'Sign in with Google to back up your log, restore it on a new phone and join the friends leaderboard. Invite only.');
  $('#sign-in').hidden=!client||signedIn;$('#sync-now').hidden=!signedIn;$('#sign-out').hidden=!signedIn;
}
function render(){
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.view===state.view));
  $('#log-view').hidden=state.view!=='log';$('#friends-view').hidden=state.view!=='friends';
  renderStatus();
  if(state.view==='log')renderLog();else renderFriends();
  if($('#account-dialog').open)renderAccount();
}
function openAccount(){renderAccount();$('#account-dialog').showModal();}

/* Backup files */
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function exportJson(){
  const entries=state.entries.filter(e=>e.owner===state.owner).map(({owner,pushed,delete_pushed,...e})=>e);
  download(JSON.stringify({schema:2,app:'Murph in Progress',exported_at:new Date().toISOString(),time_zone:M.TIME_ZONE,targets:{run_metres:3200,pull:100,push:200,squat:300},entries},null,2),`murph-in-progress-${state.today}.json`,'application/json');
}
function exportCsv(){const days=M.totals(visible());download('date,run_km,pull_ups,push_ups,squats,overall_percent\n'+Object.keys(days).sort().map(d=>[d,days[d].run/1000,days[d].pull,days[d].push,days[d].squat,M.score(days[d]).toFixed(2)].join(',')).join('\n'),`murph-in-progress-${state.today}.csv`,'text/csv');}
async function importFile(file){
  let incoming;
  try{if(file.size>20000000)throw Error();incoming=M.parseBackup(JSON.parse(await file.text()));}
  catch{announce('Could not restore: choose a Murph in Progress backup or a Murph-ish prototype “My log” backup.');return;}
  let added=0,removed=0;
  try{
    await mutate(entries=>{const byId=new Map(entries.map(e=>[e.entry_id,e])),out=[];for(const r of incoming){const e=byId.get(r.entry_id);if(!e){out.push({...r,owner:state.owner,pushed:false,delete_pushed:false});added++;}else if(e.owner===state.owner&&r.deleted_at&&!e.deleted_at){out.push({...e,deleted_at:r.deleted_at,delete_pushed:false});removed++;}}return out;});
    await S.setMeta('cursor:'+state.owner,undefined);
  }catch{state.storageOk=false;render();announce('Could not restore: this phone refused to store the entries.');return;}
  state.view='log';render();announce(`Restored ${added} new ${added===1?'entry':'entries'}${removed?`, ${removed} undone`:''}. Existing entries were kept.`);scheduleSync(300);
}

/* Events */
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.add)add(b.dataset.add,Number(b.dataset.amount));
  if(b.dataset.metric){state.metric=b.dataset.metric;renderLog();}
  if(b.dataset.reset){resetKey=b.dataset.reset;renderReset();}
  if(b.dataset.view){state.view=b.dataset.view;render();if(state.view==='friends')loadBoard();window.scrollTo(0,0);}
  if(b.dataset.custom){state.customKey=b.dataset.custom;const ex=exercise(state.customKey),input=$('#amount');$('#custom-title').textContent='Add '+ex.name.toLowerCase();$('#amount-label').textContent=state.customKey==='run'?'Distance in kilometres':'Number of reps';input.step=state.customKey==='run'?'0.001':'1';input.min=state.customKey==='run'?'0.001':'1';input.max=state.customKey==='run'?'1000':'1000000';input.inputMode=state.customKey==='run'?'decimal':'numeric';input.value='';$('#custom-form button[type=submit]').textContent=state.date===state.today?'Add to today':'Add to '+shortDate(state.date);$('#custom-dialog').showModal();input.focus();}
});
$('#custom-form').onsubmit=e=>{e.preventDefault();const n=Number($('#amount').value),amount=state.customKey==='run'?Math.round(n*1000):n;if(n>0&&Number.isSafeInteger(amount)&&amount>0&&amount<=1000000){add(state.customKey,amount);$('#custom-dialog').close();}};
$('#cancel-custom').onclick=()=>$('#custom-dialog').close();
$('#reset').onclick=openReset;$('#cancel-reset').onclick=()=>$('#reset-dialog').close();$('#confirm-reset').onclick=confirmReset;
$('#undo').onclick=()=>{const latest=visible().filter(e=>e.local_date===state.date).sort((a,b)=>a.occurred_at.localeCompare(b.occurred_at)).at(-1);if(latest)undo(latest.entry_id,'Last entry undone.');};
$('#log-date').onchange=e=>{if(!M.isDay(e.target.value)||e.target.value>state.today){e.target.value=state.date;return;}state.date=e.target.value;render();announce(state.date===state.today?'Logging today.':'Logging '+shortDate(state.date)+'.');};
$('#range').onchange=renderChart;
$('#week').onchange=e=>{state.week=Number(e.target.value);state.board={phase:'idle',rows:[],error:''};renderFriends();loadBoard();};
$('#status-action').onclick=()=>{if(!state.session)openAccount();else if(state.participant!==true)verify(state.session);else syncNow();};
$('#account').onclick=openAccount;$('#close-account').onclick=()=>$('#account-dialog').close();
$('#sign-in').onclick=signIn;$('#sign-out').onclick=signOut;$('#sync-now').onclick=()=>syncNow().then(renderAccount);
$('#profile-form').onsubmit=async e=>{
  e.preventDefault();const name=$('#leaderboard-name').value.trim(),show=$('#show-me').checked,fb=$('#profile-feedback');
  if(show&&!name){fb.textContent='Choose a leaderboard name to appear on the board.';return;}
  fb.textContent='Saving…';
  const {data,error}=await client.rpc('save_profile',{p_leaderboard_name:name,p_show:show});
  if(error){fb.textContent=error.code==='23505'?'That name is taken. Try another.':'Not saved: '+describe(error)+'.';return;}
  state.profile=data;S.setMeta('status:'+state.owner,data).catch(()=>{});fb.textContent=show?'Saved. You’re on the board.':'Saved. You’re hidden from the board.';
  $('#profile-form').querySelector('button').focus();loadBoard();
};
$('#export').onclick=exportJson;$('#csv').onclick=exportCsv;$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)importFile(file);};
channel&&(channel.onmessage=()=>reloadFromDisk());
window.addEventListener('online',()=>{if(state.session&&state.participant!==true)verify(state.session);else syncNow();});
window.addEventListener('offline',renderStatus);
window.addEventListener('focus',refreshDay);
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;refreshDay();syncNow();});
setInterval(refreshDay,30000);

/* Start */
(function readAuthError(){
  const params=new URLSearchParams(location.search+'&'+location.hash.slice(1)),error=params.get('error_description')||params.get('error');
  if(!error)return;
  state.notice=/invite/i.test(error)?'That Google account isn’t invited yet. Ask Tom for an invitation.':'Sign-in didn’t finish: '+error.replace(/\+/g,' ').slice(0,120);
  history.replaceState(null,'',location.pathname);
})();
(async function start(){
  try{state.entries=await S.allEntries();state.owner=(await S.getMeta('last_owner'))||null;}catch{state.storageOk=false;}
  state.loaded=true;render();
  if(client)client.auth.onAuthStateChange((event,session)=>{setTimeout(()=>onAuth(event,session),0);});
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
