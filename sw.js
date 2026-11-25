// Funciona sem internet. AUMENTE A VERSÃO a cada mudança em qualquer arquivo do app.
const CACHE = "dieta-v10";
const FILES = [
  "./",
  "index.html",
  "style.css",
  "manifest.webmanifest",
  "data/foods.json",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "js/main.js",
  "js/db.js",
  "js/core/adherence.js",
  "js/core/backup.js",
  "js/core/dates.js",
  "js/core/foods.js",
  "js/core/goals.js",
  "js/core/log.js",
  "js/core/num.js",
  "js/core/state.js",
  "js/ui/dom.js",
  "js/ui/hero.js",
  "js/ui/menu.js",
  "js/ui/picker.js",
  "js/ui/profile.js",
  "js/ui/progress.js",
  "js/ui/today.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))));
});

self.addEventListener("message", (event) => {
  if (event.data === "atualizar") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("dieta-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const hit = await cache.match(request, { ignoreSearch: true });
    if (hit) return hit;
    try {
      return await fetch(request);
    } catch (error) {
      if (request.mode === "navigate") return cache.match("index.html");
      throw error;
    }
  }));
});
