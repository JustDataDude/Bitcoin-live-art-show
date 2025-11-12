"use client";

import { useState, useEffect } from "react";
import { BitcoinNetwork, formatSatoshis } from "../utils/bitcoin";
import { getTransactionStatus, getTransactionExplorerUrl } from "../utils/bitcoinTransactions";

interface TransactionStatusProps {
	txid: string;
	network: BitcoinNetwork;
	amountSatoshis: number;
	onConfirmed?: () => void;
}

export function TransactionStatus({
	txid,
	network,
	amountSatoshis,
	onConfirmed,
}: TransactionStatusProps) {
	const [status, setStatus] = useState<{ confirmations: number; confirmed: boolean } | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!txid) return;

		const checkStatus = async () => {
			try {
				const txStatus = await getTransactionStatus(txid, network);
				setStatus(txStatus);
				setIsLoading(false);

				// If confirmed and callback provided, call it
				if (txStatus.confirmed && onConfirmed) {
					onConfirmed();
				}
			} catch (error) {
				console.error('Error checking transaction status:', error);
				setIsLoading(false);
			}
		};

		checkStatus();
		const interval = setInterval(checkStatus, 10000); // Check every 10 seconds

		return () => clearInterval(interval);
	}, [txid, network, onConfirmed]);

	if (isLoading) {
		return (
			<div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
				<div className="flex items-center gap-3">
					<svg className="animate-spin h-5 w-5 text-blue-400" viewBox="0 0 24 24">
						<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
						<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
					</svg>
					<div>
						<p className="text-sm font-semibold text-white">Checking transaction...</p>
						<p className="text-xs text-slate-400 font-mono">{txid.slice(0, 16)}...</p>
					</div>
				</div>
			</div>
		);
	}

	if (!status) {
		return (
			<div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
				<p className="text-sm text-yellow-400">Transaction not found. It may still be pending.</p>
			</div>
		);
	}

	const explorerUrl = getTransactionExplorerUrl(txid, network);
	const isConfirmed = status.confirmed;
	const confirmations = status.confirmations;

	return (
		<div className={`rounded-lg p-4 border ${
			isConfirmed 
				? 'bg-green-500/10 border-green-500/30' 
				: 'bg-yellow-500/10 border-yellow-500/30'
		}`}>
			<div className="flex items-start justify-between gap-4">
				<div className="flex-1">
					<div className="flex items-center gap-2 mb-2">
						{isConfirmed ? (
							<>
								<div className="w-2 h-2 bg-green-500 rounded-full"></div>
								<span className="text-sm font-semibold text-green-400">Confirmed</span>
							</>
						) : (
							<>
								<div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
								<span className="text-sm font-semibold text-yellow-400">Pending</span>
							</>
						)}
					</div>
					<p className="text-xs text-slate-400 mb-1">
						Amount: {formatSatoshis(amountSatoshis)} BTC
					</p>
					<p className="text-xs text-slate-400 mb-2 font-mono break-all">
						{txid}
					</p>
					{isConfirmed && (
						<p className="text-xs text-green-400">
							✓ {confirmations} confirmation{confirmations !== 1 ? 's' : ''}
						</p>
					)}
				</div>
				<a
					href={explorerUrl}
					target="_blank"
					rel="noopener noreferrer"
					className="text-xs text-blue-400 hover:text-blue-300 underline"
				>
					View on Explorer
				</a>
			</div>
		</div>
	);
}

