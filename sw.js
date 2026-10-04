'use strict';
const CACHE='finanzas-pwa-v3.1.0';
const ASSETS=['./','./index.html','./styles.css','./logic.js','./app.js','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:'no-cache'});
      if(response.ok){const cache=await caches.open(CACHE);cache.put(event.request,response.clone())}
      return response;
    }catch(error){
      const cached=await caches.match(event.request,{ignoreSearch:true});
      if(cached)return cached;
      if(event.request.mode==='navigate')return caches.match('./index.html');
      throw error;
    }
  })());
});
