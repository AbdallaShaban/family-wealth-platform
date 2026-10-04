// ======================================================================
// FAMILY WEALTH INTELLIGENCE — Advanced Offline-First Service Worker
// Version: 2.0.0
// ======================================================================

const STATIC_CACHE_NAME = "family-static-v2";
const RUNTIME_CACHE_NAME = "family-runtime-v2";

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

// Install Event: Pre-cache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: Clean up outdated caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE_NAME && key !== RUNTIME_CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Smart routing & caching strategy
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

  // 2. Navigation Requests (HTML Pages): Network-First with Offline App Shell Fallback
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
          // Fallback to cached route or root app shell
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const appShell = await caches.match("/index.html") || await caches.match("/");
          if (appShell) return appShell;
          return new Response(
            `<html lang="ar" dir="rtl"><body style="background:#09090b;color:#f4f4f5;font-family:sans-serif;padding:2rem;text-align:center;"><h2>المنصة دون اتصال حالياً</h2><p>تم حفظ بياناتك المحلية بأمان وسيعاد التحميل تلقائياً عند الاتصال.</p></body></html>`,
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
    );
    return;
  }

  // 3. Static Assets (Scripts, CSS, Fonts, Images): Cache-First / Stale-While-Revalidate
  const isStaticAsset =
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2") ||
    url.origin.includes("fonts.googleapis.com") ||
    url.origin.includes("fonts.gstatic.com");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalidate in background
          fetch(request)
            .then((freshResponse) => {
              if (freshResponse && freshResponse.ok) {
                caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, freshResponse));
              }
            })
            .catch(() => {
              // offline, ignore background update failure
            });
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const copy = networkResponse.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Default GET fallback: Network with cache fallback
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
