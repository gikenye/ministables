// Service Worker for Minilend Landing Page PWA
// Optimized for Android devices and low-bandwidth connections

const CACHE_NAME = "minilend-landing-v2";
const RUNTIME_CACHE = "minilend-landing-runtime-v2";
const IMAGE_CACHE = "minilend-landing-images-v2";

// Android WebView compatibility check
const isAndroidWebView = () => {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  return /android/i.test(userAgent) && /wv\)/i.test(userAgent);
};

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./offline.html",
  "./static/minilend-logo-new.png",
  "./static/new-logo.png",
  "./static/icon-192x192.png",
  "./static/icon-512x512.png",
];

// Install event - precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        // Android devices often have limited storage, so cache critically important assets first
        const criticalAssets = [
          "./",
          "./index.html",
          "./manifest.json",
          "./static/icon-192x192.png",
        ];

        // Cache critical assets first, then others
        return cache.addAll(criticalAssets).then(() => {
          // Cache remaining assets with error handling for Android WebView
          const remainingAssets = PRECACHE_ASSETS.filter(
            (asset) => !criticalAssets.includes(asset)
          );
          return Promise.allSettled(
            remainingAssets.map((asset) =>
              cache.add(asset).catch((err) => {
                console.warn(`Failed to cache ${asset}:`, err);
                return Promise.resolve(); // Continue even if some assets fail
              })
            )
          );
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== RUNTIME_CACHE &&
            cacheName !== IMAGE_CACHE
          ) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // Android WebView specific handling
  const isAndroidRequest = request.headers
    .get("User-Agent")
    ?.includes("Android");

  // Handle different types of requests with Android optimizations
  if (request.destination === "image") {
    event.respondWith(handleImageRequest(request, isAndroidRequest));
  } else if (request.destination === "document") {
    event.respondWith(handleDocumentRequest(request, isAndroidRequest));
  } else {
    event.respondWith(handleOtherRequests(request, isAndroidRequest));
  }
});

// Handle image requests with cache-first strategy
async function handleImageRequest(request, isAndroidRequest = false) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    // For Android devices, add timeout to prevent hanging requests
    const fetchOptions = isAndroidRequest
      ? { signal: AbortSignal.timeout(10000) }
      : {};

    const networkResponse = await fetch(request, fetchOptions);
    if (networkResponse.ok) {
      // Only cache if we have space (important for Android devices with limited storage)
      try {
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        console.warn(
          "Failed to cache image, storage might be full:",
          cacheError
        );
      }
    }
    return networkResponse;
  } catch (error) {
    console.log("Image fetch failed:", error);
    // Return a placeholder if available
    return new Response("Image not available", { status: 404 });
  }
} // Handle document requests with network-first strategy
async function handleDocumentRequest(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
  } catch (error) {
    console.log("Network request failed, trying cache:", error);
  }

  // Fallback to cache
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse =
    (await cache.match(request)) ||
    (await cache.match("./index.html")) ||
    (await cache.match("./offline.html"));

  if (cachedResponse) {
    return cachedResponse;
  }

  // Ultimate fallback
  return new Response("Page not available offline", {
    status: 503,
    headers: { "Content-Type": "text/html" },
  });
}

// Handle other requests (CSS, JS, etc.)
async function handleOtherRequests(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // Serve from cache and update in background
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          const runtimeCache = caches.open(RUNTIME_CACHE);
          runtimeCache.then((cache) => cache.put(request, networkResponse));
        }
      })
      .catch(() => {
        // Network failed, but we already have cached version
      });
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const runtimeCache = await caches.open(RUNTIME_CACHE);
      runtimeCache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log("Request failed:", error);
    return new Response("Resource not available", { status: 404 });
  }
}
