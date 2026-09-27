const $=s=>document.querySelector(s),M=Murph,KEY='murph-ish-PROTOTYPE-v1';
let currentToday=M.today(),date=currentToday,mode='demo',demo=M.demo(currentToday),mine=[],metric='overall',focus='pull',customKey='run',saveError=false;
let variant=new URLSearchParams(location.search).get('variant')||'A';if(!['A','B','C'].includes(variant))variant='A';
const variants={A:'Four columns',B:'Exercise rows',C:'One at a time'};
const icons={run:'<circle cx="15" cy="4" r="2"/><path d="m12 8 4 3 4 1M7 9l5-1-2 7 5 3 2 4M10 15l-4 5H2"/>',pull:'<path d="M2 3h20M5 3v6l4 3m10-9v6l-4 3M9 12v5l-2 5m8-10v5l2 5M9 12h6"/><circle cx="12" cy="8" r="2"/>',push:'<path d="m2 15 6-5 8 2 5 2M8 10l1 8m7-6 1 6M3 19h19"/><circle cx="20" cy="9" r="2"/>',squat:'<circle cx="13" cy="4" r="2"/><path d="m12 8-3 6 7 1-2 6h6M12 8l5 3h5M9 14l-5 2v5h5"/>'};
function icon(key){return '<span class="exercise-icon" aria-hidden="true"><svg viewBox="0 0 24 24">'+icons[key]+'</svg></span>';}
function events(){return mode==='demo'?demo:mine;}
function fmt(n){return Number(n.toFixed(3)).toLocaleString('en-AU',{maximumFractionDigits:3});}
function percent(n){return n===null?'—':Math.round(n)+'%';}
function shortDate(day){return new Date(day+'T12:00:00Z').toLocaleDateString('en-AU',{day:'numeric',month:'short',timeZone:'UTC'});}
function announce(message){$('#feedback').textContent=message;}
function readSaved(){try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(!M.validEvents(data.events))throw Error('Invalid backup');mine=data.events;}else mine=[];}catch{saveError=true;}}
function persist(next){try{localStorage.setItem(KEY,JSON.stringify({schema:1,events:next}));saveError=false;return true;}catch{saveError=true;announce('Could not save. Your existing log is unchanged. Export a backup.');return false;}}
function update(next){if(mode==='demo')demo=next;else{if(!persist(next)){render();announce('Could not save this change. Existing entries are unchanged.');return false;}mine=next;}render();return true;}
function refreshDay(){const now=M.today();if(now!==currentToday){if(date===currentToday)date=now;currentToday=now;render();}}
function add(key,amount){refreshDay();if(!Number.isSafeInteger(amount)||amount<=0||amount>1000000)return;const e={id:crypto.randomUUID(),date,exercise:key,amount,createdAt:new Date().toISOString(),timeZone:'Australia/Sydney'};if(update([...events(),e])){announce(`+${key==='run'?fmt(amount/1000)+' km':amount+' '+M.exercises.find(x=>x.key===key).name.toLowerCase()} added${date!==currentToday?' to '+shortDate(date):''}.`);}}
function head(e,total){const n=total[e.key]||0;return `<div class="exercise-head"><div class="exercise-name">${icon(e.key)}${e.name}</div><div class="total">${e.key==='run'?fmt(n/1000):n}<small>${e.key==='run'?'km':'reps'}</small></div><div class="target">of ${e.key==='run'?'3.2 km':e.goal} · ${Math.round(n/e.goal*100)}%</div><div class="mini-track"><i style="width:${Math.min(100,n/e.goal*100)}%"></i></div></div>`;}
function buttons(e){return `<div class="add-buttons">${e.steps.map(n=>`<button class="add" data-add="${e.key}" data-amount="${n}" aria-label="Add ${n} ${e.unit} ${e.name.toLowerCase()}">+${e.key==='run'&&n===1000?'1':n}<span class="unit">${e.key==='run'?(n===1000?'km':'m'):''}</span></button>`).join('')}<button class="custom" data-custom="${e.key}">Custom +</button></div>`;}
function renderLogger(total){
  if(variant==='A')$('#logger').innerHTML=`<div class="exercise-grid">${M.exercises.map(e=>`<div class="exercise-col">${head(e,total)}${buttons(e)}</div>`).join('')}</div>`;
  else if(variant==='B')$('#logger').innerHTML=`<div class="exercise-rows">${M.exercises.map(e=>`<div class="exercise-row">${head(e,total)}${buttons(e)}</div>`).join('')}</div>`;
  else{const e=M.exercises.find(e=>e.key===focus);$('#logger').innerHTML=`<div class="focus-tabs">${M.exercises.map(e=>`<button data-focus="${e.key}" aria-pressed="${e.key===focus}">${e.name}</button>`).join('')}</div><div class="focus-body">${head(e,total)}${buttons(e)}</div><div class="focus-summary">${M.exercises.map(e=>e.name+' '+(e.key==='run'?fmt((total.run||0)/1000)+' km':total[e.key]||0)).join(' · ')}</div>`;}
}
function path(rows,key,x,y){let d='',connected=false;rows.forEach((r,i)=>{if(r[key]===null){connected=false;return;}d+=(connected?' L':' M')+x(i).toFixed(1)+' '+y(r[key]).toFixed(1);connected=true;});return d;}
function renderChart(){
  const rows=M.series(events(),date,Number($('#range').value),metric),last=rows.at(-1),max=Math.max(100,...rows.flatMap(r=>[r.daily,r.three||0,r.fourteen||0])),ceiling=Math.ceil(max/25)*25;
  $('#last3').textContent=percent(last.three);$('#last14').textContent=percent(last.fourteen);
  $('#last3-caption').textContent=last.last3.length?last.last3.map(shortDate).join(' · '):'No active days yet';
  $('#last14-caption').textContent=last.last14.length?`Across ${last.last14.length} active ${last.last14.length===1?'day':'days'}`:'No activity in this window';
  $('#active-count').innerHTML=last.last14.length+'<span>/14</span>';
  const w=600,h=260,left=40,right=12,top=20,bottom=35,x=i=>left+i/(rows.length-1)*(w-left-right),y=n=>h-bottom-n/ceiling*(h-top-bottom);
  const grid=[0,.25,.5,.75,1].map(t=>{const n=t*ceiling;return `<line x1="${left}" x2="${w-right}" y1="${y(n)}" y2="${y(n)}" stroke="#454047" stroke-dasharray="${n===100?'4 4':'0'}"/><text x="${left-8}" y="${y(n)+4}" text-anchor="end">${Math.round(n)}%</text>`;}).join('');
  const labels=[0,Math.floor(rows.length/2),rows.length-1].map(i=>`<text x="${x(i)}" y="${h-8}" text-anchor="${i===0?'start':i===rows.length-1?'end':'middle'}">${shortDate(rows[i].date)}</text>`).join('');
  const dots=rows.map((r,i)=>`<circle cx="${x(i)}" cy="${y(r.daily)}" r="2.5" fill="#8c8595"><title>${shortDate(r.date)}: daily ${percent(r.daily)}, last 3 ${percent(r.three)}, 14-day ${percent(r.fourteen)}</title></circle>`).join('');
  $('#chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${metric==='overall'?'Overall':M.exercises.find(e=>e.key===metric).name} progress for ${rows.length} days ending ${date}. Daily ${percent(last.daily)}, last three active days ${percent(last.three)}, fourteen day active average ${percent(last.fourteen)}.">${grid}<path d="${path(rows,'daily',x,y)}" fill="none" stroke="#827b8b" stroke-width="1.3"/>${dots}<path d="${path(rows,'fourteen',x,y)}" fill="none" stroke="#c0b9c8" stroke-width="2.2" stroke-dasharray="6 5"/><path d="${path(rows,'three',x,y)}" fill="none" stroke="#f6f5f1" stroke-width="2.8"/>${labels}</svg>`;
  $('#chart-note').textContent=`${mode==='demo'?'Illustrative data. ':''}${last.last14.length} active ${last.last14.length===1?'day':'days'} in the last 14. Rest days stay in the daily line; averages use active days. ${date!==currentToday?'As of '+shortDate(date)+'.':''}`;
  $('#chart-table').innerHTML='<table><thead><tr><th>Date</th><th>Daily</th><th>Last 3 active</th><th>14-day active</th></tr></thead><tbody>'+rows.slice().reverse().map(r=>`<tr><td>${r.date}</td><td>${percent(r.daily)}</td><td>${percent(r.three)}</td><td>${percent(r.fourteen)}</td></tr>`).join('')+'</tbody></table>';
}
function renderHistory(){const list=events().filter(e=>e.date===date).slice().reverse();$('#history-heading').textContent=date===currentToday?"Today's sets.":shortDate(date)+" · sets.";$('#set-count').textContent=list.length+' entries';$('#entries').replaceChildren();if(!list.length){$('#entries').innerHTML='<div class="empty">A clean slate.<small>One set is a perfectly good place to start.</small></div>';return;}for(const e of list){const row=document.createElement('div');row.className='entry';const ex=M.exercises.find(x=>x.key===e.exercise);const label=document.createElement('div');label.innerHTML=icon(e.exercise);const name=document.createElement('b');name.textContent=ex.name+' +'+(e.exercise==='run'?fmt(e.amount/1000)+' km':e.amount);label.append(name);const right=document.createElement('div');const time=document.createElement('time');time.textContent=new Date(e.createdAt).toLocaleTimeString('en-AU',{timeZone:'Australia/Sydney',hour:'numeric',minute:'2-digit'});const remove=document.createElement('button');remove.className='quiet';remove.textContent='Undo';remove.setAttribute('aria-label','Undo '+name.textContent);remove.onclick=()=>{if(update(events().filter(x=>x.id!==e.id)))announce('Entry undone.');};right.append(time,remove);row.append(label,right);$('#entries').append(row);}}
function render(){
  const total=M.totals(events())[date]||{},score=M.score(total);
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mode===mode));
  document.querySelectorAll('[data-metric]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.metric===metric));
  $('#log-date').value=date;$('#log-date').max=currentToday;
  $('#today-heading').textContent=date===currentToday?"Today's little victories.":shortDate(date)+' · little victories.';
  $('#day-score').textContent=score>0&&score<1?'<1':Math.floor(score);$('#overall-fill').style.width=score+'%';
  $('#score-caption').textContent=score>=100?'A full day’s volume. Nicely done.':'Daily volume, gathered as you go.';
  $('#variant-label').textContent=variant+' · '+variants[variant];
  $('#undo').disabled=!events().some(e=>e.date===date);
  $('#storage-label').textContent=mode==='demo'?'Sample history · changes reset on reload':saveError?'Storage unavailable or unreadable · export before continuing':'Saved in this browser · no cloud backup';
  $('#import').disabled=mode==='demo';
  renderLogger(total);renderChart();renderHistory();
}
function switchVariant(delta){const keys=['A','B','C'];variant=keys[(keys.indexOf(variant)+delta+3)%3];const url=new URL(location.href);url.searchParams.set('variant',variant);history.replaceState(null,'',url);render();console.info('Murph-ish prototype state',{variant,mode,date,events:events(),totals:M.totals(events()),summary:M.summary(M.totals(events()),date,metric)});}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.add)add(b.dataset.add,Number(b.dataset.amount));
  if(b.dataset.mode){mode=b.dataset.mode;try{localStorage.setItem(KEY+'-mode',mode);}catch{}render();announce(mode==='demo'?'You’re trying sample data.':'Your own log. Saved only in this browser.');}
  if(b.dataset.metric){metric=b.dataset.metric;render();}
  if(b.dataset.focus){focus=b.dataset.focus;renderLogger(M.totals(events())[date]||{});}
  if(b.dataset.custom){customKey=b.dataset.custom;const ex=M.exercises.find(x=>x.key===customKey),input=$('#amount');$('#custom-title').textContent='Add '+ex.name.toLowerCase();$('#amount-label').textContent=customKey==='run'?'Distance in kilometres':'Number of reps';input.step=customKey==='run'?'0.001':'1';input.min=customKey==='run'?'0.001':'1';input.max=customKey==='run'?'1000':'1000000';input.inputMode=customKey==='run'?'decimal':'numeric';input.value='';$('#custom-form button[type=submit]').textContent=date===currentToday?'Add to today':'Add to '+shortDate(date);$('#custom-dialog').showModal();input.focus();}
});
$('#custom-form').onsubmit=e=>{e.preventDefault();const n=Number($('#amount').value),amount=customKey==='run'?Math.round(n*1000):n;if(n>0&&Number.isSafeInteger(amount)&&amount>0&&amount<=1000000){add(customKey,amount);$('#custom-dialog').close();}};
$('#cancel-custom').onclick=()=>$('#custom-dialog').close();
$('#undo').onclick=()=>{const latest=events().filter(e=>e.date===date).at(-1);if(latest&&update(events().filter(e=>e.id!==latest.id)))announce('Last entry undone.');};
$('#log-date').onchange=e=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)||e.target.value>currentToday){e.target.value=date;return;}date=e.target.value;render();announce(date===currentToday?'Logging today.':'Logging '+shortDate(date)+'.');};
$('#range').onchange=renderChart;$('#previous').onclick=()=>switchVariant(-1);$('#next').onclick=()=>switchVariant(1);
document.addEventListener('keydown',e=>{if(e.target.closest('input,textarea,select,[contenteditable],dialog'))return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();switchVariant(e.key==='ArrowLeft'?-1:1);}});
$('#width').onclick=()=>{document.body.classList.toggle('phone-preview');$('#width').textContent=document.body.classList.contains('phone-preview')?'Wide view':'Phone view';};
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export').onclick=()=>download(JSON.stringify({schema:1,app:'Murph-ish prototype',mode,timeZone:'Australia/Sydney',targets:{runMetres:3200,pull:100,push:200,squat:300},events:events()},null,2),`murph-ish-${mode}-${currentToday}.json`,'application/json');
$('#csv').onclick=()=>{const days=M.totals(events());download('date,run_km,pull_ups,push_ups,squats,overall_percent\n'+Object.keys(days).sort().map(d=>[d,days[d].run/1000,days[d].pull,days[d].push,days[d].squat,M.score(days[d]).toFixed(2)].join(',')).join('\n'),`murph-ish-${mode}-${currentToday}.csv`,'text/csv');};
$('#import').onclick=()=>$('#import-file').click();
$('#import-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>20000000)throw Error();const data=JSON.parse(await file.text());if(data.schema!==1||data.mode!=='mine'||!M.validEvents(data.events))throw Error();const merged=new Map(mine.map(e=>[e.id,e]));for(const event of data.events){if(merged.has(event.id)){const old=merged.get(event.id);if(['date','exercise','amount','createdAt'].some(k=>old[k]!==event[k]))throw Error();}else merged.set(event.id,event);}const next=[...merged.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)),count=next.length-mine.length;if(update(next))announce(`Restored ${count} new entries. Existing entries were kept.`);}catch{announce('Could not restore: choose a valid My log backup from this prototype.');}e.target.value='';};
window.addEventListener('storage',e=>{if(e.key===KEY){readSaved();render();}});
window.addEventListener('focus',refreshDay);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshDay();});
setInterval(refreshDay,30000);readSaved();try{if(localStorage.getItem(KEY+'-mode')==='mine')mode='mine';}catch{}render();
