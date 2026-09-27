/* Supabase backup. Pushes unsent entries (idempotent on entry_id), then deletion markers, then pulls this participant's rows.
   Deletion is one-way on both sides, so an undone entry can never come back from another device or an old backup. */
(function(root){
  const PAGE=1000,INSERT_CHUNK=500,DELETE_CHUNK=100,OVERLAP_MS=10*60*1000;
  const COLUMNS='entry_id,occurred_at,local_date,timezone,exercise,quantity,target_version,deleted_at,updated_at';
  // Postgres returns microseconds; trim to milliseconds so every browser can parse the timestamp.
  function ms(stamp){return Date.parse(String(stamp).replace(/(\.\d{3})\d+/,'$1'));}
  function pending(entries,owner){const mine=entries.filter(e=>e.owner===owner);return {inserts:mine.filter(e=>!e.pushed),deletes:mine.filter(e=>e.deleted_at&&!e.delete_pushed)};}
  function pendingCount(entries,owner){const p=pending(entries,owner);return new Set([...p.inserts,...p.deletes].map(e=>e.entry_id)).size;}
  function toRow(e,owner){return {user_id:owner,entry_id:e.entry_id,occurred_at:e.occurred_at,local_date:e.local_date,timezone:e.timezone,exercise:e.exercise,quantity:e.quantity,target_version:e.target_version,deleted_at:e.deleted_at||null};}
  // Applies sync outcomes to the latest local entries and returns only the entries that changed.
  function apply(entries,ops,owner){
    const byId=new Map(entries.map(e=>[e.entry_id,e])),changed=new Map(),current=id=>changed.get(id)||byId.get(id);
    for(const op of ops){
      if(op.type==='pushed'){const e=current(op.id);if(e&&!e.pushed)changed.set(e.entry_id,{...e,pushed:true});}
      else if(op.type==='deletePushed'){const e=current(op.id);if(e&&e.deleted_at&&!e.delete_pushed)changed.set(e.entry_id,{...e,pushed:true,delete_pushed:true});}
      else if(op.type==='remote'){
        const r=op.row,e=current(r.entry_id);
        if(!e){changed.set(r.entry_id,{entry_id:r.entry_id,owner,occurred_at:r.occurred_at,local_date:r.local_date,timezone:r.timezone,exercise:r.exercise,quantity:r.quantity,target_version:r.target_version,deleted_at:r.deleted_at||null,pushed:true,delete_pushed:!!r.deleted_at});continue;}
        if(e.owner!==owner)continue;
        const next={...e,pushed:true};
        if(r.deleted_at){next.deleted_at=e.deleted_at||r.deleted_at;next.delete_pushed=true;}
        if(next.pushed!==e.pushed||next.deleted_at!==e.deleted_at||next.delete_pushed!==e.delete_pushed)changed.set(e.entry_id,next);
      }
    }
    return [...changed.values()];
  }
  function chunks(list,n){const out=[];for(let i=0;i<list.length;i+=n)out.push(list.slice(i,i+n));return out;}
  function failure(error,stage){const e=new Error(error?.message||String(error));e.code=error?.code;e.status=error?.status;e.stage=stage;return e;}
  async function run({client,owner,getEntries,mutate,getCursor,setCursor}){
    for(const group of chunks(pending(getEntries(),owner).inserts,INSERT_CHUNK)){
      const {error}=await client.from('entries').upsert(group.map(e=>toRow(e,owner)),{onConflict:'user_id,entry_id',ignoreDuplicates:true});
      if(error)throw failure(error,'push');
      await mutate(entries=>apply(entries,group.map(e=>({type:'pushed',id:e.entry_id})),owner));
    }
    for(const group of chunks(pending(getEntries(),owner).deletes.filter(e=>e.pushed),DELETE_CHUNK)){
      const {error}=await client.from('entries').update({deleted_at:new Date().toISOString()}).eq('user_id',owner).in('entry_id',group.map(e=>e.entry_id)).is('deleted_at',null);
      if(error)throw failure(error,'delete');
      await mutate(entries=>apply(entries,group.map(e=>({type:'deletePushed',id:e.entry_id})),owner));
    }
    const cursor=await getCursor(),since=cursor&&Number.isFinite(ms(cursor))?new Date(ms(cursor)-OVERLAP_MS).toISOString():null;
    let from=0,latest=cursor,pulled=0;
    for(;;){
      let query=client.from('entries').select(COLUMNS).eq('user_id',owner);
      if(since)query=query.gte('updated_at',since);
      const {data,error}=await query.order('updated_at',{ascending:true}).order('entry_id',{ascending:true}).range(from,from+PAGE-1);
      if(error)throw failure(error,'pull');
      if(data.length)await mutate(entries=>apply(entries,data.map(row=>({type:'remote',row})),owner));
      for(const r of data)if(!latest||ms(r.updated_at)>ms(latest))latest=r.updated_at;
      pulled+=data.length;if(data.length<PAGE)break;from+=PAGE;
    }
    if(latest&&latest!==cursor)await setCursor(latest);
    return {pulled,pending:pendingCount(getEntries(),owner)};
  }
  const api={pending,pendingCount,apply,run,ms};root.MurphSync=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
