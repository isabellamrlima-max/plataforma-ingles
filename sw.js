// Service worker: permite instalar o app e abrir as telas sem internet.
// Ao publicar uma versão nova, aumente o número abaixo.
const CACHE = "ispeak-v3";
const SHELL = [
  "./",
  "index.html",
  "aluno.html",
  "professora.html",
  "convites.html",
  "redefinir-senha.html",
  "manifest.webmanifest",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/sprite.svg",
  "assets/fonts/bodoni-moda-latin-400-italic.woff2",
  "assets/fonts/bodoni-moda-latin-400-normal.woff2",
  "assets/fonts/bodoni-moda-latin-500-italic.woff2",
  "assets/fonts/bodoni-moda-latin-500-normal.woff2",
  "assets/fonts/bodoni-moda-latin-600-normal.woff2",
  "assets/fonts/jost-latin-300-normal.woff2",
  "assets/fonts/jost-latin-400-normal.woff2",
  "assets/fonts/jost-latin-500-normal.woff2",
  "assets/css/app.css",
  "assets/css/brand.css",
  "assets/js/config.js",
  "assets/js/lib/core.js",
  "assets/js/pages/aluno.js",
  "assets/js/pages/convites.js",
  "assets/js/pages/login.js",
  "assets/js/pages/professora.js",
  "assets/js/pages/redefinir.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Rede primeiro (sempre a versão mais nova); cache só se estiver offline.
// Requisições ao Supabase e a outros sites nunca são guardadas.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
