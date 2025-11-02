"use client";

import { Button } from "@live-art/ui";
import { useEffect, useState } from "react";

interface BitcoinWallet {
  address: string;
  publicKey: string;
  balance: number;
}

declare global {
  interface Window {
    unisat?: any;
    xverse?: any;
    XverseProviders?: any;
    okxwallet?: any;
    magicEden?: {
      bitcoin?: any;
    };
  }
}

export function BitcoinWalletConnect() {
  const [wallet, setWallet] = useState<BitcoinWallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);

  useEffect(() => {
    // Delay detection to allow wallet extensions to inject
    const detectWallets = () => {
      const wallets = [];
      if (typeof window !== "undefined") {
        console.log("Detecting wallets:", {
          unisat: !!window.unisat,
          xverse: !!window.xverse,
          XverseProviders: !!window.XverseProviders,
          okx: !!window.okxwallet?.bitcoin,
          magicEden: !!window.magicEden?.bitcoin,
        });
        if (window.unisat) wallets.push("Unisat");
        // Xverse can inject as either window.xverse or window.XverseProviders
        if (window.xverse || window.XverseProviders) wallets.push("Xverse");
        if (window.okxwallet?.bitcoin) wallets.push("OKX");
        if (window.magicEden?.bitcoin) wallets.push("MagicEden");
      }
      console.log("Detected wallets:", wallets);
      setAvailableWallets(wallets);
    };

    // Try immediately
    detectWallets();
    
    // Try again after delays for wallets that inject slowly
    const timer1 = setTimeout(detectWallets, 500);
    const timer2 = setTimeout(detectWallets, 1500);
    const timer3 = setTimeout(detectWallets, 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const connectUnisat = async () => {
    try {
      setIsConnecting(true);
      console.log('🟠 [Unisat] Attempting connection...');
      console.log('🟠 [Unisat] window.unisat:', window.unisat);
      
      const accounts = await window.unisat.requestAccounts();
      console.log('✅ [Unisat] Accounts received:', accounts);
      
      const publicKey = await window.unisat.getPublicKey();
      console.log('✅ [Unisat] Public key:', publicKey);
      
      const balance = await window.unisat.getBalance();
      console.log('✅ [Unisat] Balance:', balance);
      
      setWallet({
        address: accounts[0],
        publicKey,
        balance: balance.total,
      });
      window.dispatchEvent(new CustomEvent('wallet:connected', { detail: { chain: 'BTC', address: accounts[0] } }));
      (window as any).__lastBtcAddress = accounts[0];
      
      console.log('✅ [Unisat] Successfully connected:', accounts[0]);
    } catch (error) {
      console.error("❌ [Unisat] Connection error:", error);
      alert(`Unisat connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectXverse = async () => {
    setIsConnecting(true);
    
    try {
      console.log('🟣 [Xverse] Attempting connection...');
      console.log('🟣 [Xverse] window.XverseProviders:', window.XverseProviders);
      console.log('🟣 [Xverse] BitcoinProvider:', window.XverseProviders?.BitcoinProvider);
      
      if (!window.XverseProviders?.BitcoinProvider) {
        throw new Error('Xverse wallet not found. Please make sure the extension is installed and enabled.');
      }

      console.log('🟣 [Xverse] Starting connection...');
      
      // Xverse popup doesn't appear reliably through the API
      // Provide manual connection instructions
      alert(
        '🟣 Xverse Manual Connection\n\n' +
        'Xverse popup doesn\'t appear automatically.\n\n' +
        'Please follow these steps:\n\n' +
        '1. Click the Xverse extension icon (top-right corner)\n' +
        '2. If locked, unlock your wallet\n' +
        '3. Look for "Connected Sites" or "Connections"\n' +
        '4. Add or approve this site: localhost:3000\n' +
        '5. Close the extension\n' +
        '6. Click the Xverse button here again\n\n' +
        'Click OK to continue...'
      );
      
      // After user reads instructions, try to get accounts
      console.log('🟣 [Xverse] Attempting to check connection...');
      
      // Try to request connection with minimal parameters
      try {
        const addresses = await new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('No response - please connect via Xverse extension manually'));
          }, 10000);
          
          window.XverseProviders.BitcoinProvider.request('getAccounts', {
            payload: {
              purposes: ['payment'],
              message: 'Connect to Live Art',
              network: {
                type: 'Mainnet',
              },
            },
            onFinish: (response: any) => {
              clearTimeout(timeoutId);
              console.log('✅ [Xverse] Got response:', response);
              resolve(response);
            },
            onCancel: () => {
              clearTimeout(timeoutId);
              reject(new Error('Connection cancelled'));
            },
          });
        });
        
        console.log('🟣 [Xverse] Response:', addresses);
        
        // Extract payment address
        const paymentAddr = (addresses as any).addresses?.find((a: any) => a.purpose === 'payment');
        
        if (paymentAddr && paymentAddr.address) {
          console.log('✅ [Xverse] Successfully connected:', paymentAddr.address);
          setWallet({
            address: paymentAddr.address,
            publicKey: paymentAddr.publicKey || "",
            balance: 0,
          });
          window.dispatchEvent(new CustomEvent('wallet:connected', { detail: { chain: 'BTC', address: paymentAddr.address } }));
          (window as any).__lastBtcAddress = paymentAddr.address;
          return;
        } else {
          throw new Error('No address found - please authorize in Xverse extension first');
        }
      } catch (error: any) {
        console.error('❌ [Xverse] Connection failed:', error);
        throw new Error('Xverse connection requires manual authorization via the extension. Please click the Xverse icon and approve this site, then try again.');
      }
    } catch (error: any) {
      console.error("❌ [Xverse] Connection error:", error);
      
      // Don't show alert if user cancelled
      if (!error.message?.includes('cancelled')) {
        alert(`Xverse: ${error.message || 'Connection failed. Try clicking the Xverse extension icon to approve.'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const connectOKX = async () => {
    try {
      setIsConnecting(true);
      const result = await window.okxwallet.bitcoin.connect();
      setWallet({
        address: result.address,
        publicKey: result.publicKey,
        balance: 0,
      });
      window.dispatchEvent(new CustomEvent('wallet:connected', { detail: { chain: 'BTC', address: result.address } }));
      (window as any).__lastBtcAddress = result.address;
    } catch (error) {
      console.error("OKX connection error:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectMagicEden = async () => {
    setIsConnecting(true);
    
    try {
      console.log('🔵 [Magic Eden] Attempting connection...');
      console.log('🔵 [Magic Eden] window.magicEden:', window.magicEden);
      console.log('🔵 [Magic Eden] window.magicEden?.bitcoin:', window.magicEden?.bitcoin);
      
      if (!window.magicEden?.bitcoin) {
        throw new Error('Magic Eden wallet not found. Please make sure the extension is installed and enabled.');
      }

      console.log('🔵 [Magic Eden] Checking connection...');
      
      // Check if already connected
      const existingAccounts = window.magicEden.bitcoin.accounts;
      console.log('🔵 [Magic Eden] Existing accounts:', existingAccounts);
      
      let accounts;
      
      if (existingAccounts && existingAccounts.length > 0) {
        // Already connected!
        accounts = existingAccounts;
        console.log('✅ [Magic Eden] Already connected:', accounts);
      } else {
        // Not connected - show manual connection instructions
        alert(
          '🔵 Magic Eden Manual Connection Required\n\n' +
          'Magic Eden requires manual authorization:\n\n' +
          '1. Click the Magic Eden extension icon (top-right of browser)\n' +
          '2. Click "Connect" or "Authorize"\n' +
          '3. Select this site (localhost:3000)\n' +
          '4. Approve the connection\n' +
          '5. Click the Magic Eden button again\n\n' +
          'This only needs to be done once.'
        );
        
        // Check again after user clicks OK
        const accounts2 = window.magicEden.bitcoin.accounts;
        if (accounts2 && accounts2.length > 0) {
          accounts = accounts2;
          console.log('✅ [Magic Eden] Connected after manual auth:', accounts);
        } else {
          throw new Error('Please connect Magic Eden wallet manually via the extension, then try again.');
        }
      }
      
      console.log('🔵 [Magic Eden] Final accounts:', accounts);
      
      if (accounts && accounts.length > 0) {
        // Handle both string addresses and address objects
        const address = typeof accounts[0] === 'string' ? accounts[0] : accounts[0].address;
        
        if (address) {
          console.log('✅ [Magic Eden] Successfully connected:', address);
          setWallet({
            address: address,
            publicKey: "",
            balance: 0,
          });
        } else {
          throw new Error('No address returned from Magic Eden wallet');
        }
      } else {
        throw new Error('No accounts found. Please unlock your Magic Eden wallet.');
      }
    } catch (error: any) {
      console.error("❌ [Magic Eden] Connection error:", error);
      // User rejected or wallet locked
      if (error.code === 4001 || error.message?.includes('User rejected')) {
        console.log('❌ [Magic Eden] User rejected connection');
      } else {
        alert(`Magic Eden: ${error.message || 'Connection failed'}`);
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setWallet(null);
    (window as any).__lastBtcAddress = undefined;
    const evt = new CustomEvent('wallet:disconnected', { detail: { chain: 'BTC' } });
    window.dispatchEvent(evt);
  };

  if (wallet) {
    const address = wallet.address;
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="px-2 py-1 rounded bg-orange-900/20 border border-orange-700">
          ₿ {address.slice(0, 6)}...{address.slice(-4)}
        </span>
        {wallet.balance > 0 && (
          <span className="text-neutral-400">{(wallet.balance / 100000000).toFixed(8)} BTC</span>
        )}
        <Button variant="secondary" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  // Removed the debug panel to fix hydration errors

  const handleWalletClick = async (walletName: string, connectFn: () => Promise<void>) => {
    console.log(`🔘 [${walletName}] Button clicked`);
    // Always try to connect - the connect function will handle errors if wallet is missing
    try {
      await connectFn();
    } catch (error) {
      console.error(`🔘 [${walletName}] handleWalletClick caught error:`, error);
      // If wallet is truly not installed, offer to open install page
      if (!availableWallets.includes(walletName)) {
        const urls: Record<string, string> = {
          MagicEden: "https://wallet.magiceden.io",
          Xverse: "https://xverse.app",
          Unisat: "https://unisat.io",
          OKX: "https://okx.com/web3",
        };
        const shouldInstall = confirm(`${walletName} wallet not detected. Would you like to install it?`);
        if (shouldInstall) {
          window.open(urls[walletName], "_blank");
        }
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {wallet ? (
        <>
          <div className="text-sm px-3 py-1 bg-green-100 text-green-800 rounded">
            {((wallet as BitcoinWallet).address || '').slice(0, 6)}...{((wallet as BitcoinWallet).address || '').slice(-4)}
          </div>
          <Button onClick={disconnect} variant="secondary">
            Disconnect
          </Button>
        </>
      ) : (
        <>
          <Button 
            onClick={() => handleWalletClick("Unisat", connectUnisat)} 
            disabled={isConnecting}
            variant={availableWallets.includes("Unisat") ? "primary" : "secondary"}
          >
            {isConnecting ? "Connecting..." : "Unisat"}
          </Button>
          <Button 
            onClick={() => handleWalletClick("MagicEden", connectMagicEden)} 
            disabled={isConnecting}
            variant={availableWallets.includes("MagicEden") ? "primary" : "secondary"}
          >
            {isConnecting ? "Connecting..." : "Magic Eden"}
          </Button>
          <Button 
            onClick={() => handleWalletClick("Xverse", connectXverse)} 
            disabled={isConnecting}
            variant={availableWallets.includes("Xverse") ? "primary" : "secondary"}
          >
            {isConnecting ? "Connecting..." : "Xverse"}
          </Button>
        </>
      )}
    </div>
  );
}

