"use client";

import { Button } from "@live-art/ui";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useEffect, useState } from "react";

// Mock balance; in real app call an RPC or indexer for ERC20 balance
async function mockFetchUsdcBalance(_address: string): Promise<string> {
  return "100.00"; // mock $100 USDC
}

export function WalletConnect() {
  const [isMounted, setIsMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [usdc, setUsdc] = useState<string>("-");

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!address) return;
    mockFetchUsdcBalance(address).then(setUsdc);
  }, [address]);

  // Notify app when wallet connects/disconnects
  useEffect(() => {
    if (isConnected && address) {
      const evt = new CustomEvent('wallet:connected', { detail: { chain: 'EVM', address } });
      window.dispatchEvent(evt);
      (window as any).__lastEvmAddress = address;
    } else {
      const evt = new CustomEvent('wallet:disconnected', { detail: { chain: 'EVM' } });
      window.dispatchEvent(evt);
      (window as any).__lastEvmAddress = undefined;
    }
  }, [isConnected, address]);

  if (!isMounted) {
    return null;
  }

  if (!isConnected) {
    return (
      <Button onClick={() => connect({ connector: connectors[0] })} disabled={isPending}>
        {isPending ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="px-2 py-1 rounded bg-neutral-800 border border-neutral-700">{address}</span>
      <span className="text-neutral-400">USDC (mock): ${usdc}</span>
      <Button variant="secondary" onClick={() => disconnect()}>Disconnect</Button>
    </div>
  );
}
