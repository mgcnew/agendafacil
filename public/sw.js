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

// ── Notificações push (FCM) ─────────────────────────────────────
// Só Web Push API nativa — o FCM entrega push padrão de qualquer forma, não
// precisa importar o SDK do Firebase aqui dentro (mais leve).
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const notification = payload.notification || {};
  const title = notification.title || "Zulan";
  const body = notification.body || "";
  const link = payload.fcmOptions?.link || payload.data?.link || "/painel";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: link },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/painel";
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of clientsList) {
        if (c.url.includes(url) && "focus" in c) return c.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
