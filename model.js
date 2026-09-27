/* Calendar keys are frozen at entry time in Australia/Sydney. Run quantities use integer metres. */
(function(root){
  const exercises = [
    {key:'run',name:'Run',goal:3200,unit:'m',steps:[100,250,500,1000]},
    {key:'pull',name:'Pull-ups',goal:100,unit:'reps',steps:[1,5,10,25]},
    {key:'push',name:'Push-ups',goal:200,unit:'reps',steps:[1,5,10,25]},
    {key:'squat',name:'Squats',goal:300,unit:'reps',steps:[1,5,10,25]}
  ];
  function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Sydney',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
  function shift(day,delta){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+delta);return d.toISOString().slice(0,10);}
  function totals(events){const out={};for(const e of events){out[e.date]??={run:0,pull:0,push:0,squat:0};out[e.date][e.exercise]+=e.amount;}return out;}
  function score(total,metric='overall'){if(metric==='overall')return exercises.reduce((s,e)=>s+Math.min(1,(total?.[e.key]||0)/e.goal),0)*25;const e=exercises.find(e=>e.key===metric);return (total?.[metric]||0)/e.goal*100;}
  function activeDays(days,asOf){return Object.keys(days).filter(d=>d<=asOf&&Object.values(days[d]).some(n=>n>0)).sort();}
  function summary(days,asOf,metric='overall'){
    const active=activeDays(days,asOf),last3=active.slice(-3),last14=active.filter(d=>d>=shift(asOf,-13));
    const avg=dates=>dates.length?dates.reduce((s,d)=>s+score(days[d],metric),0)/dates.length:null;
    return {daily:score(days[asOf],metric),three:avg(last3),fourteen:avg(last14),last3,last14};
  }
  function series(events,asOf,count,metric){const days=totals(events);return Array.from({length:count},(_,i)=>{const date=shift(asOf,i-count+1);return {date,...summary(days,date,metric)};});}
  function demo(asOf){
    const rows=[[-38,1200,10,25,40],[-32,1600,20,30,60],[-27,1000,15,30,50],[-25,1600,20,40,70],[-23,0,25,50,75],[-20,2000,25,50,90],[-18,1600,35,60,100],[-15,2400,30,70,110],[-12,1600,40,80,120],[-10,2200,35,80,135],[-7,2600,45,100,150],[-5,2000,50,110,180],[-2,3200,65,130,210],[0,1600,35,80,120]];
    return rows.flatMap((r,i)=>exercises.filter((e,j)=>r[j+1]>0).map(e=>({id:'demo-'+i+'-'+e.key,date:shift(asOf,r[0]),exercise:e.key,amount:r[exercises.indexOf(e)+1],createdAt:shift(asOf,r[0])+'T00:15:00.000Z',timeZone:'Australia/Sydney'})));
  }
  function validEvents(value){
    if(!Array.isArray(value)||value.length>100000) return false;
    const ids=new Set();
    return value.every(e=>{if(!e||typeof e.id!=='string'||!e.id||ids.has(e.id)||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||e.date>today()||!exercises.some(x=>x.key===e.exercise)||!Number.isSafeInteger(e.amount)||e.amount<=0||e.amount>1000000||typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))return false;try{if(shift(e.date,0)!==e.date)return false;}catch{return false;}ids.add(e.id);return true;});
  }
  const api={exercises,today,shift,totals,score,summary,series,demo,validEvents};root.Murph=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
