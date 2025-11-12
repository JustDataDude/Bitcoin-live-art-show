"use client";

import { useState, useEffect } from "react";
import { Button } from "@live-art/ui";
import { WalletConnect } from "../../components/WalletConnect";
import { BitcoinWalletConnect } from "../../components/BitcoinWalletConnect";
import { useAccount } from "wagmi";
import Link from "next/link";
import { Logo } from "../../components/Logo";

interface MarketplaceItem {
	id: string;
	title: string;
	description: string;
	artistName: string;
	artistId: string;
	currentPrice: number;
	imageUrl?: string;
	royaltyRate: number; // Percentage artist gets on each sale
	ownerId: string;
	ownerName: string;
	status: "available" | "sold" | "pending";
	createdAt: string;
}

export default function MarketplacePage() {
	const { address, isConnected } = useAccount();
	const [items, setItems] = useState<MarketplaceItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
	const [offerAmount, setOfferAmount] = useState("");
	const [isPlacingOffer, setIsPlacingOffer] = useState(false);

	// Fetch marketplace items from API
	useEffect(() => {
		const fetchItems = async () => {
			try {
				const response = await fetch("/api/marketplace");
				if (response.ok) {
					const data = await response.json();
					// If API returns items, use them
					if (Array.isArray(data) && data.length > 0) {
						setItems(data);
						setLoading(false);
						return;
					}
				}
				// Fallback to mock data if API fails or returns empty
				setItems([
					{
						id: "1",
						title: "Digital Dreams #1",
						description: "A stunning piece of digital art created during the live show",
						artistName: "Artist One",
						artistId: "artist_1",
						currentPrice: 500,
						royaltyRate: 10,
						ownerId: "owner_1",
						ownerName: "Collector Alpha",
						status: "available",
						createdAt: new Date().toISOString(),
						imageUrl: "https://picsum.photos/seed/digital-dreams-1/800/800",
					},
					{
						id: "2",
						title: "Crypto Canvas #42",
						description: "Abstract expressionism meets blockchain",
						artistName: "Artist Two",
						artistId: "artist_2",
						currentPrice: 750,
						royaltyRate: 10,
						ownerId: "owner_2",
						ownerName: "Collector Beta",
						status: "available",
						createdAt: new Date().toISOString(),
						imageUrl: "https://picsum.photos/seed/crypto-canvas-42/800/800",
					},
					{
						id: "3",
						title: "Neon Nights",
						description: "Vibrant colors and dynamic composition",
						artistName: "Artist Three",
						artistId: "artist_3",
						currentPrice: 1200,
						royaltyRate: 10,
						ownerId: "owner_3",
						ownerName: "Collector Gamma",
						status: "available",
						createdAt: new Date().toISOString(),
						imageUrl: "https://picsum.photos/seed/neon-nights/800/800",
					},
				]);
			} catch (error) {
				console.error("Error fetching marketplace items:", error);
				// Use mock data on error too
				setItems([
					{
						id: "1",
						title: "Digital Dreams #1",
						description: "A stunning piece of digital art created during the live show",
						artistName: "Artist One",
						artistId: "artist_1",
						currentPrice: 500,
						royaltyRate: 10,
						ownerId: "owner_1",
						ownerName: "Collector Alpha",
						status: "available",
						createdAt: new Date().toISOString(),
						imageUrl: "https://picsum.photos/seed/digital-dreams-1/800/800",
					},
					{
						id: "2",
						title: "Crypto Canvas #42",
						description: "Abstract expressionism meets blockchain",
						artistName: "Artist Two",
						artistId: "artist_2",
						currentPrice: 750,
						royaltyRate: 10,
						ownerId: "owner_2",
						ownerName: "Collector Beta",
						status: "available",
						createdAt: new Date().toISOString(),
						imageUrl: "https://picsum.photos/seed/crypto-canvas-42/800/800",
					},
					{
						id: "3",
						title: "Neon Nights",
						description: "Vibrant colors and dynamic composition",
						artistName: "Artist Three",
						artistId: "artist_3",
						currentPrice: 1200,
						royaltyRate: 10,
						ownerId: "owner_3",
						ownerName: "Collector Gamma",
						status: "available",
						createdAt: new Date().toISOString(),
						imageUrl: "https://picsum.photos/seed/neon-nights/800/800",
					},
				]);
			} finally {
				setLoading(false);
			}
		};

		fetchItems();
	}, []);

	const handlePlaceOffer = async (item: MarketplaceItem) => {
		if (!isConnected || !address) {
			alert("Please connect your wallet first");
			return;
		}

		const amount = parseFloat(offerAmount);
		if (isNaN(amount) || amount <= 0) {
			alert("Please enter a valid offer amount");
			return;
		}

		setIsPlacingOffer(true);
		try {
			const response = await fetch("/api/marketplace", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					itemId: item.id,
					buyerId: address,
					amountUsd: amount,
					artistId: item.artistId,
				}),
			});

			if (response.ok) {
				const data = await response.json();
				
				// Update the item's current price to reflect the new offer
				setItems((prevItems) =>
					prevItems.map((prevItem) =>
						prevItem.id === item.id
							? {
									...prevItem,
									currentPrice: amount, // Update to the new offer amount
									ownerId: address,
									ownerName: address.slice(0, 6) + "..." + address.slice(-4), // Show buyer's address
								}
							: prevItem
					)
				);
				
				alert(`✅ ${data.message || `Offer of $${amount} placed! The artist will receive ${item.royaltyRate}% ($${(amount * item.royaltyRate / 100).toFixed(2)}) as royalty.`}`);
				setOfferAmount("");
				setSelectedItem(null);
			} else {
				const error = await response.json();
				alert(`❌ Failed to place offer: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			alert(`❌ Failed to place offer: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setIsPlacingOffer(false);
		}
	};

	return (
		<main className="min-h-screen p-6 max-w-7xl mx-auto">
			{/* Header */}
			<header className="mb-4">
				{/* Logo */}
				<div className="flex justify-center pb-3">
					<div className="w-72 h-72">
						<img
							src="/logo.png"
							alt="1 of 1's Game Show Logo"
							className="object-contain w-full h-full bg-transparent"
						/>
					</div>
				</div>
				
				<div className="text-center py-3">
					<h1 className="text-5xl font-bold gradient-text mb-2">🛒 Marketplace</h1>
					<p className="text-slate-400 text-lg">Trade art pieces - Artists always get a cut</p>
				</div>

				{/* Navigation */}
				<nav className="flex justify-center gap-4 mb-6">
					<Link 
						href="/" 
						className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-all"
					>
						🏠 Home
					</Link>
					<Link 
						href="/show/seed-show-1" 
						className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all"
					>
						🎮 Live Show
					</Link>
				</nav>

				{/* Wallet Connection */}
				<div className="glass rounded-2xl p-6 glow-border mb-6">
					<h2 className="text-white font-semibold text-lg mb-4 flex items-center gap-2">
						<span className="text-2xl">💳</span> Connect Your Wallet
					</h2>
					<div className="flex flex-col gap-4">
						<div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl border border-blue-500/20">
							<span className="text-sm font-medium text-slate-300">Ethereum Wallet</span>
							<WalletConnect />
						</div>
						<div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
							<span className="text-sm font-medium text-slate-300">Bitcoin Wallet</span>
							<BitcoinWalletConnect />
						</div>
					</div>
				</div>

				{/* Artist Royalty Info */}
				<div className="glass rounded-2xl p-6 border border-green-500/20 mb-6">
					<div className="flex items-center gap-3">
						<div className="w-12 h-12 flex-shrink-0">
							<img
								src="/logo.png"
								alt="1 of 1's Game Show Logo"
								className="object-contain w-full h-full bg-transparent"
							/>
						</div>
						<div>
							<h3 className="text-lg font-bold text-white">Artist Royalty System</h3>
							<p className="text-sm text-slate-300">
								Every trade on our marketplace includes a royalty payment to the original artist. 
								This incentivizes artists to create and ensures they benefit from the success of their work.
							</p>
							<p className="text-xs text-green-400 mt-2">
								✨ Default royalty rate: 10% of each sale goes to the artist
							</p>
						</div>
					</div>
				</div>
			</header>

			{/* Marketplace Items Grid */}
			{loading ? (
				<div className="text-center py-12">
					<div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
					<p className="text-slate-400 mt-4">Loading marketplace...</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{items.map((item) => (
						<div
							key={item.id}
							className="glass rounded-2xl overflow-hidden border border-blue-500/20 hover:border-blue-500/50 transition-all"
						>
							{/* Art Preview */}
							<div className="aspect-square bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center overflow-hidden">
								{item.imageUrl ? (
									<img
										src={item.imageUrl}
										alt={item.title}
										className="w-full h-full object-cover"
									/>
								) : (
									<div className="w-full h-full flex items-center justify-center">
										<img
											src="/logo.png"
											alt="1 of 1's Game Show Logo"
											className="w-32 h-32 object-contain opacity-50"
										/>
									</div>
								)}
							</div>

							{/* Item Info */}
							<div className="p-6 space-y-4">
								<div>
									<h3 className="text-xl font-bold text-white mb-1">{item.title}</h3>
									<p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
								</div>

								<div className="space-y-2">
									<div className="flex justify-between items-center">
										<span className="text-xs text-slate-400">Artist</span>
										<span className="text-sm font-semibold text-purple-300">{item.artistName}</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-xs text-slate-400">Current Owner</span>
										<span className="text-sm font-semibold text-blue-300">{item.ownerName}</span>
									</div>
									<div className="flex justify-between items-center">
										<span className="text-xs text-slate-400">Price</span>
										<span className="text-lg font-bold text-green-400">${item.currentPrice}</span>
									</div>
									<div className="flex justify-between items-center pt-2 border-t border-slate-700">
										<span className="text-xs text-slate-400">Artist Royalty</span>
										<span className="text-sm font-semibold text-green-300">
											{item.royaltyRate}% (${(item.currentPrice * item.royaltyRate / 100).toFixed(2)})
										</span>
									</div>
								</div>

								<Button
									onClick={() => setSelectedItem(item)}
									className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 rounded-xl transition-all"
								>
									Make Offer
								</Button>
							</div>
						</div>
					))}
				</div>
			)}

			{/* Offer Modal */}
			{selectedItem && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
					<div className="glass rounded-2xl p-6 max-w-md w-full border border-purple-500/30">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-2xl font-bold text-white">Make an Offer</h3>
							<button
								onClick={() => {
									setSelectedItem(null);
									setOfferAmount("");
								}}
								className="text-slate-400 hover:text-white transition-colors"
							>
								✕
							</button>
						</div>

						<div className="space-y-4">
							<div>
								<h4 className="text-lg font-semibold text-white mb-2">{selectedItem.title}</h4>
								<p className="text-sm text-slate-400 mb-4">by {selectedItem.artistName}</p>
							</div>

							<div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-2">
								<div className="flex justify-between text-sm">
									<span className="text-slate-400">Current Price</span>
									<span className="text-white font-semibold">${selectedItem.currentPrice}</span>
								</div>
								<div className="flex justify-between text-sm">
									<span className="text-slate-400">Artist Royalty ({selectedItem.royaltyRate}%)</span>
									<span className="text-green-400 font-semibold">
										${(parseFloat(offerAmount || "0") * selectedItem.royaltyRate / 100).toFixed(2)}
									</span>
								</div>
								<div className="flex justify-between text-sm pt-2 border-t border-slate-700">
									<span className="text-slate-400">You Pay</span>
									<span className="text-white font-bold">
										${offerAmount || "0.00"}
									</span>
								</div>
							</div>

							<div>
								<label className="block text-sm font-medium text-slate-300 mb-2">
									Your Offer (USD)
								</label>
								<input
									type="number"
									value={offerAmount}
									onChange={(e) => setOfferAmount(e.target.value)}
									placeholder="Enter amount"
									min={selectedItem.currentPrice}
									step="0.01"
									className="w-full bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 focus:border-blue-500 rounded-xl px-4 py-3 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
								/>
								{offerAmount && parseFloat(offerAmount) < selectedItem.currentPrice && (
									<p className="text-xs text-yellow-400 mt-1">
										⚠️ Offer is below current price (${selectedItem.currentPrice})
									</p>
								)}
							</div>

							<div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
								<p className="text-xs text-green-300">
									💡 The artist will automatically receive {selectedItem.royaltyRate}% of this sale as a royalty payment.
								</p>
							</div>

							<Button
								onClick={() => handlePlaceOffer(selectedItem)}
								disabled={!offerAmount || parseFloat(offerAmount) <= 0 || isPlacingOffer || !isConnected}
								className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								{isPlacingOffer ? "Processing..." : isConnected ? "Place Offer" : "Connect Wallet First"}
							</Button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}

