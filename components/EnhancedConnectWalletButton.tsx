"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Smartphone } from "lucide-react";
import { useEnhancedWallet } from "@/lib/enhanced-wallet";

interface EnhancedConnectWalletButtonProps {
  className?: string;
}

export function EnhancedConnectWalletButton({ className }: EnhancedConnectWalletButtonProps) {
  const { 
    connect, 
    isConnecting, 
    error, 
    showWalletModal, 
    setShowWalletModal,
    availableProviders 
  } = useEnhancedWallet();

  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  const handleProviderSelect = async (providerId: string) => {
    setSelectedProvider(providerId);
    const address = await connect(providerId);
    if (address) {
      setShowWalletModal(false);
      setSelectedProvider(null);
    }
  };

  const isMobile = typeof window !== 'undefined' && 
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (
    <>
      <Button
        onClick={() => connect()}
        disabled={isConnecting}
        className={className}
      >
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </Button>

      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              {isConnecting ? "Connecting..." : "Choose Your Wallet"}
            </DialogTitle>
          </DialogHeader>

          {!isConnecting ? (
            <div className="space-y-4">
              <div className="text-center text-sm text-gray-600 mb-4">
                Select your preferred wallet to connect
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                {availableProviders.map((provider) => (
                  <Card 
                    key={provider.id}
                    className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                    onClick={() => handleProviderSelect(provider.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                            <span className="text-sm font-bold text-primary">
                              {provider.name.charAt(0)}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-medium">{provider.name}</h3>
                            <p className="text-sm text-gray-500">
                              {isMobile ? 'Tap to connect' : 'Click to connect'}
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="w-5 h-5 text-gray-400" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <div className="flex items-start space-x-2">
                  <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium mb-1">How it works:</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Select your wallet above</li>
                      <li>You'll be redirected to your wallet app</li>
                      <li>Approve the connection in your wallet</li>
                      <li>Return to this browser to continue</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              
              <div>
                <h3 className="font-medium text-lg mb-2">
                  Opening {availableProviders.find(p => p.id === selectedProvider)?.name}
                </h3>
                <p className="text-sm text-gray-600">
                  Please approve the connection in your wallet app, then return to this browser.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </>
  );
}