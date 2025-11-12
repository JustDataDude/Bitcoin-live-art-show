"use client";

import { useState, useEffect } from "react";
import { Button } from "@live-art/ui";
import { BitcoinNetwork, formatSatoshis, satoshisToUsd } from "../utils/bitcoin";
import { 
	estimateTransactionFee, 
	getBitcoinPrice, 
	getAddressBalance,
	getTransactionExplorerUrl,
	signAndBroadcastUnisat,
	signAndBroadcastXverse
} from "../utils/bitcoinTransactions";

interface BitcoinPaymentModalProps {
	isOpen: boolean;
	onClose: () => void;
	amountUsd: number;
	toAddress: string;
	fromAddress: string;
	network: BitcoinNetwork;
	walletType: 'unisat' | 'xverse' | 'magicEden' | 'okx';
	onSuccess: (txid: string) => void;
}

export function BitcoinPaymentModal({
	isOpen,
	onClose,
	amountUsd,
	toAddress,
	fromAddress,
	network,
	walletType,
	onSuccess,
}: BitcoinPaymentModalProps) {
	const [btcPrice, setBtcPrice] = useState<number>(65000);
	const [balance, setBalance] = useState<number>(0);
	const [feeRate, setFeeRate] = useState<'low' | 'medium' | 'high'>('medium');
	const [estimatedFee, setEstimatedFee] = useState<number>(0);
	const [amountSatoshis, setAmountSatoshis] = useState<number>(0);
	const [totalSatoshis, setTotalSatoshis] = useState<number>(0);
	const [isProcessing, setIsProcessing] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load Bitcoin price and balance
	useEffect(() => {
		if (!isOpen) return;

		const loadData = async () => {
			const [price, addrBalance, fee] = await Promise.all([
				getBitcoinPrice(),
				getAddressBalance(fromAddress, network),
				estimateTransactionFee(network, feeRate),
			]);

			setBtcPrice(price);
			setBalance(addrBalance);
			setEstimatedFee(fee * 250); // Rough estimate: 250 bytes * fee rate
		};

		loadData();
		const interval = setInterval(loadData, 30000); // Update every 30 seconds

		return () => clearInterval(interval);
	}, [isOpen, fromAddress, network, feeRate]);

	// Calculate amounts when price or fee changes
	useEffect(() => {
		if (btcPrice > 0) {
			const sats = Math.floor((amountUsd / btcPrice) * 100000000);
			setAmountSatoshis(sats);
			setTotalSatoshis(sats + estimatedFee);
		}
	}, [amountUsd, btcPrice, estimatedFee]);

	// Update fee when fee rate changes
	useEffect(() => {
		const updateFee = async () => {
			const fee = await estimateTransactionFee(network, feeRate);
			setEstimatedFee(fee * 250);
		};
		updateFee();
	}, [feeRate, network]);

	const handlePayment = async () => {
		if (totalSatoshis > balance) {
			setError(`Insufficient balance. You have ${formatSatoshis(balance)} BTC but need ${formatSatoshis(totalSatoshis)} BTC`);
			return;
		}

		setIsProcessing(true);
		setError(null);

		try {
			let txid: string;

			if (walletType === 'unisat') {
				const feeRateValue = await estimateTransactionFee(network, feeRate);
				txid = await signAndBroadcastUnisat(toAddress, amountSatoshis, feeRateValue);
			} else if (walletType === 'xverse') {
				txid = await signAndBroadcastXverse(toAddress, amountSatoshis, network);
			} else {
				throw new Error(`${walletType} wallet transaction signing not yet implemented`);
			}

			onSuccess(txid);
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Transaction failed');
		} finally {
			setIsProcessing(false);
		}
	};

	if (!isOpen) return null;

	const totalUsd = satoshisToUsd(totalSatoshis, btcPrice);
	const feeUsd = satoshisToUsd(estimatedFee, btcPrice);

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
			<div className="glass rounded-2xl p-6 max-w-md w-full border border-purple-500/30">
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-2xl font-bold text-white">Bitcoin Payment</h3>
					<button
						onClick={onClose}
						className="text-slate-400 hover:text-white transition-colors"
					>
						✕
					</button>
				</div>

				<div className="space-y-4">
					{/* Payment Details */}
					<div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
						<div className="flex justify-between text-sm">
							<span className="text-slate-400">Amount</span>
							<span className="text-white font-semibold">${amountUsd.toFixed(2)} USD</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-slate-400">Bitcoin Amount</span>
							<span className="text-white font-semibold">{formatSatoshis(amountSatoshis)} BTC</span>
						</div>
						<div className="flex justify-between text-sm">
							<span className="text-slate-400">Network Fee</span>
							<span className="text-white font-semibold">{formatSatoshis(estimatedFee)} BTC (${feeUsd.toFixed(2)})</span>
						</div>
						<div className="pt-2 border-t border-slate-700 flex justify-between">
							<span className="text-slate-300 font-semibold">Total</span>
							<span className="text-white font-bold text-lg">{formatSatoshis(totalSatoshis)} BTC (${totalUsd.toFixed(2)})</span>
						</div>
					</div>

					{/* Fee Rate Selection */}
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Transaction Priority
						</label>
						<div className="flex gap-2">
							<button
								onClick={() => setFeeRate('low')}
								className={`flex-1 px-3 py-2 rounded-lg border transition-all ${
									feeRate === 'low'
										? 'bg-green-500/20 border-green-500 text-green-300'
										: 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
								}`}
							>
								Low (~10 min)
							</button>
							<button
								onClick={() => setFeeRate('medium')}
								className={`flex-1 px-3 py-2 rounded-lg border transition-all ${
									feeRate === 'medium'
										? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
										: 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
								}`}
							>
								Medium (~5 min)
							</button>
							<button
								onClick={() => setFeeRate('high')}
								className={`flex-1 px-3 py-2 rounded-lg border transition-all ${
									feeRate === 'high'
										? 'bg-red-500/20 border-red-500 text-red-300'
										: 'bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500'
								}`}
							>
								High (~1 min)
							</button>
						</div>
					</div>

					{/* Balance Info */}
					<div className="bg-slate-800/50 rounded-lg p-3 flex justify-between items-center">
						<span className="text-sm text-slate-400">Your Balance</span>
						<span className={`text-sm font-semibold ${balance >= totalSatoshis ? 'text-green-400' : 'text-red-400'}`}>
							{formatSatoshis(balance)} BTC
						</span>
					</div>

					{/* Recipient Address */}
					<div>
						<label className="block text-sm font-medium text-slate-300 mb-2">
							Recipient Address
						</label>
						<div className="bg-slate-800/50 rounded-lg p-3 text-xs font-mono text-slate-300 break-all">
							{toAddress}
						</div>
					</div>

					{/* Error Display */}
					{error && (
						<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
							<p className="text-sm text-red-400">{error}</p>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex gap-3">
						<Button
							onClick={onClose}
							variant="secondary"
							className="flex-1"
							disabled={isProcessing}
						>
							Cancel
						</Button>
						<Button
							onClick={handlePayment}
							disabled={isProcessing || balance < totalSatoshis}
							className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isProcessing ? (
								<span className="flex items-center justify-center gap-2">
									<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
										<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
										<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
									</svg>
									Processing...
								</span>
							) : (
								`Pay ${formatSatoshis(totalSatoshis)} BTC`
							)}
						</Button>
					</div>

					{/* Network Info */}
					<div className="text-center text-xs text-slate-500">
						Network: {network === 'mainnet' ? 'Bitcoin Mainnet' : 'Bitcoin Testnet'}
					</div>
				</div>
			</div>
		</div>
	);
}

