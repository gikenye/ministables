"use client";

import { useEffect, useState } from "react";

type StatusEntry = {
  label: string;
  value: string;
};

export default function ClearServiceWorker() {
  const [statusEntries, setStatusEntries] = useState<StatusEntry[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const testPWA = async () => {
    if (typeof window === "undefined") return;
    const entries: StatusEntry[] = [];
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error - iOS safari exposes navigator.standalone
      window.navigator.standalone ||
      document.referrer.includes("android-app://");

    entries.push({
      label: "Running as PWA",
      value: isStandalone ? "Yes" : "No (in browser)",
    });

    const swRegistrations = await navigator.serviceWorker.getRegistrations();
    entries.push({
      label: "Service Workers",
      value: `${swRegistrations.length}`,
    });
    swRegistrations.forEach((reg, i) => {
      entries.push({
        label: `SW ${i + 1}`,
        value: reg.active?.scriptURL || "inactive",
      });
    });

    const cacheNames = await caches.keys();
    entries.push({
      label: "Caches",
      value: `${cacheNames.length}`,
    });

    setStatusEntries(entries);
  };

  const clearServiceWorkers = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      setStatusMessage(
        `✅ Cleared ${registrations.length} service worker(s). Reload the main app to register the new one.`
      );
    } catch (error) {
      setStatusMessage(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      void testPWA();
    }
  };

  const clearCache = async () => {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      setStatusMessage(`✅ Cleared ${cacheNames.length} cache(s).`);
    } catch (error) {
      setStatusMessage(
        `❌ Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      void testPWA();
    }
  };

  useEffect(() => {
    void testPWA();
  }, []);

  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "600px",
        margin: "50px auto",
        padding: "20px",
        background: "#162013",
        color: "white",
        borderRadius: "12px",
      }}
    >
      <h1>🔧 Minilend PWA Debug Tool</h1>
      <p>Use this page to clear old service workers and test PWA installation.</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <button onClick={clearServiceWorkers} style={buttonStyle}>
          Clear All Service Workers
        </button>
        <button onClick={clearCache} style={buttonStyle}>
          Clear All Caches
        </button>
        <button onClick={testPWA} style={buttonStyle}>
          Test PWA Status
        </button>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "15px",
          background: "rgba(255,255,255,0.1)",
          borderRadius: "8px",
        }}
      >
        <h3>PWA Status:</h3>
        {statusMessage && <p style={{ marginTop: "8px" }}>{statusMessage}</p>}
        <ul style={{ marginTop: "12px" }}>
          {statusEntries.map((entry) => (
            <li key={`${entry.label}-${entry.value}`}>
              <strong>{entry.label}:</strong> {entry.value}
            </li>
          ))}
        </ul>
      </div>
    </div>
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
