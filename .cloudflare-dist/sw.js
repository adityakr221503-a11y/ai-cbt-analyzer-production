const CACHE_NAME = "cbt-analyzer-v2";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./cbt.html",
  "./mistake.html",
  "./manifest.json"
];

/* Install */
self.addEventListener("install", event => {

  event.waitUntil(

    caches.open(CACHE_NAME).then(cache => {

      return cache.addAll(ASSETS_TO_CACHE);

    })

  );

  self.skipWaiting();

});


/* Activate and remove old caches */
self.addEventListener("activate", event => {

  event.waitUntil(

    caches.keys().then(keys => {

      return Promise.all(

        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))

      );

    })

  );

  self.clients.claim();

});


/* Network first, cache fallback */
self.addEventListener("fetch", event => {

  if(event.request.method !== "GET"){
    return;
  }

  event.respondWith(

    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        caches.open(CACHE_NAME).then(cache => {

          cache.put(event.request, copy);

        });

        return response;

      })
      .catch(() => {

        return caches.match(event.request);

      })

  );

});
