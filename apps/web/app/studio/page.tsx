"use client";

import { useState, useEffect } from "react";
import { Button } from "@live-art/ui";
import { WebRTCPublisher } from "../../components/WebRTCPublisher";
import io from "socket.io-client";

export default function StudioPage() {
	const [starting, setStarting] = useState(false);
	const [ending, setEnding] = useState(false);
	const [showStatus, setShowStatus] = useState<any>(null);
	const [lot, setLot] = useState<any>(null);
	const [socket, setSocket] = useState<any>(null);
	const [currentBids, setCurrentBids] = useState<any[]>([]);
	const [topBid, setTopBid] = useState<any>(null);
	const [messages, setMessages] = useState<any[]>([]);
	const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

	// Initialize socket connection
	useEffect(() => {
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		
		console.log(`[Studio] Connecting to WebSocket: ${wsUrl}`);
		const socketInstance = io(wsUrl, {
			transports: ["polling", "websocket"],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});
		setSocket(socketInstance);

		socketInstance.on("BID_PLACED", (e: any) => {
			const data = e.data;
			setCurrentBids(prev => [...prev, data]);
			if (!topBid || data.amountUsd > topBid.amountUsd) {
				setTopBid(data);
			}
		});

		socketInstance.on("TIP_RECEIVED", (e: any) => {
			const data = e.data;
			// Handle tips in the studio if needed
			console.log("Tip received:", data);
		});

		socketInstance.on("CHAT_MESSAGE", (e: any) => {
			setMessages(prev => [...prev, {
				messageId: e.data.messageId,
				userId: e.data.userId,
				username: e.data.username,
				message: e.data.message,
				ts: Date.now(),
				type: 'chat'
			}]);
		});

		socketInstance.on("message_deleted", (e: any) => {
			setMessages((prev) => prev.filter(msg => msg.messageId !== e.messageId));
		});

		socketInstance.on("user_banned", (e: any) => {
			setMessages((prev) => prev.filter(msg => msg.username !== e.username));
			setBlockedUsers(prev => new Set([...prev, e.username]));
		});

		socketInstance.on("user_unbanned", (e: any) => {
			setBlockedUsers(prev => {
				const newSet = new Set(prev);
				newSet.delete(e.username);
				return newSet;
			});
		});

		return () => {
			socketInstance.disconnect();
		};
	}, []);

	// Fetch initial lot and show data
	useEffect(() => {
		const fetchData = async () => {
			try {
				const [lotRes, showRes] = await Promise.all([
					fetch("/api/lots/seed-lot-1"),
					fetch("/api/shows/seed-show-1"),
				]);
				
				if (lotRes.ok) {
					const lotData = await lotRes.json();
					setLot(lotData);
					
					// Get current bids for this lot
					const bidsRes = await fetch("/api/lots/seed-lot-1/bids");
					if (bidsRes.ok) {
						const bids = await bidsRes.json();
						setCurrentBids(bids);
						if (bids.length > 0) {
							// Sort bids by amount to get top bid
							const sortedBids = [...bids].sort((a, b) => b.amountUsd - a.amountUsd);
							setTopBid(sortedBids[0]);
						}
					}

					// Get chat messages for this lot
					const messagesRes = await fetch("/api/lots/seed-lot-1/messages");
					if (messagesRes.ok) {
						const msgs = await messagesRes.json();
						setMessages(msgs);
					}
				}
				
				if (showRes.ok) {
					const showData = await showRes.json();
					setShowStatus(showData);
				}
			} catch (error) {
				console.error("Error fetching data:", error);
			}
		};

		fetchData();
		const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
		return () => clearInterval(interval);
	}, []);

	async function startLot() {
		try {
			setStarting(true);
			const res = await fetch(`/api/lots/seed-lot-1/start`, { method: "POST" });
			if (res.ok) {
				alert("✅ Auction started!");
			} else {
				const error = await res.json();
				alert(`Error starting auction: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error("Error starting lot:", error);
			alert("Error starting auction. Please try again.");
		} finally {
			setStarting(false);
		}
	}

	async function endLot() {
		try {
			setEnding(true);
			const res = await fetch(`/api/lots/seed-lot-1/end`, { method: "POST" });
			if (res.ok) {
				alert("✅ Auction ended!");
			} else {
				const error = await res.json();
				alert(`Error ending auction: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error("Error ending lot:", error);
			alert("Error ending auction. Please try again.");
		} finally {
			setEnding(false);
		}
	}

	async function mockWinnerPayment() {
		try {
			const res = await fetch(`/api/payments/confirm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ lotId: "seed-lot-1", payerId: "bidder_1", amountUsd: 100, chain: "BASE_SEPOLIA" }),
			});
			if (res.ok) {
				alert("✅ Payment confirmed and inscription enqueued (mock)");
			} else {
				const error = await res.json();
				alert(`Error confirming payment: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error("Error confirming payment:", error);
			alert("Error confirming payment. Please try again.");
		}
	}

	async function startShow() {
		try {
			const res = await fetch("/api/shows/seed-show-1/go-live", { method: "POST" });
			if (res.ok) {
				alert("✅ Show started!");
			} else {
				const error = await res.json();
				alert(`Error starting show: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error("Error starting show:", error);
			alert("Error starting show. Please try again.");
		}
	}

	async function endShow() {
		try {
			// Stop all streams
			if (socket) {
				socket.emit("stop_all_streams");
			}
			
			// End the lot
			await fetch(`/api/lots/seed-lot-1/end`, { method: "POST" });
			
			// Update show status
			const res = await fetch("/api/shows/seed-show-1", { 
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "ENDED" })
			});
			
			if (res.ok) {
				alert("✅ Show ended! All streams stopped.");
			} else {
				const error = await res.json();
				alert(`Error ending show: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error("Error ending show:", error);
			alert("Error ending show. Please try again.");
		}
	}

	async function extendAuction() {
		try {
			const lot = await fetch("/api/lots/seed-lot-1").then(r => r.ok ? r.json() : null);
			if (!lot) {
				alert("❌ Could not load lot data");
				return;
			}
			
			if (lot.status !== "LIVE" || !lot.auctionEndsAt) {
				alert("❌ Auction is not currently live");
				return;
			}

			// Extend by 60 seconds from current end time
			const newEndTime = new Date(new Date(lot.auctionEndsAt).getTime() + 60 * 1000);
			
			const res = await fetch("/api/lots/seed-lot-1", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ auctionEndsAt: newEndTime.toISOString() })
			});
			
			if (res.ok) {
				alert("✅ Auction extended by 60 seconds!");
			} else {
				const error = await res.json();
				alert(`Error extending auction: ${error.error || 'Unknown error'}`);
			}
		} catch (error) {
			console.error("Error extending auction:", error);
			alert("Error extending auction. Please try again.");
		}
	}

	function banUser(username: string) {
		setBlockedUsers(prev => new Set([...prev, username]));
		// Emit ban event to server if needed
		if (socket) {
			socket.emit("ban_user", { username });
		}
	}

	function unbanUser(username: string) {
		setBlockedUsers(prev => {
			const newSet = new Set(prev);
			newSet.delete(username);
			return newSet;
		});
		// Emit unban event to server if needed
		if (socket) {
			socket.emit("unban_user", { username });
		}
	}

	function deleteMessage(messageId: number) {
		if (socket) {
			socket.emit("delete_message", { messageId });
		}
	}

	return (
		<main className="max-w-6xl mx-auto p-6 space-y-6">
			<h1 className="text-3xl font-bold">🎬 1 of 1's Game Show Studio</h1>
			
			{/* Show Status */}
			<div className="glass p-4 rounded-lg border border-blue-500/20">
				<h2 className="text-xl font-semibold mb-2">📺 Show Status</h2>
				<div className="grid grid-cols-3 gap-4">
				<div>
					<div className="text-sm text-gray-400">Show Status</div>
					<div className="text-lg font-bold">{showStatus?.status || "Loading..."}</div>
				</div>
				<div>
					<div className="text-sm text-gray-400">Lot Status</div>
					<div className="text-lg font-bold">{lot?.status || "Loading..."}</div>
					{lot?.auctionEndsAt && (
						<div className="text-xs text-red-400 mt-1">
							Ends: {new Date(lot.auctionEndsAt).toLocaleTimeString()}
						</div>
					)}
				</div>
				<div>
					{showStatus?.status === "LIVE" ? (
						<Button onClick={endShow} size="sm" className="w-full bg-red-600 hover:bg-red-700">End Show</Button>
					) : (
						<Button onClick={startShow} size="sm" className="w-full">Start Show</Button>
					)}
				</div>
			</div>
			</div>

			{/* Bid Status */}
			<div className="glass p-4 rounded-lg border border-blue-500/20">
				<h2 className="text-xl font-semibold mb-2">💰 Current Bidding</h2>
				{topBid ? (
					<div className="space-y-2">
						<div className="flex justify-between items-center">
							<span className="text-sm text-gray-400">Top Bid</span>
							<span className="text-2xl font-bold text-green-400">${(topBid.amountUsd || topBid.amount)?.toFixed(2) || (topBid.amountUsd || topBid.amount)}</span>
						</div>
						<div className="flex justify-between items-center text-sm">
							<span className="text-gray-400">Bidder</span>
							<span className="font-mono">{topBid.userHandle || topBid.username || "Anonymous"}</span>
						</div>
						<div className="flex justify-between items-center text-sm">
							<span className="text-gray-400">Total Bids</span>
							<span>{currentBids.length}</span>
						</div>
					</div>
				) : (
					<p className="text-gray-400">No bids yet</p>
				)}
			</div>

			{/* Recent Bids */}
			<div className="glass p-4 rounded-lg border border-blue-500/20">
				<h2 className="text-xl font-semibold mb-4">📋 Recent Bids</h2>
				<div className="space-y-2 max-h-64 overflow-y-auto">
					{currentBids.length > 0 ? (
						currentBids.slice(0, 10).map((bid, idx) => (
							<div key={idx} className="flex justify-between items-center p-2 bg-neutral-800/50 rounded">
								<div className="flex items-center gap-2">
									<span className="text-xs text-gray-400">#{idx + 1}</span>
									<span className="font-mono text-sm">{bid.userHandle || bid.username || "Anonymous"}</span>
								</div>
								<span className="text-sm font-bold text-green-400">${(bid.amountUsd || bid.amount)?.toFixed(2) || (bid.amountUsd || bid.amount)}</span>
							</div>
						))
					) : (
						<p className="text-gray-400 text-center py-4">No bids yet</p>
					)}
				</div>
			</div>

			{/* Live Chat Control */}
			<div className="glass p-4 rounded-lg border border-blue-500/20">
				<h2 className="text-xl font-semibold mb-4">💬 Live Chat</h2>
				<div className="space-y-3 max-h-96 overflow-y-auto mb-4">
					{messages.length > 0 ? (
						messages
							.filter((msg) => !blockedUsers.has(msg.username || ""))
							.slice(-20)
							.map((msg, idx) => (
							<div key={idx} className="flex gap-2 p-2 bg-neutral-800/50 rounded text-sm group hover:bg-neutral-800/70">
								<span className="font-bold text-blue-400">{msg.username || "Anonymous"}:</span>
								<span className="text-white flex-1">{msg.message}</span>
								<button
									onClick={() => msg.messageId && deleteMessage(msg.messageId)}
									className="opacity-0 group-hover:opacity-100 text-yellow-400 hover:text-yellow-500 text-xs px-2 py-1 border border-yellow-500/50 rounded hover:bg-yellow-500/10 transition-all"
								>
									🗑️ Delete
								</button>
								<button
									onClick={() => banUser(msg.username || "")}
									className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 text-xs px-2 py-1 border border-red-500/50 rounded hover:bg-red-500/10 transition-all"
								>
									🚫 Ban
								</button>
							</div>
							))
					) : (
						<p className="text-gray-400 text-center py-4">No messages yet</p>
					)}
				</div>
				<div className="flex gap-2">
					<Button variant="secondary" size="sm" onClick={() => setMessages([])}>Clear Chat</Button>
					<div className="text-xs text-gray-400 flex items-center">
						<span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
						{messages.length} messages
					</div>
				</div>

				{/* Blocked Users */}
				{blockedUsers.size > 0 && (
					<div className="mt-4 pt-4 border-t border-neutral-700">
						<div className="text-sm font-semibold mb-2 text-red-400">🚫 Blocked Users</div>
						<div className="flex flex-wrap gap-2">
							{Array.from(blockedUsers).map((username) => (
								<div key={username} className="flex items-center gap-2 px-3 py-1 bg-red-900/20 border border-red-500/50 rounded">
									<span className="text-xs">{username}</span>
									<button
										onClick={() => unbanUser(username)}
										className="text-xs text-green-400 hover:text-green-300"
									>
										✓ Unban
									</button>
								</div>
							))}
						</div>
					</div>
				)}
			</div>
			
			{/* Lot Controls */}
			<div className="glass p-4 rounded-lg border border-blue-500/20">
				<h2 className="text-xl font-semibold mb-4">🎯 Lot Controls</h2>
				<div className="flex gap-2 flex-wrap">
					<Button 
						onClick={startLot} 
						disabled={starting || lot?.status === "LIVE" || lot?.status === "SETTLING"}
						className={starting || lot?.status === "LIVE" || lot?.status === "SETTLING" ? "opacity-50 cursor-not-allowed" : ""}
					>
						{starting ? "Starting..." : "Start Auction"}
					</Button>
					<Button 
						variant="secondary" 
						onClick={extendAuction}
						disabled={lot?.status !== "LIVE" || !lot?.auctionEndsAt}
						className={lot?.status !== "LIVE" || !lot?.auctionEndsAt ? "opacity-50 cursor-not-allowed" : ""}
					>
						Extend Auction (+60s)
					</Button>
					<Button 
						variant="secondary" 
						onClick={endLot} 
						disabled={ending || lot?.status !== "LIVE"}
						className={ending || lot?.status !== "LIVE" ? "opacity-50 cursor-not-allowed" : ""}
					>
						{ending ? "Ending..." : "End Auction"}
					</Button>
					<Button 
						variant="secondary" 
						onClick={mockWinnerPayment}
						disabled={lot?.status !== "SETTLING"}
						className={lot?.status !== "SETTLING" ? "opacity-50 cursor-not-allowed" : ""}
					>
						Confirm Winner Payment
					</Button>
				</div>
			</div>

			<div className="space-y-4">
				<h2 className="text-xl font-semibold">📹 Live Streaming</h2>
				<p className="text-sm text-neutral-400">Start your webcam or screen share below. Viewers on the show page will see your streams in real-time.</p>
				
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
					{/* Host Webcam */}
					<WebRTCPublisher 
						streamId="host_1" 
						streamType="webcam" 
						label="🎤 Host of the Night (Webcam)"
					/>

					{/* Artist Screen Shares */}
					<WebRTCPublisher 
						streamId="artist_1" 
						streamType="screen" 
						label="🎨 Artist 1 (Screen Share)"
					/>
					<WebRTCPublisher 
						streamId="artist_2" 
						streamType="screen" 
						label="🎨 Artist 2 (Screen Share)"
					/>
					<WebRTCPublisher 
						streamId="artist_3" 
						streamType="screen" 
						label="🎨 Artist 3 (Screen Share)"
					/>
					<WebRTCPublisher 
						streamId="artist_4" 
						streamType="screen" 
						label="🎨 Artist 4 (Screen Share)"
					/>
				</div>

				<div className="p-4 bg-blue-900/20 border border-blue-700 rounded text-sm text-blue-400">
					💡 <strong>Tip:</strong> You can run multiple streams at once! Open this page in different browser tabs to control each stream independently.
				</div>
			</div>

			<div className="space-y-2">
				<h2 className="text-xl font-semibold">💰 Settlement (Mock)</h2>
				<Button onClick={mockWinnerPayment}>Confirm Winner Payment</Button>
			</div>
		</main>
	);
}
