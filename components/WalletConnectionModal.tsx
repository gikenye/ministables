"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Smartphone, Monitor, ArrowRight, QrCode, Copy, CheckCircle } from "lucide-react";
import { SUPPORTED_WALLETS, WalletConnectionManager, type WalletProvider } from "@/lib/wallet-connect";
import { QRCode } from "./QRCode";

interface WalletConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string, signature: string, provider: string) => void;
}

export function WalletConnectionModal({ isOpen, onClose, onConnect }: WalletConnectionModalProps) {
  const [selectedWallet, setSelectedWallet] = useState<WalletProvider | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'connecting' | 'qr-code'>('select');
  const [qrCodeUri, setQrCodeUri] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const connectionManager = WalletConnectionManager.getInstance();

  const handleWalletSelect = async (wallet: WalletProvider) => {
    setSelectedWallet(wallet);
    setError(null);
    setIsConnecting(true);
    setStep('connecting');

    try {
      // Start the connection process
      const connectionPromise = connectionManager.connectWallet(wallet.id);
      
      // Check if this is a mobile device or no injected wallet
      const hasInjectedWallet = typeof window !== 'undefined' && window.ethereum;
      
      if (!hasInjectedWallet && !isMobile) {
        // Desktop without wallet extension - show QR code
        setStep('qr-code');
        // Wait a moment for QR code to be generated
        setTimeout(() => {
          const uri = connectionManager.getQrCodeUri();
          setQrCodeUri(uri);
        }, 100);
      }

      const result = await connectionPromise;
      onConnect(result.address, result.signature, result.provider);
      onClose();
      resetModal();
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      setError(error.message || 'Failed to connect wallet');
      setStep('select');
    } finally {
      setIsConnecting(false);
    }
  };

  const resetModal = () => {
    setSelectedWallet(null);
    setIsConnecting(false);
    setError(null);
    setStep('select');
    setQrCodeUri(null);
    setCopied(false);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      resetModal();
      onClose();
    }
  };

  const isMobile = typeof window !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === 'select' && 'Connect Your Wallet'}
            {step === 'connecting' && 'Connecting...'}
            {step === 'qr-code' && 'Scan QR Code'}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4">
            <div className="text-center text-sm text-gray-600 mb-4">
              Choose your preferred wallet to connect to MiniLend
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-3">
              {SUPPORTED_WALLETS.map((wallet) => (
                <Card 
                  key={wallet.id}
                  className="cursor-pointer hover:shadow-md transition-shadow border-2 hover:border-primary/20"
                  onClick={() => handleWalletSelect(wallet)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{wallet.icon}</div>
                        <div>
                          <h3 className="font-medium">{wallet.name}</h3>
                          <p className="text-sm text-gray-500">
                            {isMobile ? 'Tap to connect' : 'Click to connect or scan QR'}
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
                {isMobile ? (
                  <Smartphone className="w-4 h-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <Monitor className="w-4 h-4 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-medium mb-1">How it works:</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Select your wallet above</li>
                    {isMobile ? (
                      <>
                        <li>You'll be redirected to your wallet app</li>
                        <li>Approve the connection in your wallet</li>
                        <li>Return to any browser to continue</li>
                      </>
                    ) : (
                      <>
                        <li>Scan QR code with your mobile wallet</li>
                        <li>Approve the connection in your wallet</li>
                        <li>Continue using this browser</li>
                      </>
                    )}
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'connecting' && selectedWallet && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <div className="text-3xl">{selectedWallet.icon}</div>
            </div>
            
            <div>
              <h3 className="font-medium text-lg mb-2">Opening {selectedWallet.name}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {isMobile 
                  ? "Please approve the connection in your wallet app, then return to any browser."
                  : "Please approve the connection in your wallet extension or scan the QR code with your mobile wallet."
                }
              </p>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              <p className="font-medium mb-1">Taking too long?</p>
              <p>Make sure you have {selectedWallet.name} installed, or try a different wallet.</p>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                className="flex-1"
                disabled={isConnecting}
              >
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(selectedWallet.universalLink, '_blank')}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Get Wallet
              </Button>
            </div>
          </div>
        )}

        {step === 'qr-code' && selectedWallet && (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            
            <div>
              <h3 className="font-medium text-lg mb-2">Scan with {selectedWallet.name}</h3>
              <p className="text-sm text-gray-600 mb-4">
                Open {selectedWallet.name} on your mobile device and scan this QR code
              </p>
            </div>

            {qrCodeUri && (
              <div className="bg-white border-2 border-gray-200 rounded-lg p-4 mx-auto w-fit">
                <QRCode value={qrCodeUri} size={192} />
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-600 font-mono truncate flex-1 mr-2">
                  {qrCodeUri?.substring(0, 40)}...
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => qrCodeUri && copyToClipboard(qrCodeUri)}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium mb-1">Don't have the app?</p>
              <p>Download {selectedWallet.name} on your mobile device first.</p>
            </div>

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setStep('select')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(selectedWallet.universalLink, '_blank')}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Get App
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}