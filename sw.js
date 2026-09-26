const CACHE_NAME = "rankforge-ai-v6-20260926";

const CORE = [
  "./",
  "./index.html",
  "./rankforge-app.html",
  "./manifest.json",
  "./rankforge-icon.svg",

  "./pdf-to-cbt.html",
  "./rankers-test-series.html",
  "./question-bank.html",
  "./mistake.html",
  "./analysis.html",
  "./history.html",
  "./ranker-command-center.html",
  "./ai-question-lab.html",
  "./ai-test-generator.html",
  "./nichod-hub.html",
  "./ranker-revision/index.html",
  "./rankforge-lecture-module/pages/lectures.html",
  "./rankforge-lecture-module/components/lecture-module.css",
  "./rankforge-lecture-module/components/lecture-module.js",
  "./rankforge-lecture-module/components/lecture-ai.js",
  "./rankforge-lecture-module/data/lecture-data.js",
  "./study-vault/",
  "./study-vault/index.html",
  "./study-vault/study-vault.css",
  "./study-vault/study-vault.js"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {

  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(response => {

        const copy = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, copy));

        return response;
      })
      .catch(() =>
        caches.match(event.request)
      )
  );

});


/* RANKFORGE_PWA_UPDATE_V1 */
self.addEventListener("install", event => {
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});
/* /RANKFORGE_PWA_UPDATE_V1 */


/* RANKFORGE_CBT_NO_SW_CACHE */
self.addEventListener("fetch", event => {
  const u = new URL(event.request.url);

  if (u.pathname.endsWith("/cbt.html")) {
    event.respondWith(fetch(event.request, {cache:"no-store"}));
  }
});
/* /RANKFORGE_CBT_NO_SW_CACHE */
