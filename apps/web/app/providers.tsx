"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, baseSepolia } from "wagmi/chains";
import { injected, metaMask } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

const config = createConfig({
  chains: [baseSepolia, mainnet],
  connectors: [
    metaMask(), // Explicitly use MetaMask connector
    injected(), // Fallback for other injected wallets
  ],
  transports: {
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
  },
});

const queryClient = new QueryClient();

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
