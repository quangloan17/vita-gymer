const CACHE = "vita-static-v7";
const ASSETS = [
  "/static/app.css",
  "/static/coach.css",
  "/static/journey.css",
  "/static/visual.css",
  "/static/js/journey-ui.js",
  "/static/js/coach-ui.js",
  "/static/upgrades.css",
  "/static/js/app.js",
  "/static/js/ui.js",
  "/static/js/views.js",
  "/static/js/sheets.js",
  "/static/js/local-data.js",
  "/static/js/operation-id.js",
  "/static/js/smart-ui.js",
  "/static/js/offline-entry.js",
  "/static/icon.svg",
  "/static/offline.html",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== self.location.origin
  )
    return;
  if (new URL(e.request.url).pathname.startsWith("/static/"))
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  else if (e.request.mode === "navigate")
    e.respondWith(
      fetch(e.request).catch(() => caches.match("/static/offline.html")),
    );
});
