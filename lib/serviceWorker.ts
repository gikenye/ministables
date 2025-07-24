/**
 * Service Worker Registration
 * Optimized for African users with potentially unstable connections
 */

export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      const swUrl = '/sw.js';
      
      navigator.serviceWorker.register(swUrl)
        .then(function(registration) {
          console.log('ServiceWorker registration successful with scope: ', registration.scope);
          
          // Check for updates every hour (optimized for low data usage)
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch(function(error) {
          console.error('ServiceWorker registration failed: ', error);
        });
    });
  }
}

// Function to check if the user is on a slow connection
export function isLowBandwidth(): boolean {
  if (typeof navigator !== 'undefined' && 'connection' in navigator) {
    const conn = (navigator as any).connection;
    
    if (conn) {
      // Check if the connection is slow
      if (conn.saveData) {
        return true; // User has requested data saving mode
      }
      
      if (conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g') {
        return true; // Very slow connection
      }
      
      if (conn.downlink < 0.5) {
        return true; // Less than 0.5 Mbps
      }
    }
  }
  
  return false;
}

// Function to enable data saving mode
export function enableDataSaver(enable: boolean = true) {
  if (typeof document !== 'undefined') {
    if (enable) {
      document.documentElement.classList.add('data-saver');
    } else {
      document.documentElement.classList.remove('data-saver');
    }
    
    // Store the preference
    try {
      localStorage.setItem('data-saver', enable ? 'enabled' : 'disabled');
    } catch (e) {
      console.error('Could not save data saver preference');
    }
  }
}

// Function to check if data saver is enabled
export function isDataSaverEnabled(): boolean {
  if (typeof document !== 'undefined' && typeof localStorage !== 'undefined') {
    // Check localStorage first
    const savedPref = localStorage.getItem('data-saver');
    if (savedPref === 'enabled') {
      return true;
    }
    
    if (savedPref === 'disabled') {
      return false;
    }
    
    // If no preference is saved, check the connection
    return isLowBandwidth();
  }
  
  return false;
}

// Initialize data saver based on connection or saved preference
export function initializeDataSaver() {
  if (typeof window !== 'undefined') {
    const shouldEnable = isDataSaverEnabled();
    enableDataSaver(shouldEnable);
    
    // Listen for connection changes
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn) {
        conn.addEventListener('change', () => {
          // Only auto-enable if the user hasn't explicitly set a preference
          if (localStorage.getItem('data-saver') === null) {
            enableDataSaver(isLowBandwidth());
          }
        });
      }
    }
  }
}