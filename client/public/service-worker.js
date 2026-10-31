// ======================================================================
// FAMILY WEALTH INTELLIGENCE — Advanced Offline-First Service Worker
// Version: 3.0.0 (Fresh Cache-Busting Network-First Release)
// ======================================================================

const STATIC_CACHE_NAME = "family-static-v4-sovereign";
const RUNTIME_CACHE_NAME = "family-runtime-v4-sovereign";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/manifest.json",
  "/family-icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
];

// Install Event: Pre-cache App Shell & force activation immediately
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

// Activate Event: Wipe out all old versions immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE_NAME && key !== RUNTIME_CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch Event: Network-First for HTML, Scripts, Styles; Fallback to offline cache
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. NEVER cache mutations or authenticated API endpoints
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/manus-storage/")
  ) {
    return;
  }

  // 2. Navigation Requests (HTML Pages): Strictly Network-First
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const appShell = (await caches.match("/index.html")) || (await caches.match("/"));
          if (appShell) return appShell;
          return new Response(
            `<html lang="ar" dir="rtl"><body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:2rem;text-align:center;"><h2>المنصة دون اتصال حالياً</h2><p>تم حفظ بياناتك المحلية بأمان وسيعاد التحميل تلقائياً عند الاتصال.</p></body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // 3. Scripts and CSS: Network-First (Ensures fresh builds are served instantly)
  const isCodeAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (isCodeAsset) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // 4. Media & Fonts: Cache-First with Network Revalidation
  const isMediaOrFont =
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".woff2") ||
    url.origin.includes("fonts.googleapis.com") ||
    url.origin.includes("fonts.gstatic.com");

  if (isMediaOrFont) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          fetch(request)
            .then((fresh) => {
              if (fresh && fresh.ok) {
                caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, fresh));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        return fetch(request).then((net) => {
          if (net && net.ok) {
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, net.clone()));
          }
          return net;
        });
      })
    );
    return;
  }

  // 5. Default GET fallback: Network-First
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

