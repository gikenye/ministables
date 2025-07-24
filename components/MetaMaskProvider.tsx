'use client'

import { ReactNode, useEffect, useState, createContext } from "react"
import { MetaMaskSDK, SDKProvider } from "@metamask/sdk"
import { isMobileDevice } from "@/lib/metamask"

interface MetaMaskProviderProps {
  children: ReactNode
}

// Create a context for the MetaMask provider
export const MetaMaskContext = createContext<SDKProvider | null>(null);

export function MetaMaskProvider({ children }: MetaMaskProviderProps) {
  const [sdk, setSDK] = useState<MetaMaskSDK | null>(null)
  const [provider, setProvider] = useState<SDKProvider | null>(null)

  useEffect(() => {
    const initSDK = async () => {
      try {
        const newSDK = new MetaMaskSDK({
          dappMetadata: {
            name: "MiniStables",
            url: window.location.href,
          },
          // Use the right connection methods based on device
          preferDesktop: !isMobileDevice(),
          // Use deeplinks on mobile
          useDeeplink: isMobileDevice()
        })

        // Initialize the SDK
        await newSDK.init()
        
        const sdkProvider = newSDK.getProvider();
        setSDK(newSDK)
        
        // Only set the provider if it's not undefined
        if (sdkProvider) {
          setProvider(sdkProvider)
        }
      } catch (error) {
        console.error("Failed to initialize MetaMask SDK:", error)
      }
    }

    initSDK()

    // Cleanup function
    return () => {
      if (sdk) {
        // Perform any necessary cleanup
      }
    }
  }, [])

  // Provide the MetaMask provider to children
  return (
    <MetaMaskContext.Provider value={provider}>
      {children}
    </MetaMaskContext.Provider>
  )
}