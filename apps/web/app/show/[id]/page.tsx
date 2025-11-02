"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import { Button } from "@live-art/ui";
import { WalletConnect } from "../../../components/WalletConnect";
import { BitcoinWalletConnect } from "../../../components/BitcoinWalletConnect";
import { WebRTCViewer } from "../../../components/WebRTCViewer";
import { SpotifyPlayer } from "../../../components/SpotifyPlayer";
import { SwapWidget } from "../../../components/SwapWidget";

interface ChatMessage {
	messageId?: number;
	userId: string;
	username: string;
	message: string;
	ts: number;
	type?: 'chat' | 'bid' | 'tip';
	amount?: number;
}

export default function ShowPage({ params }: { params: { id: string } }) {
	const { id } = params;
	const socketRef = useRef<Socket | null>(null);
	const chatEndRef = useRef<HTMLDivElement | null>(null);
	const [connected, setConnected] = useState(false);
	const [bids, setBids] = useState<{ userId: string; username?: string; amountUsd: number; ts: number }[]>([]);
	const [tips, setTips] = useState<{ userId: string; amountUsd: number; ts: number }[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [myBid, setMyBid] = useState(5);
	const [myBidInput, setMyBidInput] = useState("5");
	const [status, setStatus] = useState<string>("PREP");
	const [isPaying, setIsPaying] = useState(false);
	const [chatMessage, setChatMessage] = useState("");
	const [tipMessage, setTipMessage] = useState("");
	const [username, setUsername] = useState<string>('');
	const [userHandle, setUserHandle] = useState<string>('');
	const [showUserSetup, setShowUserSetup] = useState(false);
	const [pendingUsername, setPendingUsername] = useState('');
	const [paymentMethod, setPaymentMethod] = useState<"USDC" | "BTC">("USDC");
	const [bidError, setBidError] = useState<string | null>(null);

	useEffect(() => {
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		
		console.log(`[Show Page] Connecting to WebSocket: ${wsUrl}`);
		const socket = io(wsUrl, {
			transports: ["polling", "websocket"],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});
		socketRef.current = socket;
		socket.on("connect", () => setConnected(true));
		socket.on("disconnect", () => setConnected(false));
		socket.emit("join_lot", { lotId: "seed-lot-1" });

		// Load persisted identity
		const persistedHandle = localStorage.getItem('userHandle');
		const persistedName = localStorage.getItem('username');
		let handle = persistedHandle || `viewer_${Math.random().toString(36).slice(2, 8)}`;
		let name = persistedName || `Guest-${Math.floor(Math.random() * 1000)}`;
		setUserHandle(handle);
		setUsername(name);
		socket.emit('register_user', { userHandle: handle, username: name });
		socket.on("BID_PLACED", (e: any) => {
			setBids((prev) => [{ userId: e.data.userId, username: e.data.username, amountUsd: e.data.amountUsd, ts: Date.now() }, ...prev]);
			// Add bid to chat
			setMessages((prev) => [...prev, { 
				userId: e.data.userId, 
				username: e.data.username || e.data.userId.slice(0, 8), 
				message: `placed a bid of $${e.data.amountUsd}`, 
				ts: Date.now(),
				type: 'bid',
				amount: e.data.amountUsd
			}]);
		});
		socket.on("TIP_RECEIVED", (e: any) => {
			setTips((prev) => [{ userId: e.data.userId, amountUsd: e.data.amountUsd, ts: Date.now() }, ...prev]);
			// Add tip to chat
			setMessages((prev) => [...prev, { 
				userId: e.data.userId, 
				username: e.data.username || e.data.userId.slice(0, 8), 
				message: e.data.message || `sent a tip of $${e.data.amountUsd}`, 
				ts: Date.now(),
				type: 'tip',
				amount: e.data.amountUsd
			}]);
		});
		socket.on("CHAT_MESSAGE", (e: any) => {
			setMessages((prev) => [...prev, { 
				messageId: e.data.messageId,
				userId: e.data.userId, 
				username: e.data.username, 
				message: e.data.message, 
				ts: Date.now(),
				type: 'chat'
			}]);
		});
		
		socket.on("message_deleted", (e: any) => {
			setMessages((prev) => prev.filter(msg => msg.messageId !== e.messageId));
		});
		
		socket.on("user_banned", (e: any) => {
			setMessages((prev) => prev.filter(msg => msg.username !== e.username));
		});
		function onWalletConnected(e: any) {
			if (!socketRef.current) return;
			const { chain, address } = e.detail || {};
			if (!chain || !address) return;
			socketRef.current.emit('register_wallet', { chain, address, username });
			// If no username set yet, prompt user to create one and prefill from address
			const persistedName = localStorage.getItem('username');
			if (!persistedName) {
				const short = `${address.slice(0, 4)}...${address.slice(-4)}`;
				const suggested = `Collector-${short}`;
				setPendingUsername(suggested);
				setShowUserSetup(true);
			}
		}
		function onWalletDisconnected(_e: any) {
			// no-op for now
		}
		window.addEventListener('wallet:connected', onWalletConnected);
		window.addEventListener('wallet:disconnected', onWalletDisconnected);

		return () => {
			socket.disconnect();
			window.removeEventListener('wallet:connected', onWalletConnected);
			window.removeEventListener('wallet:disconnected', onWalletDisconnected);
		};
	}, []);
	// Persist username/handle when updated and notify server
	useEffect(() => {
		if (!socketRef.current) return;
		if (!userHandle || !username) return;
		localStorage.setItem('userHandle', userHandle);
		localStorage.setItem('username', username);
		socketRef.current.emit('register_user', { userHandle, username });
		// Also re-register any connected wallets with new username
		const lastEvm = (window as any).__lastEvmAddress as string | undefined;
		const lastBtc = (window as any).__lastBtcAddress as string | undefined;
		if (lastEvm) socketRef.current.emit('register_wallet', { chain: 'EVM', address: lastEvm, username });
		if (lastBtc) socketRef.current.emit('register_wallet', { chain: 'BTC', address: lastBtc, username });
	}, [userHandle, username]);

	useEffect(() => {
		chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages]);

	useEffect(() => {
		let timer: any;
		const poll = async () => {
			const res = await fetch(`/api/lots/seed-lot-1`);
			if (res.ok) {
				const lot = await res.json();
				setStatus(lot.status);
			}
			timer = setTimeout(poll, 2000);
		};
		poll();
		return () => clearTimeout(timer);
	}, []);

	// Load historical data on mount
	useEffect(() => {
		async function loadHistory() {
			try {
				// Load bids
				const bidsRes = await fetch(`/api/lots/seed-lot-1/bids`);
				if (bidsRes.ok) {
					const historicalBids = await bidsRes.json();
					const formattedBids = historicalBids.map((b: any) => ({
						userId: b.userId,
						username: b.username,
						amountUsd: b.amountUsd,
						ts: new Date(b.createdAt).getTime(),
					}));
					setBids(formattedBids);
				}

				// Load tips
				const tipsRes = await fetch(`/api/lots/seed-lot-1/tips`);
				if (tipsRes.ok) {
					const historicalTips = await tipsRes.json();
					const formattedTips = historicalTips.map((t: any) => ({
						userId: t.userId,
						amountUsd: t.amountUsd,
						ts: new Date(t.createdAt).getTime(),
					}));
					setTips(formattedTips);
				}

				// Load chat messages
				const messagesRes = await fetch(`/api/lots/seed-lot-1/messages`);
				if (messagesRes.ok) {
					const historicalMessages = await messagesRes.json();
					const formattedMessages = historicalMessages.map((m: any) => ({
						userId: m.userId,
						username: m.username,
						message: m.message,
						ts: new Date(m.createdAt).getTime(),
						type: m.type,
					}));
					setMessages(formattedMessages);
				}
			} catch (error) {
				console.error("Error loading history:", error);
			}
		}

		loadHistory();
	}, []);

	const requiredMinBid = useMemo(() => {
		const top = bids.length ? Math.max(...bids.map((b) => b.amountUsd)) : 0;
		const inc = Math.max(1, Math.floor(top * 0.05));
		return top + inc;
	}, [bids]);

	const isBidValid = useMemo(() => {
		const n = myBid;
		if (isNaN(n)) return false;
		if (n < 1 || n > 10000) return false;
		if (n < requiredMinBid) return false;
		return true;
	}, [myBid, requiredMinBid]);


	const placeBid = () => {
		// Ensure we send a clamped numeric value and respect required minimum
		let amount = Math.min(10000, Math.max(1, myBid));
		if (amount < requiredMinBid) {
			amount = requiredMinBid;
		}
		socketRef.current?.emit("place_bid", { 
			lotId: "seed-lot-1", 
			amountUsd: amount,
			username: username 
		});
		setMyBid(amount);
		setMyBidInput(amount.toString());
	};

	const sendTip = () => {
		if (!tipMessage.trim()) {
			alert("Please enter a message with your tip!");
			return;
		}
		socketRef.current?.emit("send_tip", { 
			lotId: "seed-lot-1", 
			amountUsd: 1, 
			username: username,
			message: tipMessage 
		});
		setTipMessage(""); // Clear the tip message after sending
	};

	const payNow = async () => {
		setIsPaying(true);
		await fetch(`/api/payments/confirm`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ lotId: "seed-lot-1", payerId: "bidder_1", amountUsd: myBid, chain: "BASE_SEPOLIA" }),
		});
		setIsPaying(false);
	};

	const sendMessage = () => {
		if (!chatMessage.trim()) return;
		const msgText = chatMessage.trim();
		setChatMessage("");
		
		// Optimistic update - show message immediately
		const tempMessage = {
			userId: socketRef.current?.id || 'temp',
			username: username || 'You',
			message: msgText,
			ts: Date.now(),
			type: 'chat' as const
		};
		setMessages((prev) => [...prev, tempMessage]);
		
		// Send to server
		socketRef.current?.emit("send_message", { lotId: "seed-lot-1", message: msgText, username });
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	return (
		<main className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 max-w-7xl mx-auto">
			{/* User Setup Modal */}
			{showUserSetup && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
					<div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
						<h3 className="text-xl font-bold mb-2">Create your display name</h3>
						<p className="text-sm text-slate-600 mb-4">This name will appear on your bids, tips, and chat. You can change it later.</p>
						<input
							value={pendingUsername}
							onChange={(e) => setPendingUsername(e.target.value)}
							className="w-full border rounded-lg px-3 py-2 mb-4"
							placeholder="Enter a username"
						/>
						<div className="flex justify-end gap-2">
							<button
								onClick={() => setShowUserSetup(false)}
								className="px-4 py-2 rounded-lg border"
							>
								Cancel
							</button>
							<button
								onClick={() => {
								const name = pendingUsername.trim() || `Guest-${Math.floor(Math.random() * 1000)}`;
								setUsername(name);
								localStorage.setItem('username', name);
								// Re-register with any connected wallets to bind username
								if (socketRef.current) {
									const lastEvm = (window as any).__lastEvmAddress as string | undefined;
									const lastBtc = (window as any).__lastBtcAddress as string | undefined;
									if (lastEvm) socketRef.current.emit('register_wallet', { chain: 'EVM', address: lastEvm, username: name });
									if (lastBtc) socketRef.current.emit('register_wallet', { chain: 'BTC', address: lastBtc, username: name });
								}
								setShowUserSetup(false);
							}}
							className="px-4 py-2 rounded-lg bg-blue-600 text-white"
							>
								Save
							</button>
						</div>
					</div>
				</div>
			)}
			<header className="md:col-span-3 space-y-4">
				{/* Title Section */}
				<div className="text-center py-8">
					<h1 className="text-5xl font-bold gradient-text mb-2">1 of 1's Game Show</h1>
					<p className="text-slate-400 text-lg">Live Crypto Art Auction Experience</p>
				</div>
				
				{/* Wallet Connection Section */}
				<div className="glass rounded-2xl p-6 glow-border">
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
			</header>
			<section className="md:col-span-2 space-y-6">
				{/* Main Host Stream - Webcam */}
				<div className="w-full">
					<div className="mb-3 text-center">
						<h2 className="text-2xl font-bold text-white inline-flex items-center gap-2">
							<span className="text-3xl">🎤</span> 
							<span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
								Host of the Night
							</span>
						</h2>
					</div>
					<div className="rounded-2xl overflow-hidden glow-border ring-2 ring-purple-500/50">
						<WebRTCViewer streamId="host_1" label="Host Stream" />
					</div>
				</div>
				
				{/* Multi-stream video grid - Screen Shares */}
				<div className="w-full">
					<div className="mb-3 text-center">
						<h2 className="text-2xl font-bold text-white inline-flex items-center gap-2">
							<span className="text-3xl">🎨</span> 
							<span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
								Artist Streams
							</span>
						</h2>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="rounded-xl overflow-hidden ring-2 ring-blue-500/30 hover:ring-blue-500/60 transition-all">
							<WebRTCViewer streamId="artist_1" label="Stream 1" />
						</div>
						<div className="rounded-xl overflow-hidden ring-2 ring-blue-500/30 hover:ring-blue-500/60 transition-all">
							<WebRTCViewer streamId="artist_2" label="Stream 2" />
						</div>
						<div className="rounded-xl overflow-hidden ring-2 ring-blue-500/30 hover:ring-blue-500/60 transition-all">
							<WebRTCViewer streamId="artist_3" label="Stream 3" />
						</div>
						<div className="rounded-xl overflow-hidden ring-2 ring-blue-500/30 hover:ring-blue-500/60 transition-all">
							<WebRTCViewer streamId="artist_4" label="Stream 4" />
						</div>
					</div>
				</div>
				{/* Bidding & Tipping Section */}
				<div className="glass rounded-2xl p-6 space-y-4">
					<h3 className="text-xl font-bold text-white flex items-center gap-2">
						<span className="text-2xl">💰</span> Place Your Bid
					</h3>
					<div className="flex flex-wrap items-center gap-3">
						<input
							id="bid-amount"
							name="bidAmount"
							type="number"
							min={1}
							max={10000}
							step="0.01"
							className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 focus:border-blue-500 rounded-xl px-4 py-3 w-32 text-white font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
							onFocus={(e) => e.currentTarget.select()}
							value={myBidInput}
							onChange={(e) => {
								const val = e.target.value;
								// Allow empty string while typing
								setMyBidInput(val);
								// Update numeric bid if valid number
								const num = parseFloat(val);
								if (!isNaN(num)) {
									setMyBid(num);
									setBidError(num < requiredMinBid ? `Minimum required is $${requiredMinBid}` : null);
								} else {
									setBidError(null);
								}
							}}
							onBlur={() => {
								// Enforce min/max and sync display
								let num = parseFloat(myBidInput);
								if (isNaN(num)) {
									num = 1;
								}
								num = Math.min(10000, Math.max(1, num));
								setMyBid(num);
								setMyBidInput(num.toString());
								setBidError(num < requiredMinBid ? `Minimum required is $${requiredMinBid}` : null);
							}}
							placeholder="$0"
						/>
						{bidError && (
							<span className="text-xs text-yellow-400 ml-1">{bidError}</span>
						)}
						<Button onClick={placeBid} disabled={!isBidValid} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
							Place Bid
						</Button>
						<div className="flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
							<span className="text-xs text-slate-400">{connected ? "Connected" : "Disconnected"}</span>
						</div>
					</div>

					<div className="pt-4 border-t border-purple-500/20">
						<h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
							<span className="text-xl">💵</span> Send a Tip
						</h3>
						<div className="flex flex-wrap items-center gap-3">
							<input
								id="tip-message"
								name="tipMessage"
								type="text"
								placeholder="Add a message with your tip..."
								className="flex-1 min-w-[200px] bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
								value={tipMessage}
								onChange={(e) => setTipMessage(e.target.value)}
							/>
							<Button variant="secondary" onClick={sendTip} className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold px-6 py-3 rounded-xl transition-all">
								Send $1 Tip
							</Button>
						</div>
					</div>
				</div>
				{/* Payment Section */}
				<div className="glass rounded-xl p-4 flex flex-wrap items-center gap-3">
					<span className="text-sm text-slate-300">Status: <span className="font-semibold text-white">{status}</span></span>
					<select
						id="payment-method"
						name="paymentMethod"
						className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
						value={paymentMethod}
						onChange={(e) => setPaymentMethod(e.target.value as "USDC" | "BTC")}
					>
						<option value="USDC" className="bg-slate-900">Pay with USDC</option>
						<option value="BTC" className="bg-slate-900">Pay with BTC</option>
					</select>
					<Button onClick={payNow} disabled={isPaying || status !== "SETTLING"} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
						{isPaying ? "Paying..." : `Pay with ${paymentMethod}`}
					</Button>
				</div>
				
				{/* Chat Section */}
				<div className="glass rounded-2xl overflow-hidden flex flex-col h-96 border border-purple-500/20">
					<div className="border-b border-purple-500/20 px-4 py-3 bg-gradient-to-r from-blue-500/10 to-purple-500/10 flex items-center justify-between">
						<h3 className="font-semibold text-white flex items-center gap-2">
							<span className="text-lg">💬</span> Live Chat
						</h3>
						<input
							id="chat-username"
							name="username"
							type="text"
							placeholder="Your name"
							autoComplete="username"
							className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-400 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
						/>
					</div>
					<div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/20">
						{messages.map((msg, i) => (
							<div key={i} className={`text-sm p-3 rounded-xl ${
								msg.type === 'bid' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-l-4 border-yellow-500' :
								msg.type === 'tip' ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-l-4 border-green-500' :
								'bg-blue-500/10 border-l-4 border-blue-500/50'
							}`}>
								{msg.type === 'bid' && (
									<div className="flex items-center gap-2">
										<span className="text-yellow-400 text-lg">💰</span>
										<span className="font-bold text-yellow-300">{msg.username}</span>
										<span className="text-white">{msg.message}</span>
									</div>
								)}
								{msg.type === 'tip' && (
									<div className="flex flex-col gap-1">
										<div className="flex items-center gap-2">
											<span className="text-green-400 text-lg">💵</span>
											<span className="font-bold text-green-300">{msg.username}</span>
											<span className="text-emerald-400 text-xs font-semibold">tipped ${msg.amount}</span>
										</div>
										{msg.message && <span className="text-white ml-7 italic">"{msg.message}"</span>}
									</div>
								)}
								{msg.type === 'chat' && (
									<div>
										<span className="font-bold text-blue-300">{msg.username}:</span>{" "}
										<span className="text-slate-200">{msg.message}</span>
									</div>
								)}
							</div>
						))}
						<div ref={chatEndRef} />
					</div>
					<div className="border-t border-purple-500/20 p-3 bg-black/20 flex gap-2">
						<input
							id="chat-message"
							name="message"
							type="text"
							placeholder="Type a message..."
							autoComplete="off"
							className="flex-1 bg-purple-500/10 border-2 border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
							value={chatMessage}
							onChange={(e) => setChatMessage(e.target.value)}
							onKeyPress={handleKeyPress}
						/>
						<Button onClick={sendMessage} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-5 py-2 rounded-xl transition-all">
							Send
						</Button>
					</div>
				</div>
			</section>
			<aside className="space-y-6">
				{/* Lot Info Card */}
				<div className="glass rounded-2xl p-6 glow-border">
					<h2 className="text-2xl font-bold gradient-text mb-4">Current Lot</h2>
					<div className="space-y-3">
						<div className="flex justify-between items-center p-3 bg-blue-500/10 rounded-xl">
							<span className="text-slate-300 text-sm">Status</span>
							<span className="font-bold text-white">{status}</span>
						</div>
						<div className="flex justify-between items-center p-3 bg-purple-500/10 rounded-xl">
							<span className="text-slate-300 text-sm">Top Bid</span>
							<span className="font-bold text-2xl text-purple-400">
								${bids[0]?.amountUsd || 0}
							</span>
						</div>
						<div className="flex justify-between items-center p-3 bg-pink-500/10 rounded-xl">
							<span className="text-slate-300 text-sm">Total Tips</span>
							<span className="font-bold text-xl text-pink-400">
								${tips.reduce((sum, t) => sum + t.amountUsd, 0)}
							</span>
						</div>
					</div>
				</div>

				{/* Recent Bids */}
				<div className="glass rounded-2xl p-6 border border-yellow-500/20">
					<h2 className="font-bold text-white mb-4 flex items-center gap-2">
						<span className="text-xl">💰</span> Recent Bids
					</h2>
						<ul className="space-y-2">
						{bids.slice(0, 5).map((b, i) => (
								<li key={i} className="p-3 bg-yellow-500/10 rounded-xl border-l-4 border-yellow-500 flex justify-between items-center">
									<span className="text-slate-300 text-sm">{b.username || `User ${b.userId.slice(0, 6)}`}</span>
									<span className="font-bold text-yellow-400">${b.amountUsd}</span>
								</li>
						))}
						{bids.length === 0 && (
							<li className="text-slate-400 text-sm text-center py-4">No bids yet</li>
						)}
					</ul>
				</div>

				{/* Recent Tips */}
				<div className="glass rounded-2xl p-6 border border-green-500/20">
					<h2 className="font-bold text-white mb-4 flex items-center gap-2">
						<span className="text-xl">💵</span> Recent Tips
					</h2>
					<ul className="space-y-2">
						{tips.slice(0, 5).map((t, i) => (
							<li key={i} className="p-3 bg-green-500/10 rounded-xl border-l-4 border-green-500 flex justify-between items-center">
								<span className="text-slate-300 text-sm">User {t.userId.slice(0, 6)}</span>
								<span className="font-bold text-green-400">${t.amountUsd}</span>
							</li>
						))}
						{tips.length === 0 && (
							<li className="text-slate-400 text-sm text-center py-4">No tips yet</li>
						)}
					</ul>
				</div>

				{/* Spotify Music Player */}
				<SpotifyPlayer defaultUri="playlist:37i9dQZF1DX4dyzvuaRJ0n" />

				{/* Swap Widget */}
				<SwapWidget />
			</aside>
		</main>
	);
}
