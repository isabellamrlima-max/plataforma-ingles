// Service worker: permite instalar o app e abrir as telas sem internet.
// Ao publicar uma versão nova, aumente o número abaixo.
const CACHE = "sala-ingles-v2";
const SHELL = [
  "./", "index.html", "aluno.html", "professora.html", "redefinir-senha.html", "convites.html",
  "css/style.css", "js/config.js", "js/core.js", "js/login.js", "js/aluno.js",
  "js/professora.js", "js/redefinir.js", "js/convites.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png",
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
