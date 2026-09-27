/* Scoring and calendar rules. Training days are Australia/Sydney dates frozen at entry time; run quantities are integer metres. */
(function(root){
  const TIME_ZONE = 'Australia/Sydney', TARGET_VERSION = 'rounded-km-v1';
  const exercises = [
    {key:'run',name:'Run',goal:3200,unit:'m',steps:[100,250,500,1000]},
    {key:'pull',name:'Pull-ups',goal:100,unit:'reps',steps:[1,5,10,25]},
    {key:'push',name:'Push-ups',goal:200,unit:'reps',steps:[1,5,10,25]},
    {key:'squat',name:'Squats',goal:300,unit:'reps',steps:[1,5,10,25]}
  ];
  const dayFormat = new Intl.DateTimeFormat('en-CA',{timeZone:TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'});
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function today(now=new Date()){return dayFormat.format(now);}
  function shift(day,delta){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
  function weekStart(day){const dow=(new Date(day+'T12:00:00Z').getUTCDay()+6)%7;return shift(day,-dow);}
  function isDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&shift(day,0)===day;}
  function totals(entries){const out={};for(const e of entries){if(e.deleted_at)continue;out[e.local_date]??={run:0,pull:0,push:0,squat:0};out[e.local_date][e.exercise]+=e.quantity;}return out;}
  function score(total,metric='overall'){if(metric==='overall')return exercises.reduce((s,e)=>s+Math.min(1,(total?.[e.key]||0)/e.goal),0)*25;const e=exercises.find(e=>e.key===metric);return (total?.[metric]||0)/e.goal*100;}
  function activeDays(days,asOf){return Object.keys(days).filter(d=>d<=asOf&&Object.values(days[d]).some(n=>n>0)).sort();}
  function summary(days,asOf,metric='overall'){
    const active=activeDays(days,asOf),last3=active.slice(-3),last14=active.filter(d=>d>=shift(asOf,-13));
    const avg=dates=>dates.length?dates.reduce((s,d)=>s+score(days[d],metric),0)/dates.length:null;
    return {daily:score(days[asOf],metric),three:avg(last3),fourteen:avg(last14),last3,last14};
  }
  function series(entries,asOf,count,metric){const days=totals(entries);return Array.from({length:count},(_,i)=>{const date=shift(asOf,i-count+1);return {date,...summary(days,date,metric)};});}
  function weeklyPoints(days,day){const start=weekStart(day);let points=0,active=0;for(let i=0;i<7;i++){const t=days[shift(start,i)];if(t&&Object.values(t).some(n=>n>0)){points+=score(t);active++;}}return {start,points,active};}
  function validEntry(e,now=new Date()){
    return !!e&&typeof e.entry_id==='string'&&UUID.test(e.entry_id)&&isDay(e.local_date)&&e.local_date<=shift(today(now),1)&&exercises.some(x=>x.key===e.exercise)&&Number.isSafeInteger(e.quantity)&&e.quantity>0&&e.quantity<=1000000&&typeof e.occurred_at==='string'&&Number.isFinite(Date.parse(e.occurred_at))&&(e.deleted_at==null||Number.isFinite(Date.parse(e.deleted_at)));
  }
  /* Accepts a Murph-ish prototype "My log" backup (schema 1) or a Murph in Progress backup (schema 2). Returns entries or throws. */
  function parseBackup(data,now=new Date()){
    let list;
    if(data?.schema===1&&data.mode==='mine'&&Array.isArray(data.events))list=data.events.map(e=>({entry_id:String(e?.id||'').toLowerCase(),occurred_at:e?.createdAt,local_date:e?.date,timezone:TIME_ZONE,exercise:e?.exercise,quantity:e?.amount,target_version:TARGET_VERSION,deleted_at:null}));
    else if(data?.schema===2&&Array.isArray(data.entries))list=data.entries.map(e=>({entry_id:String(e?.entry_id||'').toLowerCase(),occurred_at:e?.occurred_at,local_date:e?.local_date,timezone:TIME_ZONE,exercise:e?.exercise,quantity:e?.quantity,target_version:e?.target_version||TARGET_VERSION,deleted_at:e?.deleted_at||null}));
    else throw new Error('Not a Murph backup');
    if(list.length>100000)throw new Error('Backup too large');
    const ids=new Set();
    for(const e of list){if(!validEntry(e,now)||ids.has(e.entry_id))throw new Error('Backup contains an invalid entry');ids.add(e.entry_id);}
    return list;
  }
  const api={TIME_ZONE,TARGET_VERSION,exercises,today,shift,weekStart,isDay,totals,score,summary,series,weeklyPoints,validEntry,parseBackup};root.Murph=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
