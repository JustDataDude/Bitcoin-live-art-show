/**
 * Bitcoin Transaction Utilities
 * Handles Bitcoin transaction building, signing, and broadcasting
 */

import { BitcoinNetwork, usdToSatoshis, formatSatoshis } from './bitcoin';

declare global {
  interface Window {
    unisat?: any;
    XverseProviders?: any;
  }
}

export interface BitcoinTransaction {
  to: string;
  amount: number; // in satoshis
  feeRate?: number; // satoshis per byte
  network: BitcoinNetwork;
}

export interface TransactionResult {
  txid: string;
  status: 'pending' | 'confirmed';
  confirmations: number;
  fee: number; // in satoshis
}

/**
 * Estimate Bitcoin transaction fee
 * Uses Mempool.space API for fee estimation
 */
export async function estimateTransactionFee(
  network: BitcoinNetwork = 'mainnet',
  feeRate?: 'low' | 'medium' | 'high'
): Promise<number> {
  try {
    const baseUrl = network === 'mainnet' 
      ? 'https://mempool.space/api'
      : 'https://mempool.space/testnet/api';
    
    const response = await fetch(`${baseUrl}/v1/fees/recommended`);
    const fees = await response.json();
    
    // Return fee rate based on priority
    if (feeRate === 'low') return fees.economyFee || 1;
    if (feeRate === 'medium') return fees.hourFee || 5;
    if (feeRate === 'high') return fees.fastestFee || 10;
    
    return fees.hourFee || 5; // Default to medium priority
  } catch (error) {
    console.error('Error fetching fee estimate:', error);
    // Fallback to default fee rate
    return 5; // 5 sat/vB default
  }
}

/**
 * Get current Bitcoin price in USD
 */
export async function getBitcoinPrice(): Promise<number> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    const data = await response.json();
    return data.bitcoin?.usd || 65000; // Fallback price
  } catch (error) {
    console.error('Error fetching Bitcoin price:', error);
    return 65000; // Fallback price
  }
}

/**
 * Get Bitcoin address balance
 */
export async function getAddressBalance(
  address: string,
  network: BitcoinNetwork = 'mainnet'
): Promise<number> {
  try {
    const baseUrl = network === 'mainnet'
      ? 'https://mempool.space/api'
      : 'https://mempool.space/testnet/api';
    
    const response = await fetch(`${baseUrl}/address/${address}`);
    const data = await response.json();
    
    // Sum all UTXO values
    const balance = data.chain_stats?.funded_txo_sum || 0;
    const spent = data.chain_stats?.spent_txo_sum || 0;
    
    return balance - spent; // Return confirmed balance in satoshis
  } catch (error) {
    console.error('Error fetching balance:', error);
    return 0;
  }
}

/**
 * Get transaction status
 */
export async function getTransactionStatus(
  txid: string,
  network: BitcoinNetwork = 'mainnet'
): Promise<{ confirmations: number; confirmed: boolean }> {
  try {
    const baseUrl = network === 'mainnet'
      ? 'https://mempool.space/api'
      : 'https://mempool.space/testnet/api';
    
    const response = await fetch(`${baseUrl}/tx/${txid}`);
    const data = await response.json();
    
    return {
      confirmations: data.status?.block_height ? data.status.confirmations || 0 : 0,
      confirmed: data.status?.confirmed || false,
    };
  } catch (error) {
    console.error('Error fetching transaction status:', error);
    return { confirmations: 0, confirmed: false };
  }
}

/**
 * Build a Bitcoin transaction (PSBT)
 * This is a simplified version - in production, you'd use a proper Bitcoin library
 */
export function buildBitcoinTransaction(
  fromAddress: string,
  toAddress: string,
  amountSatoshis: number,
  feeRate: number,
  network: BitcoinNetwork
): {
  outputs: Array<{ address: string; value: number }>;
  feeRate: number;
  estimatedFee: number;
} {
  // Simplified transaction building
  // In production, you'd need to:
  // 1. Fetch UTXOs for fromAddress
  // 2. Select UTXOs to cover amount + fee
  // 3. Create change output if needed
  // 4. Calculate transaction size
  // 5. Calculate actual fee
  
  // Estimate transaction size (rough: 250 bytes for simple transaction)
  const estimatedSize = 250;
  const estimatedFee = estimatedSize * feeRate;
  
  return {
    outputs: [
      { address: toAddress, value: amountSatoshis },
      // Change output would be added here if needed
    ],
    feeRate,
    estimatedFee,
  };
}

/**
 * Sign and broadcast Bitcoin transaction using Unisat wallet
 */
export async function signAndBroadcastUnisat(
  toAddress: string,
  amountSatoshis: number,
  feeRate: number
): Promise<string> {
  if (!window.unisat) {
    throw new Error('Unisat wallet not found');
  }
  
  try {
    // Unisat transaction signing
    const txid = await window.unisat.sendBitcoin(toAddress, amountSatoshis, {
      feeRate,
    });
    
    return txid;
  } catch (error) {
    console.error('Unisat transaction error:', error);
    throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Sign and broadcast Bitcoin transaction using Xverse wallet
 */
export async function signAndBroadcastXverse(
  toAddress: string,
  amountSatoshis: number,
  network: BitcoinNetwork
): Promise<string> {
  if (!window.XverseProviders?.BitcoinProvider) {
    throw new Error('Xverse wallet not found');
  }
  
  try {
    // Xverse uses a different API structure
    const result = await new Promise<string>((resolve, reject) => {
      window.XverseProviders.BitcoinProvider.request('sendTransfer', {
        payload: {
          recipients: [
            {
              address: toAddress,
              amount: amountSatoshis,
            },
          ],
          network: {
            type: network === 'mainnet' ? 'Mainnet' : 'Testnet',
          },
        },
        onFinish: (response: any) => {
          resolve(response.txid);
        },
        onCancel: () => {
          reject(new Error('Transaction cancelled'));
        },
      });
    });
    
    return result;
  } catch (error) {
    console.error('Xverse transaction error:', error);
    throw new Error(`Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get block explorer URL for transaction
 */
export function getTransactionExplorerUrl(
  txid: string,
  network: BitcoinNetwork = 'mainnet'
): string {
  if (network === 'mainnet') {
    return `https://mempool.space/tx/${txid}`;
  } else {
    return `https://mempool.space/testnet/tx/${txid}`;
  }
}

/**
 * Get block explorer URL for address
 */
export function getAddressExplorerUrl(
  address: string,
  network: BitcoinNetwork = 'mainnet'
): string {
  if (network === 'mainnet') {
    return `https://mempool.space/address/${address}`;
  } else {
    return `https://mempool.space/testnet/address/${address}`;
  }
}

