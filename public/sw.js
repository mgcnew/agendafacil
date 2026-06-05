// AgendeFácil — Service Worker (modo limpeza)
// Esta versão NÃO cacheia assets. Ela remove caches antigos e se desregistra,
// para nunca servir /_next/ desatualizado em desenvolvimento.
// Em produção reintroduziremos um SW com versionamento adequado.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((client) => client.navigate(client.url));
      } catch {
        /* noop */
      }
    })(),
  );
});

// Sempre rede, nunca cache.
self.addEventListener("fetch", () => {});
