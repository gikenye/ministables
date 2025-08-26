"use client";

import { MiniAppProvider as NeynarMiniAppProvider } from '@neynar/react';

interface MiniAppProviderProps {
  children: React.ReactNode;
}

export function MiniAppProvider({ children }: MiniAppProviderProps) {
  return (
    <NeynarMiniAppProvider analyticsEnabled={true}>
      {children}
    </NeynarMiniAppProvider>
  );
}