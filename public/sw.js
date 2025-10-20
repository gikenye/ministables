// Service Worker for Minilend PWA - Optimized for African users with limited connectivity

const CACHE_NAME = "minilend-pwa-v1";
const RUNTIME_CACHE = "minilend-runtime-v1";
const IMAGE_CACHE = "minilend-images-v1";
const OFFLINE_URL = "/offline.html";

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/placeholder-logo.svg",
  "/placeholder-user.jpg",
  "/placeholder.svg",
  "/new-logo.png",
  "/minilend-logo.png",
  "/dashboard",
  "/manifest.json",
];

// Install event - precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Opened cache");
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (!currentCaches.includes(cacheName)) {
              console.log("Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first with cache fallback strategy
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests and browser extensions
  if (
    event.request.method !== "GET" ||
    event.request.url.startsWith("chrome-extension")
  ) {
    return;
  }

  // For API calls, use network only (don't cache)
  if (event.request.url.includes("/api/")) {
    return;
  }

  // For HTML pages, use network first with offline fallback
  if (event.request.headers.get("Accept").includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache the latest version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((response) => {
            return response || caches.match(OFFLINE_URL);
          });
        })
    );
    return;
  }

  // For images, use cache first with network fallback
  if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg|webp|ico)$/)) {
    event.respondWith(
      caches.match(event.request).then((response) => {
        return (
          response ||
          fetch(event.request)
            .then((fetchResponse) => {
              // Cache the fetched image in IMAGE_CACHE
              const responseClone = fetchResponse.clone();
              caches.open(IMAGE_CACHE).then((cache) => {
                cache.put(event.request, responseClone);
              });
              return fetchResponse;
            })
            .catch(() => {
              // If both cache and network fail, return a placeholder
              if (
                event.request.url.includes("user") ||
                event.request.url.includes("avatar")
              ) {
                return caches.match("/placeholder-user.jpg");
              }
              return caches.match("/placeholder.svg");
            })
        );
      })
    );
    return;
  }

  // For all other assets (CSS, JS, fonts), use stale-while-revalidate strategy
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response immediately if available
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          // Update the cache with the new response in RUNTIME_CACHE
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch((error) => {
          console.log("Fetch failed:", error);
          // Network request failed, return the cached response
          return response;
        });

      return response || fetchPromise;
    })
  );
});

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-transactions") {
    event.waitUntil(syncTransactions());
  }
});

async function syncTransactions() {
  // Placeholder for syncing pending transactions when back online
  console.log("Syncing pending transactions...");
}

// Handle offline page
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
