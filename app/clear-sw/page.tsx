"use client";

export default function ClearServiceWorker() {
  return (
    <html>
      <head>
        <title>Clear Service Worker - Minilend</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          maxWidth: "600px",
          margin: "50px auto",
          padding: "20px",
          background: "#162013",
          color: "white",
        }}
      >
        <h1>🔧 Minilend PWA Debug Tool</h1>
        <p>
          Use this page to clear old service workers and test PWA installation.
        </p>

        <button onClick={() => clearServiceWorkers()} style={buttonStyle}>
          Clear All Service Workers
        </button>
        <button onClick={() => clearCache()} style={buttonStyle}>
          Clear All Caches
        </button>
        <button onClick={() => testPWA()} style={buttonStyle}>
          Test PWA Status
        </button>

        <div
          id="status"
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "rgba(255,255,255,0.1)",
            borderRadius: "8px",
          }}
        ></div>

        <script
          dangerouslySetInnerHTML={{
            __html: `
          const status = document.getElementById('status');

          async function clearServiceWorkers() {
            try {
              const registrations = await navigator.serviceWorker.getRegistrations();
              for (let registration of registrations) {
                await registration.unregister();
              }
              status.innerHTML = \`✅ Cleared \${registrations.length} service worker(s). Reload the main app to register the new one.\`;
            } catch (error) {
              status.innerHTML = \`❌ Error: \${error.message}\`;
            }
          }

          async function clearCache() {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
              status.innerHTML = \`✅ Cleared \${cacheNames.length} cache(s).\`;
            } catch (error) {
              status.innerHTML = \`❌ Error: \${error.message}\`;
            }
          }

          async function testPWA() {
            let info = '<h3>PWA Status:</h3><ul>';
            
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
              || window.navigator.standalone 
              || document.referrer.includes('android-app://');
            info += \`<li>Running as PWA: \${isStandalone ? '✅ Yes' : '❌ No (in browser)'}</li>\`;
            
            const swRegistrations = await navigator.serviceWorker.getRegistrations();
            info += \`<li>Service Workers: \${swRegistrations.length}</li>\`;
            swRegistrations.forEach((reg, i) => {
              info += \`<li style="margin-left: 20px;">SW \${i+1}: \${reg.active?.scriptURL || 'inactive'}</li>\`;
            });
            
            const cacheNames = await caches.keys();
            info += \`<li>Caches: \${cacheNames.length}</li>\`;
            
            info += '</ul>';
            status.innerHTML = info;
          }

          window.clearServiceWorkers = clearServiceWorkers;
          window.clearCache = clearCache;
          window.testPWA = testPWA;
          testPWA();
        `,
          }}
        />
      </body>
    </html>
  );
}

const buttonStyle = {
  background: "#0e6037",
  color: "white",
  border: "none",
  padding: "12px 24px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "16px",
  margin: "10px 10px 10px 0",
  display: "inline-block",
};
