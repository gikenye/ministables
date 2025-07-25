// This is a fix for the "Failed to execute 'clone' on 'Response': Response body is already used" error
self.addEventListener('fetch', event => {
  const request = event.request;
  
  // Only handle GET requests
  if (request.method !== 'GET') return;
  
  // Handle the request with a custom strategy
  event.respondWith(
    fetch(request)
      .then(response => {
        // Clone the response before using it
        const responseClone = response.clone();
        
        // Return the cloned response
        return responseClone;
      })
      .catch(error => {
        console.error('Service worker fetch error:', error);
        // Fall back to network
        return fetch(request);
      })
  );
});

// Skip waiting to ensure the new service worker activates immediately
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Claim clients to ensure the new service worker takes control immediately
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});