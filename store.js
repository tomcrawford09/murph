/* IndexedDB persistence. A write only resolves after its transaction commits, so the UI never reports an unsaved entry as saved. */
(function(root){
  const NAME='murph-in-progress',VERSION=1;
  let pending=null;
  function open(){
    if(pending)return pending;
    pending=new Promise((resolve,reject)=>{
      if(!root.indexedDB){reject(new Error('This browser has no local database'));return;}
      const r=indexedDB.open(NAME,VERSION);
      r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains('entries'))db.createObjectStore('entries',{keyPath:'entry_id'});if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});};
      r.onsuccess=()=>{const db=r.result;db.onversionchange=()=>{db.close();pending=null;};db.onclose=()=>{pending=null;};resolve(db);};
      r.onerror=()=>reject(r.error||new Error('Could not open local database'));
      r.onblocked=()=>reject(new Error('Close other Murph tabs and try again'));
    });
    pending.catch(()=>{pending=null;});
    return pending;
  }
  function request(r){return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function write(stores,fn){
    const db=await open();
    return new Promise((resolve,reject)=>{
      let t;try{t=db.transaction(stores,'readwrite',{durability:'strict'});fn(t);}catch(e){try{t?.abort();}catch{}reject(e);return;}
      t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error||new Error('Could not save'));t.onabort=()=>reject(t.error||new Error('Save was cancelled'));
    });
  }
  async function allEntries(){const db=await open();return request(db.transaction('entries').objectStore('entries').getAll());}
  function putEntries(list){return write(['entries'],t=>{const s=t.objectStore('entries');for(const e of list)s.put(e);});}
  function removeEntries(ids){return write(['entries'],t=>{const s=t.objectStore('entries');for(const id of ids)s.delete(id);});}
  async function getMeta(key){const db=await open();const row=await request(db.transaction('meta').objectStore('meta').get(key));return row?row.value:undefined;}
  function setMeta(key,value){return write(['meta'],t=>{const s=t.objectStore('meta');value===undefined?s.delete(key):s.put({key,value});});}
  root.MurphStore={open,allEntries,putEntries,removeEntries,getMeta,setMeta};
})(typeof globalThis!=='undefined'?globalThis:this);
