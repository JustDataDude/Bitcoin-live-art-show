/**
 * Bitcoin Network Utilities
 * Handles Bitcoin network operations, address validation, and transaction building
 */

export type BitcoinNetwork = 'mainnet' | 'testnet' | 'signet' | 'regtest';

export interface BitcoinConfig {
  network: BitcoinNetwork;
  rpcUrl?: string;
}

// Default to mainnet for production
export const DEFAULT_BITCOIN_NETWORK: BitcoinNetwork = 
  process.env.NEXT_PUBLIC_BITCOIN_NETWORK === 'testnet' ? 'testnet' : 'mainnet';

/**
 * Validate Bitcoin address format
 */
export function isValidBitcoinAddress(address: string, network: BitcoinNetwork = DEFAULT_BITCOIN_NETWORK): boolean {
  if (!address || typeof address !== 'string') return false;
  
  // Basic format checks
  // Mainnet addresses: start with 1, 3, or bc1
  // Testnet addresses: start with m, n, 2, or tb1
  if (network === 'mainnet') {
    return /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
  } else if (network === 'testnet' || network === 'signet') {
    return /^(m|n|2|tb1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
  }
  
  return false;
}

/**
 * Convert USD amount to satoshis
 */
export function usdToSatoshis(usdAmount: number, btcPriceUsd: number = 65000): number {
  const btcAmount = usdAmount / btcPriceUsd;
  return Math.floor(btcAmount * 100000000); // Convert to satoshis
}

/**
 * Convert satoshis to USD
 */
export function satoshisToUsd(satoshis: number, btcPriceUsd: number = 65000): number {
  const btcAmount = satoshis / 100000000;
  return btcAmount * btcPriceUsd;
}

/**
 * Format satoshis to BTC string
 */
export function formatSatoshis(satoshis: number): string {
  return (satoshis / 100000000).toFixed(8);
}

/**
 * Get network display name
 */
export function getNetworkDisplayName(network: BitcoinNetwork): string {
  switch (network) {
    case 'mainnet':
      return 'Bitcoin Mainnet';
    case 'testnet':
      return 'Bitcoin Testnet';
    case 'signet':
      return 'Bitcoin Signet';
    case 'regtest':
      return 'Bitcoin Regtest';
    default:
      return 'Bitcoin';
  }
}

/**
 * Check if address matches network
 */
export function isAddressForNetwork(address: string, network: BitcoinNetwork): boolean {
  if (network === 'mainnet') {
    return address.startsWith('1') || address.startsWith('3') || address.startsWith('bc1');
  } else if (network === 'testnet' || network === 'signet') {
    return address.startsWith('m') || address.startsWith('n') || address.startsWith('2') || address.startsWith('tb1');
  }
  return true; // regtest accepts any format
}

