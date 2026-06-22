// AgendeFácil — Service Worker com cache versionado.
// Estratégias:
//  - Navegação (páginas): network-first com fallback à home cacheada (offline).
//  - Assets estáticos do Next (/_next/static) e ícones/imagens: stale-while-revalidate.
//  - Dados (Supabase, outras origens, APIs): sempre rede, nunca cacheia.
// Ao publicar uma nova versão, troque CACHE para invalidar o cache antigo.

const CACHE = "af-v1";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  /\.(?:js|css|woff2?|ttf|otf|png|svg|webp|jpg|jpeg|gif|ico)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Só lidamos com a própria origem; Supabase/CDNs externos vão direto pra rede.
  if (url.origin !== self.location.origin) return;

  // Navegação de páginas → network-first, cai pra home cacheada se offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(request)) || (await cache.match("/")) || Response.error();
      }),
    );
    return;
  }

  // Assets estáticos → stale-while-revalidate.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })(),
    );
  }
});
