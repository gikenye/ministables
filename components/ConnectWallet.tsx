"use client";
import { useActiveAccount, useConnect } from "thirdweb/react";
import { ConnectButton, darkTheme } from "thirdweb/react";
import { EIP1193, createWallet, inAppWallet } from "thirdweb/wallets";
import { useChain } from "@/components/ChainProvider";
import { client } from "@/lib/thirdweb/client";
import { theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { CHAINS } from "@/config/chainConfig";
import { sdk } from "@farcaster/miniapp-sdk";

const wallets = [
  inAppWallet({
    executionMode: {
      mode: "EIP4337",
      // smartAccount: {
      //   sponsorGas: true,
      //   chain: useChain(),
      // },
    },
    auth: { options: ["google", "farcaster", "phone", "email"] },
  }),
  createWallet("com.valoraapp"),
  createWallet("com.coinbase.wallet"),
  createWallet("walletConnect"),
];

const getIsMiniPay = () =>
  typeof window !== "undefined" && Boolean(window.ethereum?.isMiniPay);

export function ConnectWallet({ className }: { className?: string }) {
  const account = useActiveAccount();
  const { connect } = useConnect();
  const [isMiniPay, setIsMiniPay] = useState(getIsMiniPay);
  const [isMiniApp, setIsMiniApp] = useState<boolean | null>(null);
  const autoConnectAttempted = useRef(false);
  const { chain, setChain } = useChain();

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleProviderUpdate = () => {
      const nextIsMiniPay = getIsMiniPay();
      setIsMiniPay((current) =>
        current === nextIsMiniPay ? current : nextIsMiniPay
      );
    };

    window.addEventListener("ethereum#initialized", handleProviderUpdate, {
      once: true,
    });
    window.ethereum?.on?.("connect", handleProviderUpdate);
    window.ethereum?.on?.("disconnect", handleProviderUpdate);

    return () => {
      window.removeEventListener("ethereum#initialized", handleProviderUpdate);
      window.ethereum?.removeListener?.("connect", handleProviderUpdate);
      window.ethereum?.removeListener?.("disconnect", handleProviderUpdate);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const detectMiniApp = async () => {
      try {
        const result = await sdk.isInMiniApp();
        if (!cancelled) {
          setIsMiniApp(result);
        }
      } catch (error) {
        console.error("Failed to detect miniapp environment:", error);
        if (!cancelled) {
          setIsMiniApp(false);
        }
      }
    };

    detectMiniApp();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isMiniApp !== true || account?.address || autoConnectAttempted.current) {
      return;
    }

    autoConnectAttempted.current = true;
    let cancelled = false;

    const autoConnectMiniApp = async () => {
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        const wallet = EIP1193.fromProvider({ provider });
        await wallet.autoConnect({ client, chain });

        if (!cancelled) {
          await connect(wallet);
        }
      } catch (error) {
        console.warn("Miniapp wallet auto-connect skipped:", error);
      }
    };

    void autoConnectMiniApp();

    return () => {
      cancelled = true;
    };
  }, [account?.address, chain, connect, isMiniApp]);

  const shouldShowButton = !account || !isMiniPay;

  if (isMiniApp === null || isMiniApp) {
    return null;
  }

  return (
    <div className={cn(
      "rounded-full shadow-lg transition-all duration-200 border border-emerald-400/40 bg-emerald-500/20 backdrop-blur-sm hover:bg-emerald-500/35",
      className
    )}>
      <ConnectButton
        client={client}
        chains={CHAINS}
        wallets={wallets}
        connectButton={{
          label: "Sign in",
          style: {
            background: "transparent",
            border: "none",
            color: "white",
            fontWeight: 600,
            fontSize: "0.875rem",
            padding: "0.75rem 1.25rem",
          },
        }}
      connectModal={{
        showThirdwebBranding: false,
        size: "compact",
        title: "Minilend",
        titleIcon: "/minilend-pwa.png",
      }}
      theme={darkTheme({
        colors: {
          modalBg: theme.colors.backgroundDark,
          borderColor: theme.colors.borderLight,
          accentText: theme.colors.accent,
          primaryButtonBg: theme.colors.accent,
          primaryButtonText: theme.colors.text,
        },
      })}
      />
    </div>
  );
}
