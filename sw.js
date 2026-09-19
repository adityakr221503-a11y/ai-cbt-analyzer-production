const CACHE_NAME = "rankforge-ai-v5";

const CORE = [
  "./",
  "./index.html",
  "./rankforge-app.html",
  "./manifest.json",
  "./rankforge-icon.svg",
  "./cbt.html",
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
  "./study-vault/study-vault.js",
  "./rankforge-lecture-module/components/rankforge-ai-context.js",
  "./rankforge-lecture-module/components/rankforge-ai-handoff.js",
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
