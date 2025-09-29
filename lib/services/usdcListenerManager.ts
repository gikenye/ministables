import { usdcEventListener } from "./usdcEventListener";

class USDCListenerManager {
  private initialized = false;

  async initialize() {
    if (this.initialized) {
      console.log("USDC Listener Manager already initialized");
      return;
    }

    console.log("Initializing USDC Listener Manager...");

    try {
      // Auto-start the listener in production or when explicitly enabled
      const autoStart =
        process.env.USDC_LISTENER_AUTO_START === "true" ||
        process.env.NODE_ENV === "production";

      if (autoStart) {
        console.log("Auto-starting USDC Event Listener...");
        await usdcEventListener.start();
      } else {
        console.log(
          "USDC Event Listener auto-start disabled. Use API to start manually."
        );
      }

      this.initialized = true;
      console.log("USDC Listener Manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize USDC Listener Manager:", error);
      throw error;
    }
  }

  async shutdown() {
    if (!this.initialized) {
      return;
    }

    console.log("Shutting down USDC Listener Manager...");

    try {
      await usdcEventListener.stop();
      this.initialized = false;
      console.log("USDC Listener Manager shut down successfully");
    } catch (error) {
      console.error("Error shutting down USDC Listener Manager:", error);
    }
  }

  getStatus() {
    return {
      initialized: this.initialized,
      listener_status: usdcEventListener.getStatus(),
    };
  }
}

export const usdcListenerManager = new USDCListenerManager();

// Note: Auto-initialization disabled. Use the API endpoints to control the listener manually.
