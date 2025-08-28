"use client";

import type React from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThirdwebProvider } from "thirdweb/react";
import { client } from "@/lib/thirdweb/client";
import { Toaster } from "@/components/ui/toaster";
import {
  registerServiceWorker,
  initializeDataSaver,
} from "@/lib/serviceWorker";
import { AuthProvider } from "@/lib/auth-provider";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Inter } from "next/font/google";
const DynamicMiniAppProvider = dynamic(() => import('@neynar/react').then(m => m.MiniAppProvider), { ssr: false });

const queryClient = new QueryClient();

const inter = Inter({ subsets: ["latin"] });


export default function ClientLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
    initializeDataSaver();
  }, []);

  // Add error boundary to catch rendering errors
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    // Handle global errors in case of rendering failures
    const handleError = (event: ErrorEvent) => {
      console.error("Global error caught:", event.error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleError);
    
    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  return (
    <div className={`${inter.className} pb-safe`}>
      {hasError ? (
        // Simple fallback UI in case of rendering errors
        <div style={{ 
          padding: "20px", 
          textAlign: "center", 
          maxWidth: "600px", 
          margin: "40px auto",
          color: "#333" 
        }}>
          <h2>Something went wrong</h2>
          <p>We're sorry, but there was an error loading the application. Please try refreshing the page.</p>
          <button 
            onClick={() => window.location.reload()}
            style={{
              background: "#0e6037",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "4px",
              marginTop: "20px",
              cursor: "pointer"
            }}
          >
            Refresh Page
          </button>
        </div>
      ) : (
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ThirdwebProvider>
                <DynamicMiniAppProvider analyticsEnabled={true}>
                  {children}
                  <Toaster />
                  {/* Connection Status Banner */}
                  <div id="connection-status" className="fixed bottom-0 left-0 right-0 bg-yellow-500 text-white text-center py-1 text-sm hidden">
                    You are offline. Some features may be limited.
                  </div>
                </DynamicMiniAppProvider>
              </ThirdwebProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      )}
      
      {/* Connection Status Script */}
      <script dangerouslySetInnerHTML={{
        __html: `
          function updateOnlineStatus() {
            const status = document.getElementById('connection-status');
            if (status) {
              if (navigator.onLine) {
                status.classList.add('hidden');
              } else {
                status.classList.remove('hidden');
              }
            }
          }
          window.addEventListener('online', updateOnlineStatus);
          window.addEventListener('offline', updateOnlineStatus);
          updateOnlineStatus();
        `,
      }} />
    </div>
  );
}