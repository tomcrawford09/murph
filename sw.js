/* Offline app shell. Serves the cached copy instantly, then refreshes it in the background, so a deploy reaches the
   phone on the next open. Supabase requests are never cached. Bump CACHE only to force old files out. */
const CACHE='murph-shell-v1';
const SHELL=['./','style.css','config.js','model.js','store.js','sync.js','app.js','vendor/supabase.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin)return;
  const key=request.mode==='navigate'?new Request(new URL('./',self.registration.scope)):request;
  event.respondWith(caches.open(CACHE).then(async cache=>{
    const cached=await cache.match(key,{ignoreSearch:true});
    const fresh=fetch(key).then(response=>{if(response.ok&&response.type==='basic')cache.put(key,response.clone());return response;});
    if(cached){event.waitUntil(fresh.catch(()=>{}));return cached;}
    return fresh;
  }));
});
