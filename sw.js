const C='eh-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(r.method!='GET')return;
 const page=u.origin==location.origin&&/examhall-standalone/.test(u.pathname),lib=/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(u.host);if(!page&&!lib)return;
 e.respondWith(caches.open(C).then(async c=>{const m=await c.match(r,{ignoreSearch:true});
  const n=()=>fetch(r).then(x=>{if(x.ok||x.type=='opaque')c.put(r,x.clone());return x});
  if(page)return n().catch(()=>m);
  return m||n()}))});
