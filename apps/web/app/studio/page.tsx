"use client";

import { useState, useEffect } from "react";
import { Button } from "@live-art/ui";
import { WebRTCPublisher } from "../../components/WebRTCPublisher";
import io from "socket.io-client";

interface StreamLink {
	streamId: string;
	type: "artist" | "host";
	url: string;
	token: string;
}

function StreamingLinksGenerator() {
	const [links, setLinks] = useState<Map<string, StreamLink>>(new Map());
	const [generating, setGenerating] = useState<string | null>(null);

	const generateLink = async (streamId: string, type: "artist" | "host") => {
		setGenerating(streamId);
		try {
			const response = await fetch("/api/stream/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ streamId, type }),
			});

			if (!response.ok) {
				throw new Error("Failed to generate link");
			}

			const data = await response.json();
			setLinks(prev => new Map(prev.set(streamId, data)));
		} catch (error) {
			console.error("Error generating link:", error);
			alert("Failed to generate streaming link");
		} finally {
			setGenerating(null);
		}
	};

	const copyLink = (url: string) => {
		navigator.clipboard.writeText(url);
		alert("Link copied to clipboard!");
	};

	return (
		<div className="glass rounded-xl p-4 border border-purple-500/30 mb-4">
			<h3 className="text-lg font-semibold text-white mb-4">🔗 Generate Streaming Links</h3>
			
			<div className="space-y-3">
				{/* Host Link */}
				<div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
					<div className="flex-1">
						<span className="text-sm font-medium text-white">🎤 Host Stream</span>
						<p className="text-xs text-slate-400">host_1</p>
					</div>
					{links.has("host_1") ? (
						<div className="flex items-center gap-2 flex-1">
							<input
								type="text"
								value={links.get("host_1")!.url}
								readOnly
								className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono"
							/>
							<Button
								onClick={() => copyLink(links.get("host_1")!.url)}
								variant="secondary"
								className="text-xs px-3 py-2"
							>
								📋 Copy
							</Button>
							<Button
								onClick={() => generateLink("host_1", "host")}
								variant="secondary"
								className="text-xs px-3 py-2"
							>
								🔄 Regenerate
							</Button>
						</div>
					) : (
						<Button
							onClick={() => generateLink("host_1", "host")}
							disabled={generating === "host_1"}
							className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs px-4 py-2"
						>
							{generating === "host_1" ? "Generating..." : "Generate Link"}
						</Button>
					)}
				</div>

				{/* Artist Links */}
				{["artist_1", "artist_2", "artist_3", "artist_4"].map((streamId) => (
					<div key={streamId} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
						<div className="flex-1">
							<span className="text-sm font-medium text-white">🎨 {streamId.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
							<p className="text-xs text-slate-400">{streamId}</p>
						</div>
						{links.has(streamId) ? (
							<div className="flex items-center gap-2 flex-1">
								<input
									type="text"
									value={links.get(streamId)!.url}
									readOnly
									className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono"
								/>
								<Button
									onClick={() => copyLink(links.get(streamId)!.url)}
									variant="secondary"
									className="text-xs px-3 py-2"
								>
									📋 Copy
								</Button>
								<Button
									onClick={() => generateLink(streamId, "artist")}
									variant="secondary"
									className="text-xs px-3 py-2"
								>
									🔄 Regenerate
								</Button>
							</div>
						) : (
							<Button
								onClick={() => generateLink(streamId, "artist")}
								disabled={generating === streamId}
								className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white text-xs px-4 py-2"
							>
								{generating === streamId ? "Generating..." : "Generate Link"}
							</Button>
						)}
					</div>
				))}
			</div>
		</div>
	);
}

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
	const [votes, setVotes] = useState<Record<string, { count: number; voters: { userId: string; username: string; timestamp: number }[] }>>({});

	const lotId = "seed-lot-1";
	const totalVotes = Object.values(votes).reduce((acc, entry) => acc + (entry?.count ?? 0), 0);

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
		socketInstance.emit("join_lot", { lotId });
		socketInstance.emit("get_votes", { lotId });

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
			const deletedId = e.messageId ?? e.data?.messageId;
			if (deletedId === undefined || deletedId === null) return;
			const deletedIdStr = String(deletedId);
			setMessages((prev) => prev.filter(msg => {
				if (msg.messageId === undefined) return true;
				return String(msg.messageId) !== deletedIdStr;
			}));
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

		socketInstance.on("VOTE_CAST", (e: any) => {
			const { artistId, userId, username: voterName, voteCount } = e.data || {};
			if (!artistId) return;
			setVotes((prev) => ({
				...prev,
				[artistId]: {
					count: voteCount ?? (prev[artistId]?.count ?? 0) + 1,
					voters: [
						{ userId, username: voterName, timestamp: Date.now() },
						...(prev[artistId]?.voters ?? []),
					],
				},
			}));
		});

		socketInstance.on("votes_update", (e: any) => {
			const { artistId, count, votes: voteList } = e || {};
			if (!artistId) return;
			setVotes((prev) => ({
				...prev,
				[artistId]: {
					count: typeof count === "number" ? count : (Array.isArray(voteList) ? voteList.length : prev[artistId]?.count ?? 0),
					voters: Array.isArray(voteList) ? voteList : prev[artistId]?.voters ?? [],
				},
			}));
		});

		socketInstance.on("VOTES_CLEARED", () => {
			setVotes({});
		});

		return () => {
			// Remove all socket event listeners
			socketInstance.off("BID_PLACED");
			socketInstance.off("TIP_RECEIVED");
			socketInstance.off("CHAT_MESSAGE");
			socketInstance.off("user_banned");
			socketInstance.off("user_unbanned");
			socketInstance.off("message_deleted");
			socketInstance.off("VOTE_CAST");
			socketInstance.off("votes_update");
			socketInstance.off("VOTES_CLEARED");
			
			// Disconnect socket
			socketInstance.disconnect();
		};
	}, []);

	// Fetch initial lot and show data
	useEffect(() => {
		let interval: NodeJS.Timeout | null = null;
		let isMounted = true;
		
		const fetchData = async () => {
			if (!isMounted) return;
			
			try {
				const [lotRes, showRes] = await Promise.all([
					fetch("/api/lots/seed-lot-1"),
					fetch("/api/shows/seed-show-1"),
				]);
				
				if (lotRes.ok && isMounted) {
					const lotData = await lotRes.json();
					setLot(lotData);
					
					// Get current bids for this lot (using paginated API)
					const bidsRes = await fetch("/api/lots/seed-lot-1/bids?limit=50");
					if (bidsRes.ok && isMounted) {
						const data = await bidsRes.json();
						const bids = data.bids || data; // Support both old and new format
						setCurrentBids(bids);
						if (bids.length > 0 && isMounted) {
							// Sort bids by amount to get top bid
							const sortedBids = [...bids].sort((a: any, b: any) => b.amountUsd - a.amountUsd);
							setTopBid(sortedBids[0]);
						}
					}

					// Get chat messages for this lot (using paginated API)
					const messagesRes = await fetch("/api/lots/seed-lot-1/messages?limit=100");
					if (messagesRes.ok && isMounted) {
						const data = await messagesRes.json();
						const msgs = data.messages || data; // Support both old and new format
						setMessages(msgs);
					}
				}
				
				if (showRes.ok && isMounted) {
					const showData = await showRes.json();
					setShowStatus(showData);
				}
			} catch (error) {
				console.error("Error fetching data:", error);
			}
		};

		fetchData();
		interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
		
		return () => {
			isMounted = false;
			if (interval) {
				clearInterval(interval);
			}
		};
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

	function deleteMessage(messageId: string | number) {
		if (socket) {
			socket.emit("delete_message", { messageId, lotId });
		}
	}

	function clearVotes() {
		if (socket) {
			socket.emit("clear_votes", { lotId });
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
			<div className="glass p-4 rounded-lg border border-purple-500/30">
				<div className="flex items-center justify-between mb-4">
					<h2 className="text-xl font-semibold text-white flex items-center gap-2">
						<span className="text-2xl">🗳️</span> Live Voting
					</h2>
					<Button
						variant="secondary"
						size="sm"
						onClick={clearVotes}
						disabled={!socket || totalVotes === 0}
						className={!socket || totalVotes === 0 ? "opacity-50 cursor-not-allowed" : ""}
					>
						Clear Votes
					</Button>
				</div>
				<div className="grid gap-2">
					{["artist_1", "artist_2", "artist_3", "artist_4"].map((artistId) => {
						const artistNum = artistId.split("_")[1];
						const voteData = votes[artistId];
						const count = voteData?.count ?? 0;
						const topVoters = (voteData?.voters || []).slice(0, 3);

						return (
							<div key={artistId} className="flex items-center justify-between px-3 py-2 rounded-xl border border-purple-500/40 bg-purple-500/10">
								<div>
									<div className="text-sm font-semibold text-white">Artist {artistNum}</div>
									{topVoters.length > 0 && (
										<div className="text-xs text-purple-200">
											Recent votes: {topVoters.map(voter => voter.username || voter.userId.slice(0, 6)).join(", ")}
										</div>
									)}
								</div>
								<div className="flex items-center gap-2 text-white">
									<span className="text-lg">❤️</span>
									<span className="font-bold text-white">{count}</span>
								</div>
							</div>
						);
					})}
					{totalVotes === 0 && (
						<div className="text-sm text-purple-200 bg-purple-500/10 border border-purple-500/30 rounded-xl px-3 py-2">
							No votes yet. They will appear here once viewers start voting.
						</div>
					)}
				</div>
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
				<p className="text-sm text-neutral-400">Generate custom links to share with artists and host. Each link provides secure access to stream.</p>
				
				{/* Streaming Links Generator */}
				<StreamingLinksGenerator />

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
					💡 <strong>Tip:</strong> Share the generated links with artists and host. They can use these links to stream from their own devices.
				</div>
			</div>

			<div className="space-y-2">
				<h2 className="text-xl font-semibold">💰 Settlement (Mock)</h2>
				<Button onClick={mockWinnerPayment}>Confirm Winner Payment</Button>
			</div>
		</main>
	);
}
