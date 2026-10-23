// Service worker: permite instalar o app e abrir as telas sem internet.
// Ao publicar uma versão nova, aumente o número abaixo.
const CACHE = "ispeak-v7";
const SHELL = [
  "./",
  "aluno-homework-fazer.html",
  "aluno-homework.html",
  "aluno.html",
  "index.html",
  "perfil.html",
  "prof-convites.html",
  "prof-homework-editor.html",
  "prof-homework.html",
  "professora.html",
  "redefinir-senha.html",
  "manifest.webmanifest",
  "assets/css/app.css",
  "assets/css/brand.css",
  "assets/fonts/bodoni-moda-latin-400-italic.woff2",
  "assets/fonts/bodoni-moda-latin-400-normal.woff2",
  "assets/fonts/bodoni-moda-latin-500-italic.woff2",
  "assets/fonts/bodoni-moda-latin-500-normal.woff2",
  "assets/fonts/bodoni-moda-latin-600-normal.woff2",
  "assets/fonts/jost-latin-300-normal.woff2",
  "assets/fonts/jost-latin-400-normal.woff2",
  "assets/fonts/jost-latin-500-normal.woff2",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/sprite.svg",
  "assets/js/config.js",
  "assets/js/lib/core.js",
  "assets/js/lib/homework-api.js",
  "assets/js/lib/questoes.js",
  "assets/js/pages/aluno-homework-fazer.js",
  "assets/js/pages/aluno-homework.js",
  "assets/js/pages/aluno.js",
  "assets/js/pages/login.js",
  "assets/js/pages/perfil.js",
  "assets/js/pages/prof-convites.js",
  "assets/js/pages/prof-homework-editor.js",
  "assets/js/pages/prof-homework.js",
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
