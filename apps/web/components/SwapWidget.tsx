"use client";

import { useState, useEffect } from "react";
import { Button } from "@live-art/ui";
import { useAccount, useWalletClient, useConnect } from "wagmi";

interface RelayStep {
	id: string;
	action: string;
	description: string;
	kind: string;
	requestId?: string;
	items: Array<{
		status: string;
		data: {
			from: string;
			to: string;
			data: string;
			value: string;
			chainId: number;
		};
		check?: {
			endpoint: string;
			method: string;
		};
	}>;
}

interface RelayQuote {
	steps: RelayStep[];
	fees?: {
		gas: {
			amount: string;
			currency: string;
		};
		relayer: {
			amount: string;
			currency: string;
		};
	};
	details?: {
		operation: string;
		timeEstimate: number;
		currencyIn: {
			currency: {
				chainId: number;
				address: string;
				symbol: string;
				name: string;
				decimals: number;
			};
			amount: string;
		};
		currencyOut: {
			currency: {
				chainId: number;
				address: string;
				symbol: string;
				name: string;
				decimals: number;
			};
			amount: string;
		};
	};
}

export function SwapWidget() {
	const [isMounted, setIsMounted] = useState(false);
	const { address, isConnected } = useAccount();
	const { data: walletClient } = useWalletClient();
	const { connect, connectors, error: connectError } = useConnect();
	
	const [fromToken, setFromToken] = useState("USDC");
	const [toToken, setToToken] = useState("ETH");
	const [fromAmount, setFromAmount] = useState("");
	const [toAmount, setToAmount] = useState("");
	const [slippage, setSlippage] = useState(0.5);
	const [isLoading, setIsLoading] = useState(false);
	const [isSwapping, setIsSwapping] = useState(false);
	const [quote, setQuote] = useState<RelayQuote | null>(null);

	// Prevent hydration errors by only rendering after mount
	useEffect(() => {
		setIsMounted(true);
	}, []);

	// Fetch quote when amounts change
	useEffect(() => {
		if (!fromAmount || parseFloat(fromAmount) <= 0) {
			setToAmount("");
			setQuote(null);
			return;
		}

		const fetchQuote = async () => {
			setIsLoading(true);
			try {
				// Convert amount to wei (18 decimals) for native tokens
				const amountInWei = (parseFloat(fromAmount) * Math.pow(10, 18)).toString();
				
				const response = await fetch("https://api.relay.link/quote", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						user: address || "0x0000000000000000000000000000000000000000",
						originChainId: 84532, // Base Sepolia
						destinationChainId: 84532,
						originCurrency: fromToken === "USDC" ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e" : "0x0000000000000000000000000000000000000000",
						destinationCurrency: toToken === "USDC" ? "0x036CbD53842c5426634e7929541eC2318f3dCF7e" : "0x0000000000000000000000000000000000000000",
						amount: amountInWei,
						tradeType: "EXACT_INPUT",
					}),
				});

				if (response.ok) {
					const data = await response.json();
					setQuote(data);
					
					// Extract output amount from the new response structure
					if (data.details?.currencyOut?.amount) {
						const outputAmount = parseFloat(data.details.currencyOut.amount);
						const decimals = data.details.currencyOut.currency?.decimals || 18;
						const displayAmount = outputAmount / Math.pow(10, decimals);
						setToAmount(displayAmount.toFixed(6));
					}
				} else {
					const errorText = await response.text();
					console.error("Failed to fetch quote:", errorText);
					setQuote(null);
					setToAmount("");
				}
			} catch (error) {
				console.error("Error fetching quote:", error);
				setQuote(null);
			} finally {
				setIsLoading(false);
			}
		};

		const timeoutId = setTimeout(fetchQuote, 500);
		return () => clearTimeout(timeoutId);
	}, [fromAmount, fromToken, toToken, slippage, address]);

	const handleSwap = async () => {
		if (!isConnected) {
			console.log("Connectors available:", connectors.length);
			if (connectors.length > 0) {
				console.log("Connecting with connector:", connectors[0].name);
				try {
					await connect({ connector: connectors[0] });
				} catch (err) {
					console.error("Connection error:", err);
				}
			} else {
				alert("No wallet connectors available. Please make sure MetaMask or another wallet extension is installed.");
			}
			return;
		}
		
		if (!fromAmount || !quote || !address || !walletClient) {
			alert("Please enter an amount and wait for the quote to load");
			return;
		}

		setIsSwapping(true);

		try {
			// Execute the swap through Relay
			if (quote.steps && quote.steps.length > 0) {
				const transactionSteps = quote.steps.filter(step => step.kind === "transaction");
				
				if (transactionSteps.length === 0) {
					alert("❌ No transaction steps found in quote");
					return;
				}

				// Execute each transaction step
				for (const step of transactionSteps) {
					for (const item of step.items) {
						if (item.status === "incomplete" && item.data) {
							const txData = item.data;
							
							console.log("Executing transaction:", txData);
							
							// Check if we're on the correct chain
							if (walletClient.chain?.id !== txData.chainId) {
								alert(`Please switch to chain ${txData.chainId}`);
								return;
							}

							// Execute the transaction using the wallet client
							const hash = await walletClient.sendTransaction({
								to: txData.to as `0x${string}`,
								value: BigInt(txData.value),
								data: txData.data as `0x${string}`,
							});

							console.log("Transaction hash:", hash);
							alert(`✅ Transaction sent! Hash: ${hash}`);
						}
					}
				}

				setFromAmount("");
				setToAmount("");
				setQuote(null);
			} else {
				alert("❌ No valid quote available. Please try again.");
			}
		} catch (error) {
			console.error("Error executing swap:", error);
			alert(`❌ Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setIsSwapping(false);
		}
	};

	const flipTokens = () => {
		const temp = fromToken;
		setFromToken(toToken);
		setToToken(temp);
		const tempAmount = fromAmount;
		setFromAmount(toAmount);
		setToAmount(tempAmount);
	};

	// Don't render until mounted to prevent hydration errors
	if (!isMounted) {
		return null;
	}

	return (
		<div className="glass rounded-2xl p-6 border border-blue-500/20">
			<div className="flex items-center justify-between mb-4">
				<h2 className="font-bold text-white flex items-center gap-2">
					<span className="text-2xl">🔄</span> Swap via Relay
				</h2>
				<div className="flex items-center gap-2">
					<span className="text-xs text-slate-400">Slippage:</span>
					<select 
						value={slippage}
						onChange={(e) => setSlippage(parseFloat(e.target.value))}
						className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
					>
						<option value={0.1}>0.1%</option>
						<option value={0.5}>0.5%</option>
						<option value={1}>1%</option>
						<option value={2}>2%</option>
					</select>
				</div>
			</div>

			<div className="space-y-3">
				{/* From Input */}
				<div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-xl p-4">
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs text-slate-400">From</span>
						<select
							value={fromToken}
							onChange={(e) => setFromToken(e.target.value)}
							className="bg-black/30 border border-blue-500/30 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
						>
							<option value="USDC">USDC</option>
							<option value="ETH">ETH</option>
						</select>
					</div>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
							<span className="text-xl font-bold text-white">{fromToken}</span>
						</div>
						<input
							type="number"
							placeholder="0.00"
							value={fromAmount}
							onChange={(e) => setFromAmount(e.target.value)}
							className="flex-1 bg-transparent text-right text-xl font-bold text-white placeholder-slate-600 focus:outline-none"
							step="0.0001"
						/>
					</div>
				</div>

				{/* Swap Button */}
				<div className="flex justify-center">
					<button
						onClick={flipTokens}
						className="bg-purple-500/20 hover:bg-purple-500/30 border-2 border-purple-500/50 rounded-full p-3 transition-all hover:rotate-180 duration-300"
					>
					<svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
						</svg>
					</button>
				</div>

				{/* To Output */}
				<div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl p-4">
					<div className="flex items-center justify-between mb-2">
						<span className="text-xs text-slate-400">To</span>
						<select
							value={toToken}
							onChange={(e) => setToToken(e.target.value)}
							className="bg-black/30 border border-green-500/30 rounded-lg px-ঢ় py-1 text-xs text-white focus:outline-none"
						>
							<option value="ETH">ETH</option>
							<option value="USDC">USDC</option>
						</select>
					</div>
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2 bg-black/30 rounded-lg px-3 py-2">
							<span className="text-xl font-bold text-white">{toToken}</span>
						</div>
						<input
							type="number"
							placeholder="0.00"
							value={toAmount}
							disabled
							className="flex-1 bg-transparent text-right text-xl font-bold text-white placeholder-slate-600 focus:outline-none opacity-50"
							step="0.0001"
						/>
					</div>
				</div>

				{/* Swap Info */}
				{quote && (
					<div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 space-y-1">
						<div className="flex justify-between text-xs">
							<span className="text-slate-400">Rate</span>
							<span className="text-white">
								1 {fromToken} = {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken}
							</span>
						</div>
						<div className="flex justify-between text-xs">
							<span className="text-slate-400">Max Slippage</span>
							<span className="text-white">{slippage}%</span>
						</div>
						{quote.fees?.gas && (
							<div className="flex justify-between text-xs">
								<span className="text-slate-400">Gas Fee</span>
								<span className="text-white">
									~{(parseFloat(quote.fees.gas.amount) / Math.pow(10, 18)).toFixed(4)} {quote.fees.gas.currency.toUpperCase()}
								</span>
							</div>
						)}
						{quote.fees?.relayer && (
							<div className="flex justify-between text-xs">
								<span className="text-slate-400">Relayer Fee</span>
								<span className="text-white">
									~{(parseFloat(quote.fees.relayer.amount) / Math.pow(10, 18)).toFixed(4)} {quote.fees.relayer.currency.toUpperCase()}
								</span>
							</div>
						)}
						{quote.details?.timeEstimate && (
							<div className="flex justify-between text-xs">
								<span className="text-slate-400">Estimated Time</span>
								<span className="text-white">~{quote.details.timeEstimate} seconds</span>
							</div>
						)}
					</div>
				)}

			{/* Debug Info */}
			{connectors.length === 0 && (
				<p className="text-xs text-center text-yellow-500 mb-2">
					⚠️ No wallet detected. Please install a wallet extension like MetaMask.
				</p>
			)}

			{/* Swap Button */}
			<Button
				onClick={handleSwap}
				disabled={isSwapping || isLoading || connectors.length === 0 || (!isConnected && !fromAmount)}
				className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-4 rounded-xl text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
			>
					{isSwapping ? (
						<span className="flex items-center justify-center gap-2">
							<svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
								<circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
								<path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
							</svg>
							Swapping...
						</span>
					) : isLoading ? (
						"Loading quote..."
					) : !isConnected ? (
						"Connect Wallet"
					) : (
						"Swap"
					)}
				</Button>

				{/* Error Display */}
				{connectError && (
					<p className="text-xs text-center text-red-500 mt-2">
						⚠️ {connectError.message}
					</p>
				)}

				{/* Disclaimer */}
				<p className="text-xs text-center text-slate-500">
					⚠️ Powered by Relay.link - Always verify transaction details
				</p>
			</div>
		</div>
	);
}
