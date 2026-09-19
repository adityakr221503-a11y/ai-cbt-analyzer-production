const CACHE_NAME = "rankforge-ai-v2";

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
  "./ranker-revision/index.html"
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
