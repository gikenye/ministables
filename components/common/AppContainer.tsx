import { ReactNode } from "react";
import { AutoConnect } from "thirdweb/react";
import { createWallet, inAppWallet } from "thirdweb/wallets";
import { client } from "@/lib/thirdweb/client";
import { theme } from "@/lib/theme";

interface AppContainerProps {
  children: ReactNode;
  announcements: string[];
  onKeyDown: (event: React.KeyboardEvent) => void;
}

export function AppContainer({
  children,
  announcements,
  onKeyDown,
}: AppContainerProps) {
  return (
    <div
      className="min-h-screen min-h-[100dvh] relative overflow-hidden"
      style={{ backgroundColor: "transparent" }}
      role="application"
      aria-label="Minilend Savings Application"
      onKeyDown={onKeyDown}
      tabIndex={-1}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 px-4 py-2 rounded z-50"
        style={{
          backgroundColor: theme.colors.border,
          color: theme.colors.textWhite,
        }}
      >
        Skip to main content
      </a>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      <AutoConnect
        client={client}
        wallets={[
          inAppWallet({ auth: { options: ["guest"] } }),
          createWallet("io.metamask"),
          createWallet("com.coinbase.wallet"),
        ]}
        timeout={10000}
      />

      {children}
    </div>
  );
}
