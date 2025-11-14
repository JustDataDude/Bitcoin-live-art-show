"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@live-art/ui";
import { ErrorBoundary } from "../../../components/ErrorBoundary";
import { SocketConnectionManager, ConnectionState } from "../../../utils/socketConnection";
import { validateBid, validateTip, validateMessage, validateUsername, RateLimiter } from "../../../utils/validation";
import { showToast } from "../../../components/Toast";
import dynamic from "next/dynamic";

// Lazy load wallet components (heavy dependencies)
const WalletConnect = dynamic(() => import("../../../components/WalletConnect").then(mod => ({ default: mod.WalletConnect })), {
	ssr: false,
	loading: () => <div className="h-10 w-32 bg-slate-800 animate-pulse rounded"></div>,
});

const BitcoinWalletConnect = dynamic(() => import("../../../components/BitcoinWalletConnect").then(mod => ({ default: mod.BitcoinWalletConnect })), {
	ssr: false,
	loading: () => <div className="h-10 w-32 bg-slate-800 animate-pulse rounded"></div>,
});

// Lazy load Spotify player (external dependency)
const SpotifyPlayer = dynamic(() => import("../../../components/SpotifyPlayer").then(mod => ({ default: mod.SpotifyPlayer })), {
	ssr: false,
	loading: () => <div className="h-32 bg-slate-800 animate-pulse rounded"></div>,
});

// Lazy load WebRTC components to reduce initial bundle size
const WebRTCViewer = dynamic(() => import("../../../components/WebRTCViewer").then(mod => ({ default: mod.WebRTCViewer })), {
	ssr: false,
	loading: () => (
		<div className="aspect-video bg-neutral-900 rounded border border-neutral-800 overflow-hidden relative flex items-center justify-center">
			<span className="text-neutral-400">Loading stream...</span>
		</div>
	),
});

// Lazy load Bitcoin components
const BitcoinPaymentModal = dynamic(() => import("../../../components/BitcoinPaymentModal").then(mod => ({ default: mod.BitcoinPaymentModal })), {
	ssr: false,
});

const TransactionStatus = dynamic(() => import("../../../components/TransactionStatus").then(mod => ({ default: mod.TransactionStatus })), {
	ssr: false,
});
import Link from "next/link";
import { BitcoinNetwork, usdToSatoshis } from "../../../utils/bitcoin";
import { getBitcoinPrice } from "../../../utils/bitcoinTransactions";
import { Tooltip } from "../../../components/Tooltip";
import { formatRelativeTime } from "../../../utils/timeUtils";
import { copyToClipboard } from "../../../utils/clipboard";
import { Logo } from "../../../components/Logo";

// Lazy load modals (only shown when needed)
const ConfirmationModal = dynamic(() => import("../../../components/ConfirmationModal").then(mod => ({ default: mod.ConfirmationModal })), {
	ssr: false,
});

const KeyboardShortcuts = dynamic(() => import("../../../components/KeyboardShortcuts").then(mod => ({ default: mod.KeyboardShortcuts })), {
	ssr: false,
});

interface ChatMessage {
	id?: string | number;
	messageId?: string | number;
	userId: string;
	username: string;
	message: string;
	ts: number;
	type?: 'chat' | 'bid' | 'tip' | 'vote';
	amount?: number;
}

export default function ShowPage({ params }: { params: { id: string } }) {
	const { id } = params;
	const socketManagerRef = useRef<SocketConnectionManager | null>(null);
	const chatEndRef = useRef<HTMLDivElement | null>(null);
	const previousMessageCountRef = useRef<number>(0);
	const hasScrolledToBottomRef = useRef<boolean>(false);
	const [connectionState, setConnectionState] = useState<ConnectionState>({
		status: 'disconnected',
		reconnectAttempts: 0,
	});
	
	// Rate limiters
	const bidLimiter = useRef(new RateLimiter(5, 10000)); // 5 bids per 10 seconds
	const tipLimiter = useRef(new RateLimiter(10, 60000)); // 10 tips per minute
	const messageLimiter = useRef(new RateLimiter(20, 60000)); // 20 messages per minute
	const [bids, setBids] = useState<{ userId: string; username?: string; amountUsd: number; ts: number }[]>([]);
	const [tips, setTips] = useState<{ userId: string; username?: string; amountUsd: number; ts: number }[]>([]);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [votes, setVotes] = useState<Record<string, { count: number; voters: { userId: string; username: string; timestamp: number }[] }>>({});
	const [myVote, setMyVote] = useState<string | null>(null);
	const [isVoting, setIsVoting] = useState(false);
	const [myBid, setMyBid] = useState(0);
	const [myBidInput, setMyBidInput] = useState("0");
	const [status, setStatus] = useState<string>("PREP");
	const [isPaying, setIsPaying] = useState(false);
	const [chatMessage, setChatMessage] = useState("");
	const [tipMessage, setTipMessage] = useState("");
	const [selectedArtistForTip, setSelectedArtistForTip] = useState<string>("artist_1");
	const [username, setUsername] = useState<string>('');
	const [userHandle, setUserHandle] = useState<string>('');
	const [showUserSetup, setShowUserSetup] = useState(false);
	const [pendingUsername, setPendingUsername] = useState('');
	const [paymentMethod, setPaymentMethod] = useState<"USDC" | "BTC">("USDC");
	const [bidError, setBidError] = useState<string | null>(null);
	const [showBitcoinPayment, setShowBitcoinPayment] = useState(false);
	const [lastTransaction, setLastTransaction] = useState<{ txid: string; network: BitcoinNetwork; amountSatoshis: number } | null>(null);
	const [btcPrice, setBtcPrice] = useState<number>(65000);
	const [paymentAddress, setPaymentAddress] = useState<string>("");
	const [isPlacingBid, setIsPlacingBid] = useState(false);
	const [isSendingTip, setIsSendingTip] = useState(false);
	const [isSendingMessage, setIsSendingMessage] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [showConfirmPayment, setShowConfirmPayment] = useState(false);
	const [showConfirmBid, setShowConfirmBid] = useState(false);
	const [pendingBidAmount, setPendingBidAmount] = useState<number | null>(null);
	const [artistNames, setArtistNames] = useState<Record<string, string>>({});

	const lotId = "seed-lot-1";

	// Scroll to top on initial page load
	useEffect(() => {
		window.scrollTo(0, 0);
	}, []);

	useEffect(() => {
		const storedVote = localStorage.getItem('myVote');
		if (storedVote) {
			setMyVote(storedVote);
		}
	}, []);

	useEffect(() => {
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		
		console.log(`[Show Page] Connecting to WebSocket: ${wsUrl}`);
		const manager = new SocketConnectionManager(wsUrl);
		socketManagerRef.current = manager;
		
		// Subscribe to connection state changes
		const unsubscribe = manager.onStateChange((state) => {
			setConnectionState(state);
		});
		
		// Connect immediately (connection is async anyway)
		const socket = manager.connect();
		// Set up event listeners
		manager.emit("join_lot", { lotId });
		manager.emit("get_votes", { lotId });

		// Load persisted identity - prioritize logged-in username from UserLogin component
		const persistedHandle = localStorage.getItem('userHandle');
		const persistedName = localStorage.getItem('username');
		let handle = persistedHandle || `viewer_${Math.random().toString(36).slice(2, 8)}`;
		let name = persistedName || `Guest-${Math.floor(Math.random() * 1000)}`;
		setUserHandle(handle);
		setUsername(name);
		manager.emit('register_user', { userHandle: handle, username: name });
		
		// Listen for storage changes to update username when user logs in
		const handleStorageChange = (e: StorageEvent) => {
			if (e.key === 'username' && e.newValue) {
				console.log('[ShowPage] Username updated from localStorage:', e.newValue);
				setUsername(e.newValue);
				if (socketManagerRef.current) {
					const handle = localStorage.getItem('userHandle') || `viewer_${Math.random().toString(36).slice(2, 8)}`;
					setUserHandle(handle);
					socketManagerRef.current.emit('register_user', { userHandle: handle, username: e.newValue });
				}
			}
			if (e.key === 'userHandle' && e.newValue) {
				setUserHandle(e.newValue);
			}
		};
		
		window.addEventListener('storage', handleStorageChange);
		
		// Also check periodically for changes (in case storage event doesn't fire for same-window changes)
		// Use a ref to track the current username to avoid stale closures
		const usernameRef = { current: name };
		const handleRef = { current: handle };
		
		const checkInterval = setInterval(() => {
			const currentUsername = localStorage.getItem('username');
			const currentHandle = localStorage.getItem('userHandle');
			
			// Update refs
			usernameRef.current = currentUsername || usernameRef.current;
			handleRef.current = currentHandle || handleRef.current;
			
			// Check if username changed
			if (currentUsername && currentUsername !== usernameRef.current) {
				console.log('[ShowPage] Username changed, updating:', currentUsername);
				setUsername(currentUsername);
				usernameRef.current = currentUsername;
				if (socketManagerRef.current) {
					const newHandle = currentHandle || handleRef.current || `viewer_${Math.random().toString(36).slice(2, 8)}`;
					setUserHandle(newHandle);
					handleRef.current = newHandle;
					socketManagerRef.current.emit('register_user', { userHandle: newHandle, username: currentUsername });
				}
			}
			if (currentHandle && currentHandle !== handleRef.current) {
				setUserHandle(currentHandle);
				handleRef.current = currentHandle;
			}
		}, 500); // Check every 500ms for faster updates
		
		// Set up event listeners using manager
		manager.on("BID_PLACED", (e: any) => {
			console.log("[Bid] BID_PLACED event received:", e.data);
			// Reset placing bid state when we receive confirmation
			setIsPlacingBid(false);
			setBids((prev) => [{ userId: e.data.userId, username: e.data.username, amountUsd: e.data.amountUsd, ts: e.data.ts || Date.now() }, ...prev]);
			// Add bid to chat with duplicate detection
			const bidId = e.data.bidId;
			const bidMessage = `placed a bid of $${e.data.amountUsd}`;
			
			setMessages((prev) => {
				// Check for duplicates using bidId if available, or use a combination of userId, timestamp, and message
				if (bidId) {
					// Check if a message with this bidId already exists
					if (prev.some((msg) => msg.id === bidId || msg.messageId === bidId)) {
						return prev;
					}
				} else {
					// Fallback: check for duplicate based on userId, message content, and similar timestamp (within 5 seconds)
					const bidTimestamp = e.data.ts || (e.data.createdAt ? new Date(e.data.createdAt).getTime() : Date.now());
					const isDuplicate = prev.some((msg) => 
						msg.type === 'bid' &&
						msg.userId === e.data.userId &&
						msg.message === bidMessage &&
						Math.abs((msg.ts || 0) - bidTimestamp) < 5000
					);
					if (isDuplicate) {
						return prev;
					}
				}
				
				return [...prev, { 
					id: bidId,
					messageId: bidId,
					userId: e.data.userId, 
					username: e.data.username || e.data.userId.slice(0, 8), 
					message: bidMessage, 
					ts: e.data.ts || (e.data.createdAt ? new Date(e.data.createdAt).getTime() : Date.now()),
					type: 'bid',
					amount: e.data.amountUsd
				}];
			});
		});
		
		// Listen for artist name updates
		manager.on("artist_name_set", (e: any) => {
			console.log("[Show Page] Artist name set event received:", e);
			// The server emits the data directly, not wrapped in a data property
			const streamId = e?.streamId || e?.data?.streamId;
			const artistName = e?.artistName || e?.data?.artistName;
			if (streamId && artistName) {
				console.log(`[Show Page] Updating artist name: ${streamId} -> ${artistName}`);
				setArtistNames((prev) => ({
					...prev,
					[streamId]: artistName,
				}));
			}
		});

		// Handle errors from server
		manager.on("error", (e: any) => {
			console.error("[Socket] Server error:", e);
			showToast(e.message || "An error occurred", "error");
		});
		manager.on("TIP_RECEIVED", (e: any) => {
			setTips((prev) => [{ userId: e.data.userId, username: e.data.username, amountUsd: e.data.amountUsd, ts: e.data.ts || Date.now() }, ...prev]);
			// Add tip to chat with duplicate detection
			const tipId = e.data.tipId;
			const artistId = e.data.artistId || 'an artist';
			const artistNum = artistId.split('_')[1] || artistId.replace('artist_', '') || '';
			const tipMessage = e.data.message 
				? `${e.data.message} (to Artist ${artistNum})`
				: `sent a tip of $${e.data.amountUsd} to Artist ${artistNum}`;
			
			setMessages((prev) => {
				// Check for duplicates using tipId if available, or use a combination of userId, timestamp, and message
				if (tipId) {
					// Check if a message with this tipId already exists
					if (prev.some((msg) => msg.id === tipId || msg.messageId === tipId)) {
						return prev;
					}
				} else {
					// Fallback: check for duplicate based on userId, message content, and similar timestamp (within 5 seconds)
					const tipTimestamp = e.data.ts || e.data.createdAt ? new Date(e.data.createdAt || e.data.ts).getTime() : Date.now();
					const isDuplicate = prev.some((msg) => 
						msg.type === 'tip' &&
						msg.userId === e.data.userId &&
						msg.message === tipMessage &&
						Math.abs((msg.ts || 0) - tipTimestamp) < 5000
					);
					if (isDuplicate) {
						return prev;
					}
				}
				
				return [...prev, { 
					id: tipId,
					messageId: tipId,
					userId: e.data.userId, 
					username: e.data.username || e.data.userId.slice(0, 8), 
					message: tipMessage, 
					ts: e.data.ts || (e.data.createdAt ? new Date(e.data.createdAt).getTime() : Date.now()),
					type: 'tip',
					amount: e.data.amountUsd
				}];
			});
		});
		manager.on("CHAT_MESSAGE", (e: any) => {
			const messageId = e.data.messageId ?? e.data.id;
			setMessages((prev) => {
				if (messageId && prev.some((msg) => String(msg.messageId ?? msg.id) === String(messageId))) {
					return prev;
				}
				return [...prev, { 
					id: messageId,
					messageId,
					userId: e.data.userId, 
					username: e.data.username, 
					message: e.data.message, 
					ts: e.data.ts ? Number(e.data.ts) : Date.now(),
					type: (e.data.type as ChatMessage['type']) || 'chat'
				}];
			});
		});
		
		manager.on("message_deleted", (e: any) => {
			const deletedId = e.messageId ?? e.data?.messageId;
			if (deletedId === undefined || deletedId === null) return;
			const deletedIdStr = String(deletedId);
			setMessages((prev) => prev.filter(msg => {
				const msgId = msg.messageId ?? msg.id;
				if (msgId === undefined || msgId === null) return true;
				return String(msgId) !== deletedIdStr;
			}));
		});
		
		manager.on("user_banned", (e: any) => {
			setMessages((prev) => prev.filter(msg => msg.username !== e.username));
		});

		manager.on("VOTE_CAST", (e: any) => {
			const { artistId, username: voterName, userId, voteCount } = e.data;
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

			const artistNum = artistId?.split('_')[1] || artistId?.replace('artist_', '') || artistId || '';
			setMessages((prev) => [...prev, {
				userId,
				username: voterName || userId.slice(0, 8),
				message: `voted for Artist ${artistNum}`,
				ts: Date.now(),
				type: 'vote',
			}]);

			if (username && voterName === username) {
				setMyVote(artistId);
				localStorage.setItem('myVote', artistId);
			}
		});

		manager.on("votes_update", (e: any) => {
			const { artistId, count, votes: voteList } = e;
			if (!artistId) return;
			setVotes((prev) => ({
				...prev,
				[artistId]: {
					count: typeof count === "number" ? count : (Array.isArray(voteList) ? voteList.length : prev[artistId]?.count ?? 0),
					voters: Array.isArray(voteList) ? voteList : prev[artistId]?.voters ?? [],
				},
			}));
		});

		manager.on("VOTES_CLEARED", () => {
			setVotes({});
			setMyVote(null);
			localStorage.removeItem('myVote');
			showToast("All votes have been cleared", "info");
		});
		
		function onWalletConnected(e: any) {
			if (!socketManagerRef.current) return;
			const { chain, address } = e.detail || {};
			if (!chain || !address) return;
			socketManagerRef.current.emit('register_wallet', { chain, address, username });
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
			console.log("[Show Page] Cleaning up on unmount");
			
			// Disconnect socket manager immediately (this will clean up listeners)
			if (socketManagerRef.current) {
				socketManagerRef.current.disconnect();
				socketManagerRef.current = null;
			}
			
			// Clean up connection state subscription
			unsubscribe();
			
			// Remove all socket event listeners
			manager.off("BID_PLACED");
			manager.off("TIP_RECEIVED");
			manager.off("CHAT_MESSAGE");
			manager.off("error");
			manager.off("message_deleted");
			manager.off("user_banned");
			manager.off("VOTE_CAST");
			manager.off("votes_update");
			manager.off("VOTES_CLEARED");
			
			// Remove window event listeners
			window.removeEventListener('wallet:connected', onWalletConnected);
			window.removeEventListener('wallet:disconnected', onWalletDisconnected);
			window.removeEventListener('storage', handleStorageChange);
			clearInterval(checkInterval);
		};
	}, []);
	
	// Persist username/handle when updated and notify server
	useEffect(() => {
		if (!socketManagerRef.current) return;
		if (!userHandle || !username) return;
		localStorage.setItem('userHandle', userHandle);
		localStorage.setItem('username', username);
		socketManagerRef.current.emit('register_user', { userHandle, username });
		// Also re-register any connected wallets with new username
		const lastEvm = (window as any).__lastEvmAddress as string | undefined;
		const lastBtc = (window as any).__lastBtcAddress as string | undefined;
		if (lastEvm) socketManagerRef.current.emit('register_wallet', { chain: 'EVM', address: lastEvm, username });
		if (lastBtc) socketManagerRef.current.emit('register_wallet', { chain: 'BTC', address: lastBtc, username });
	}, [userHandle, username]);

	// Only scroll to bottom when new messages arrive after initial load
	useEffect(() => {
		// Don't scroll during initial history load
		if (isLoadingHistory) {
			return;
		}
		
		// Only scroll if new messages were added (not on initial render)
		const currentMessageCount = messages.length;
		if (currentMessageCount > previousMessageCountRef.current && hasScrolledToBottomRef.current) {
			chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
		}
		
		previousMessageCountRef.current = currentMessageCount;
	}, [messages, isLoadingHistory]);
	
	// Mark that we can start auto-scrolling after initial load completes
	useEffect(() => {
		if (!isLoadingHistory) {
			hasScrolledToBottomRef.current = true;
		}
	}, [isLoadingHistory]);

	useEffect(() => {
		let timer: NodeJS.Timeout | null = null;
		let isMounted = true;
		
		const poll = async () => {
			if (!isMounted) return;
			
			try {
				const res = await fetch(`/api/lots/seed-lot-1`);
				if (res.ok && isMounted) {
					const lot = await res.json();
					setStatus(lot.status);
				}
			} catch (error) {
				console.error("Error polling lot status:", error);
			}
			
			if (isMounted) {
				timer = setTimeout(poll, 2000);
			}
		};
		
		poll();
		
		return () => {
			isMounted = false;
			if (timer) {
				clearTimeout(timer);
			}
		};
	}, []);

	// Load Bitcoin price and payment address (defer to after initial render)
	useEffect(() => {
		// Defer Bitcoin price fetch to not block initial render
		const timeoutId = setTimeout(() => {
			const loadPrice = async () => {
				try {
					const price = await getBitcoinPrice();
					setBtcPrice(price);
				} catch (error) {
					console.error("Failed to load Bitcoin price:", error);
				}
			};
			loadPrice();
		}, 1000); // Wait 1 second after page load
		
		const interval = setInterval(async () => {
			try {
				const price = await getBitcoinPrice();
				setBtcPrice(price);
			} catch (error) {
				console.error("Failed to update Bitcoin price:", error);
			}
		}, 60000); // Update every minute
		
		// Load payment address
		const loadPaymentAddress = async () => {
			try {
				const res = await fetch(`/api/lots/seed-lot-1/payment-address`);
				if (res.ok) {
					const data = await res.json();
					setPaymentAddress(data.address);
				}
			} catch (error) {
				console.error("Error loading payment address:", error);
			}
		};
		loadPaymentAddress();
		
		return () => {
			clearInterval(interval);
			clearTimeout(timeoutId);
		};
	}, []);

	// Load historical data on mount with pagination support (deferred for faster initial load)
	useEffect(() => {
		let isMounted = true;
		
		// Defer loading history by 500ms to allow page to render first
		const loadTimer = setTimeout(() => {
			loadHistory();
		}, 500);
		
		async function loadHistory() {
			if (!isMounted) return;
			setIsLoadingHistory(true);
			try {
				// Load bids (using new paginated API) - limit to 20 for faster initial load
				const bidsRes = await fetch(`/api/lots/seed-lot-1/bids?limit=20`);
				if (bidsRes.ok && isMounted) {
					const data = await bidsRes.json();
					const historicalBids = data.bids || data; // Support both old and new format
					const formattedBids = historicalBids.map((b: any) => ({
						userId: b.userId,
						username: b.username,
						amountUsd: b.amountUsd,
						ts: new Date(b.createdAt).getTime(),
					}));
					if (isMounted) {
						setBids(formattedBids);
					}
				}

				// Load tips (using new paginated API) - limit to 20 for faster initial load
				const tipsRes = await fetch(`/api/lots/seed-lot-1/tips?limit=20`);
				if (tipsRes.ok && isMounted) {
					const data = await tipsRes.json();
					const historicalTips = data.tips || data; // Support both old and new format
					const formattedTips = historicalTips.map((t: any) => ({
						userId: t.userId,
						username: t.username || (t.user && t.user.username) || undefined,
						amountUsd: t.amountUsd,
						ts: new Date(t.createdAt).getTime(),
					}));
					if (isMounted) {
						setTips(formattedTips);
					}
				}

				// Load chat messages (using new paginated API) - limit to 50 for faster initial load
				const messagesRes = await fetch(`/api/lots/seed-lot-1/messages?limit=50`);
				if (messagesRes.ok && isMounted) {
					const data = await messagesRes.json();
					const historicalMessages = data.messages || data; // Support both old and new format
					const formattedMessages = historicalMessages.map((m: any) => ({
						id: m.id ?? m.messageId,
						messageId: m.id ?? m.messageId,
						userId: m.userId,
						username: m.username,
						message: m.message,
						ts: new Date(m.createdAt).getTime(),
						type: m.type,
					}));
					if (isMounted) {
						setMessages(formattedMessages);
					}
				}
			} catch (error) {
				console.error("Error loading history:", error);
				if (isMounted) {
					showToast("Failed to load history. Some data may be missing.", "warning");
				}
			} finally {
				if (isMounted) {
					setIsLoadingHistory(false);
				}
			}
		}

		// Defer history loading to not block initial render
		const historyTimeout = setTimeout(() => {
			loadHistory();
		}, 500); // Wait 500ms after page load
		
		return () => {
			isMounted = false;
			clearTimeout(historyTimeout);
		};
	}, []);

	const isBidValid = useMemo(() => {
		const n = myBid;
		if (isNaN(n)) return false;
		if (n < 1 || n > 10000) return false;
		return true;
	}, [myBid]);


	const placeBid = async (amount?: number) => {
		if (isPlacingBid) return; // Prevent double submission
		
		const bidAmount = amount || myBid;
		
		// Rate limiting
		if (!bidLimiter.current.canPerform('bid')) {
			const waitTime = Math.ceil(bidLimiter.current.getTimeUntilNext('bid') / 1000);
			showToast(`Please wait ${waitTime} seconds before placing another bid`, "warning");
			return;
		}
		
		// Validate bid
		const validation = validateBid(bidAmount);
		if (!validation.valid) {
			const errorMsg = validation.error || 'Invalid bid amount';
			setBidError(errorMsg);
			showToast(errorMsg, "error");
			return;
		}
		
		const validatedAmount = validation.amount!;
		
		// Show confirmation for bids over $100
		if (validatedAmount >= 100 && !amount) {
			setPendingBidAmount(validatedAmount);
			setShowConfirmBid(true);
			return;
		}
		
		executeBid(validatedAmount);
	};

	const executeBid = async (amount: number) => {
		if (!socketManagerRef.current) {
			showToast("Not connected to server. Please refresh the page.", "error");
			console.error("[Bid] Socket manager not available");
			return;
		}

		if (connectionState.status !== 'connected') {
			showToast("Not connected to server. Please wait for connection.", "error");
			console.error("[Bid] Not connected. Status:", connectionState.status);
			return;
		}

		setIsPlacingBid(true);
		setBidError(null);
		
		// Get the most current username from localStorage
		const currentUsername = localStorage.getItem('username') || username;
		console.log("[Bid] Placing bid:", { amount, lotId: "seed-lot-1", username: currentUsername, stateUsername: username });
		
		try {
			// Send bid with current username
			socketManagerRef.current.emit("place_bid", { 
				lotId: "seed-lot-1", 
				amountUsd: amount,
				username: currentUsername 
			});
			
			console.log("[Bid] Bid emitted successfully");
			
			// Update local state optimistically
			setMyBid(amount);
			setMyBidInput(amount.toString());
			
			// Show success message - the BID_PLACED event will confirm it
			showToast(`Bid of $${amount} placed!`, "success");
		} catch (error) {
			console.error("[Bid] Error placing bid:", error);
			const errorMsg = error instanceof Error ? error.message : "Failed to place bid. Please try again.";
			setBidError(errorMsg);
			showToast(errorMsg, "error");
			setIsPlacingBid(false);
		}
	};

	const voteForArtist = async (artistId: string) => {
		if (isVoting) return;
		if (!artistId) return;
		if (myVote === artistId) {
			showToast("You've already voted for this artist!", "info");
			return;
		}

		setIsVoting(true);
		try {
			socketManagerRef.current?.emit("vote_artist", { lotId, artistId, username });
			setMyVote(artistId);
			localStorage.setItem('myVote', artistId);
			const artistNum = artistId.split('_')[1] || artistId.replace('artist_', '');
			showToast(`Vote cast for Artist ${artistNum}`, "success");
		} catch (error) {
			showToast("Failed to cast vote. Please try again.", "error");
		} finally {
			setIsVoting(false);
		}
	};

	const sendTip = async () => {
		if (isSendingTip) return; // Prevent double submission
		
		// Rate limiting
		if (!tipLimiter.current.canPerform('tip')) {
			const waitTime = Math.ceil(tipLimiter.current.getTimeUntilNext('tip') / 1000);
			showToast(`Please wait ${waitTime} seconds before sending another tip`, "warning");
			return;
		}
		
		// Validate message
		const messageValidation = validateMessage(tipMessage);
		if (!messageValidation.valid) {
			showToast(messageValidation.error || 'Invalid tip message', "error");
			return;
		}
		
		// Validate tip amount (fixed at $1 for now)
		const tipValidation = validateTip(1);
		if (!tipValidation.valid) {
			showToast(tipValidation.error || 'Invalid tip amount', "error");
			return;
		}
		
		setIsSendingTip(true);
		
		try {
			// Get the most current username from localStorage
			const currentUsername = localStorage.getItem('username') || username;
			console.log("[Tip] Sending tip:", { username: currentUsername, stateUsername: username });
			socketManagerRef.current?.emit("send_tip", { 
				lotId: "seed-lot-1", 
				amountUsd: 1, 
				username: currentUsername,
				message: messageValidation.message,
				artistId: selectedArtistForTip
			});
			setTipMessage(""); // Clear the tip message after sending
			const artistNum = selectedArtistForTip.split('_')[1] || selectedArtistForTip.replace('artist_', '');
			showToast(`Tip of $1 sent to Artist ${artistNum}!`, "success");
		} catch (error) {
			showToast("Failed to send tip. Please try again.", "error");
		} finally {
			setIsSendingTip(false);
		}
	};

	const payNow = async () => {
		// Show confirmation modal
		setShowConfirmPayment(true);
	};

	const executePayment = async () => {
		if (paymentMethod === "BTC") {
			// Show Bitcoin payment modal
			const btcAddress = (window as any).__lastBtcAddress;
			if (!btcAddress) {
				showToast("Please connect your Bitcoin wallet first", "warning");
				return;
			}
			setShowBitcoinPayment(true);
			return;
		}

		// Handle USDC payment (existing flow)
		setIsPaying(true);
		try {
			const response = await fetch(`/api/payments/confirm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					lotId: "seed-lot-1", 
					payerId: "bidder_1", 
					amountUsd: myBid, 
					chain: "BASE_SEPOLIA"
				}),
			});
			
			if (response.ok) {
				const data = await response.json();
				showToast("✅ Payment confirmed! Transaction successful.", "success");
			} else {
				const errorData = await response.json().catch(() => ({}));
				showToast(errorData.error || "❌ Payment failed. Please try again.", "error");
			}
		} catch (error) {
			console.error("Payment error:", error);
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			showToast(`❌ Payment error: ${errorMsg}`, "error");
		} finally {
			setIsPaying(false);
		}
	};

	const handleBitcoinPaymentSuccess = async (txid: string) => {
		const btcAddress = (window as any).__lastBtcAddress;
		const btcNetwork = (window as any).__lastBtcNetwork || 'mainnet';
		const amountSatoshis = usdToSatoshis(myBid, btcPrice);
		
		// Store transaction info for status tracking
		setLastTransaction({ txid, network: btcNetwork as BitcoinNetwork, amountSatoshis });
		
		// Confirm payment on backend
		try {
			const response = await fetch(`/api/payments/confirm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ 
					lotId: "seed-lot-1", 
					payerId: btcAddress, 
					amountUsd: myBid, 
					chain: `BITCOIN_${btcNetwork.toUpperCase()}`,
					network: btcNetwork,
					txHash: txid
				}),
			});
			
			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				showToast(errorData.error || "Failed to confirm payment on backend", "error");
				console.error("Failed to confirm payment on backend");
			} else {
				showToast("✅ Bitcoin payment confirmed!", "success");
			}
		} catch (error) {
			console.error("Error confirming payment:", error);
			const errorMsg = error instanceof Error ? error.message : "Unknown error";
			showToast(`Failed to confirm payment: ${errorMsg}`, "error");
		}
	};

	const sendMessage = async () => {
		if (isSendingMessage) return; // Prevent double submission
		
		// Rate limiting
		if (!messageLimiter.current.canPerform('message')) {
			const waitTime = Math.ceil(messageLimiter.current.getTimeUntilNext('message') / 1000);
			showToast(`Please wait ${waitTime} seconds before sending another message`, "warning");
			return;
		}
		
		// Validate message
		const validation = validateMessage(chatMessage);
		if (!validation.valid) {
			showToast(validation.error || 'Invalid message', "error");
			return;
		}
		
		const msgText = validation.message!;
		const trimmedMsg = msgText.trim();
		if (!trimmedMsg) return;
		setChatMessage("");
		setIsSendingMessage(true);
		
		try {
			// Get the most current username from localStorage
			const currentUsername = localStorage.getItem('username') || username;
			console.log("[Chat] Sending message:", { message: trimmedMsg, username: currentUsername, stateUsername: username });
			// Send to server
			socketManagerRef.current?.emit("send_message", { lotId: "seed-lot-1", message: trimmedMsg, username: currentUsername });
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : "Failed to send message. Please try again.";
			showToast(errorMsg, "error");
		} finally {
			setIsSendingMessage(false);
		}
	};

	const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			if (!isSendingMessage && chatMessage.trim()) {
				sendMessage();
			}
		}
	};

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Don't trigger shortcuts when typing in inputs
			if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
				return;
			}

			// Ctrl/Cmd + B to focus bid input
			if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
				e.preventDefault();
				const bidInput = document.getElementById('bid-amount') as HTMLInputElement | null;
				bidInput?.focus();
				bidInput?.select();
			}

			// Ctrl/Cmd + T to focus tip input
			if ((e.ctrlKey || e.metaKey) && e.key === 't') {
				e.preventDefault();
				const tipInput = document.getElementById('tip-message');
				tipInput?.focus();
			}

			// Ctrl/Cmd + M to focus chat input
			if ((e.ctrlKey || e.metaKey) && e.key === 'm') {
				e.preventDefault();
				const chatInput = document.getElementById('chat-message');
				chatInput?.focus();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, []);

	// Show loading state while components are initializing
	const [isInitializing, setIsInitializing] = useState(true);
	
	useEffect(() => {
		// Mark as initialized after a brief delay to allow components to load
		const timer = setTimeout(() => setIsInitializing(false), 100);
		return () => clearTimeout(timer);
	}, []);

	if (isInitializing) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-500 mx-auto mb-4"></div>
					<p className="text-white text-lg">Loading live show...</p>
				</div>
			</div>
		);
	}

	return (
		<ErrorBoundary>
			<KeyboardShortcuts />
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
								// Validate username
								const usernameValidation = validateUsername(name);
								if (!usernameValidation.valid) {
									showToast(usernameValidation.error || 'Invalid username', "error");
									return;
								}
								
								const validatedName = usernameValidation.username || name;
								
								// Re-register with any connected wallets to bind username
								if (socketManagerRef.current) {
									const lastEvm = (window as any).__lastEvmAddress as string | undefined;
									const lastBtc = (window as any).__lastBtcAddress as string | undefined;
									if (lastEvm) socketManagerRef.current.emit('register_wallet', { chain: 'EVM', address: lastEvm, username: validatedName });
									if (lastBtc) socketManagerRef.current.emit('register_wallet', { chain: 'BTC', address: lastBtc, username: validatedName });
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
			<header className="md:col-span-3 space-y-3">
				{/* Logo */}
				<div className="flex justify-center pb-2">
					<div className="w-72 h-72">
						<img
							src="/logo.png"
							alt="1 of 1's Game Show Logo"
							className="object-contain w-full h-full bg-transparent"
						/>
					</div>
				</div>
				
				{/* Title Section */}
				<div className="text-center py-2">
					<h1 className="text-5xl font-bold gradient-text mb-2">1 of 1's Game Show</h1>
					<p className="text-slate-400 text-lg">Live Crypto Art Auction Experience</p>
				</div>

				{/* Navigation */}
				<nav className="flex justify-center gap-4 pb-1">
					<Link 
						href="/" 
						className="px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 transition-all"
					>
						🏠 Home
					</Link>
					<Link 
						href="/marketplace" 
						className="px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 transition-all"
					>
						🛒 Marketplace
					</Link>
				</nav>
				
				{/* Wallet Connection Section */}
				<div className="glass rounded-2xl p-6 glow-border mt-4">
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
				{/* Symmetrical Artist-Focused Layout */}
				<div className="relative">
					{/* Header with Artist Focus */}
					<div className="mb-6 text-center">
						<div className="inline-flex items-center gap-3 px-6 py-2 bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
							<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
							<div className="w-8 h-8 flex-shrink-0">
								<img
									src="/logo.png"
									alt="1 of 1's Game Show Logo"
									className="object-contain w-full h-full bg-transparent"
								/>
							</div>
							<h2 className="text-3xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
								LIVE ARTISTS
							</h2>
							<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
						</div>
					</div>

					{/* Perfectly Symmetrical 2x2 Artist Grid */}
					<div className="grid grid-cols-2 gap-4 mb-4">
						{["artist_1", "artist_2", "artist_3", "artist_4"].map((artistId) => {
							const artistNum = artistId.split("_")[1];
							const voteData = votes[artistId];
							const voteCount = voteData?.count ?? 0;
							const isMyVote = myVote === artistId;
							const customName = artistNames[artistId];
							const displayName = customName || `Artist ${artistNum}`;

							return (
								<div key={artistId} className="group relative">
									<div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
									<div
										role="button"
										onClick={() => voteForArtist(artistId)}
										className={`relative bg-black/40 rounded-2xl overflow-hidden border-2 aspect-video cursor-pointer transition-all ${
											isMyVote ? "border-green-400/80 shadow-[0_0_20px_rgba(74,222,128,0.45)]" : "border-purple-500/50 hover:border-purple-400/80"
										}`}
										aria-label={`Vote for ${displayName}`}
									>
										<div className="absolute inset-0 bg-gradient-to-br from-transparent via-purple-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

										<div className="absolute top-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-full border border-white/10">
											<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
											<span className="text-xs font-semibold text-white">{customName ? customName.toUpperCase() : `ARTIST ${artistNum}`}</span>
										</div>

										<div className="absolute top-3 right-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-purple-500/80 backdrop-blur-sm rounded-full border border-white/10">
											<span className="text-xs font-bold text-white">{isMyVote ? "✅ Voted" : "👆 Click to Vote"}</span>
										</div>

										<div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 px-3 py-1.5 bg-green-500/80 backdrop-blur-sm rounded-full border border-white/10">
											<span className="text-xs font-bold text-white">❤️ {voteCount} {voteCount === 1 ? "vote" : "votes"}</span>
										</div>

										<WebRTCViewer streamId={artistId as any} label={displayName} />
									</div>
								</div>
							);
						})}
					</div>

					{/* Host Stream - Centered Below Artists */}
					<div className="flex justify-center">
						<div className="w-full max-w-md group relative">
							<div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-300"></div>
							<div className="relative bg-black/30 rounded-xl overflow-hidden border border-purple-500/30 aspect-video">
								<div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
									<div className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse"></div>
									<span className="text-xs font-medium text-purple-300">{artistNames["host_1"] ? artistNames["host_1"].toUpperCase() : "HOST"}</span>
								</div>
								<WebRTCViewer streamId="host_1" label={artistNames["host_1"] || "Host"} />
							</div>
						</div>
					</div>
				</div>
				{/* Bidding & Tipping Section */}
				<div className="glass rounded-2xl p-6 space-y-4">
					<div className="flex items-center justify-between">
						<h3 className="text-xl font-bold text-white flex items-center gap-2">
							<span className="text-2xl">💰</span> Place Your Bid
						</h3>
						<Tooltip content="Enter any bid amount from $1 to $10,000" position="top">
							<button className="text-slate-400 hover:text-white transition-colors" aria-label="Help">
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</button>
						</Tooltip>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-3">
								<div className="relative">
									<span className="absolute left-4 top-1/2 -translate-y-1/2 text-black font-semibold pointer-events-none text-xl">$</span>
									<input
										id="bid-amount"
										name="bidAmount"
										type="number"
										min={1}
										max={10000}
										step="0.01"
										aria-label="Bid amount in USD"
										className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 focus:border-blue-500 rounded-xl pl-7 pr-4 py-3 w-32 text-black font-semibold text-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
										setBidError(null);
									} else {
										setBidError(null);
									}
										}}
									onBlur={() => {
										// Enforce min/max and sync display
										let num = parseFloat(myBidInput);
										if (isNaN(num) || num < 0) {
											num = 0;
										}
									num = Math.min(10000, Math.max(0, num));
									setMyBid(num);
									setMyBidInput(num.toString());
									setBidError(null);
									}}
										placeholder="0"
									/>
								</div>
								<Button onClick={() => placeBid()} disabled={!isBidValid || isPlacingBid} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
									{isPlacingBid ? "Placing..." : "Place Bid"}
								</Button>
							</div>
							{bidError && (
								<span className="text-xs text-yellow-400 ml-1">{bidError}</span>
							)}
							{/* Quick Bid Buttons */}
							<div className="flex gap-1 flex-wrap">
								{[
									{ label: "+$5", increment: 5 },
									{ label: "+$10", increment: 10 },
									{ label: "+$25", increment: 25 },
									{ label: "+$50", increment: 50 },
								].map((quick) => (
									<button
										key={quick.label}
										onClick={() => {
											// Add increment to current bid
											const newAmount = myBid + quick.increment;
											setMyBid(newAmount);
											setMyBidInput(newAmount.toString());
											setBidError(null);
										}}
										className="px-2 py-1 text-xs bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-blue-300 transition-colors"
										aria-label={`Quick bid ${quick.label}`}
									>
										{quick.label}
									</button>
								))}
							</div>
						</div>
						{/* Connection Status Indicator */}
						<div className="flex items-center gap-2">
							<div className={`w-2 h-2 rounded-full ${
								connectionState.status === 'connected' ? 'bg-green-400 animate-pulse' :
								connectionState.status === 'reconnecting' ? 'bg-yellow-400 animate-pulse' :
								'bg-red-400'
							}`}></div>
							<span className="text-xs text-slate-400">
								{connectionState.status === 'connected' ? 'Connected' :
								 connectionState.status === 'reconnecting' ? `Reconnecting... (${connectionState.reconnectAttempts})` :
								 'Disconnected'}
							</span>
						</div>
					</div>

					<div className="pt-4 border-t border-purple-500/20">
						<div className="flex items-center justify-between mb-3">
							<h3 className="text-lg font-semibold text-white flex items-center gap-2">
								<span className="text-xl">💵</span> Send a Tip
							</h3>
							<Tooltip content="Tips are $1 each and support the artists. Select an artist and add an optional message with your tip." position="top">
								<button className="text-slate-400 hover:text-white transition-colors" aria-label="Help">
									<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
									</svg>
								</button>
							</Tooltip>
						</div>
						<div className="space-y-3">
							{/* Artist Selection */}
							<div className="flex items-center gap-2">
								<span className="text-sm text-slate-300 font-medium">To Artist:</span>
								<div className="flex gap-2 flex-wrap">
									{['artist_1', 'artist_2', 'artist_3', 'artist_4'].map((artistId) => {
										const artistNum = artistId.split('_')[1];
										const isSelected = selectedArtistForTip === artistId;
										const customName = artistNames[artistId];
										const displayName = customName || `Artist ${artistNum}`;
										return (
											<button
												key={artistId}
												onClick={() => setSelectedArtistForTip(artistId)}
												className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
													isSelected
														? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white border-2 border-purple-400'
														: 'bg-purple-500/10 text-purple-300 border-2 border-purple-500/30 hover:bg-purple-500/20'
												}`}
												aria-label={`Select ${displayName}`}
											>
												{displayName}
											</button>
										);
									})}
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-3">
								<input
									id="tip-message"
									name="tipMessage"
									type="text"
									placeholder="Add a message with your tip..."
									aria-label="Tip message"
									className="flex-1 min-w-[200px] bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-3 text-black font-bold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
									value={tipMessage}
									onChange={(e) => setTipMessage(e.target.value)}
								/>
								<Button variant="secondary" onClick={sendTip} disabled={isSendingTip} className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
									{isSendingTip ? "Sending..." : "Send $1 Tip"}
								</Button>
							</div>
						</div>
					</div>
				</div>
				{/* Payment Section */}
				<div className="glass rounded-xl p-4 space-y-4">
					<div className="flex flex-wrap items-center gap-3">
						<div className="flex items-center gap-2">
							<span className="text-sm text-slate-300">Status:</span>
							<span className="text-sm font-semibold text-white">{status}</span>
							{status === "SETTLING" && (
								<Tooltip content="The auction has ended. You can now complete your payment." position="top">
									<span className="text-xs text-yellow-400">ℹ️</span>
								</Tooltip>
							)}
						</div>
						<select
							id="payment-method"
							name="paymentMethod"
							aria-label="Payment method"
							className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 rounded-lg px-3 py-2 text-sm text-black font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
							value={paymentMethod}
							onChange={(e) => setPaymentMethod(e.target.value as "USDC" | "BTC")}
						>
							<option value="USDC" className="bg-slate-900 text-black font-bold">Pay with USDC</option>
							<option value="BTC" className="bg-slate-900 text-black font-bold">Pay with BTC</option>
						</select>
						<Button onClick={payNow} disabled={isPaying || status !== "SETTLING"} className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed">
							{isPaying ? "Paying..." : `Pay with ${paymentMethod}`}
						</Button>
					</div>

					{/* Transaction Status */}
					{lastTransaction && (
						<TransactionStatus
							txid={lastTransaction.txid}
							network={lastTransaction.network}
							amountSatoshis={lastTransaction.amountSatoshis}
							onConfirmed={() => {
								alert("✅ Transaction confirmed! Payment complete.");
							}}
						/>
					)}
				</div>

				{/* Confirmation Modals */}
				<ConfirmationModal
					isOpen={showConfirmBid}
					onClose={() => {
						setShowConfirmBid(false);
						setPendingBidAmount(null);
					}}
					onConfirm={() => {
						if (pendingBidAmount) {
							executeBid(pendingBidAmount);
						}
						setShowConfirmBid(false);
						setPendingBidAmount(null);
					}}
					title="Confirm Your Bid"
					message={`Are you sure you want to place a bid of $${pendingBidAmount?.toFixed(2)}? This action cannot be undone.`}
					confirmText="Place Bid"
					cancelText="Cancel"
					confirmVariant="primary"
				/>

				<ConfirmationModal
					isOpen={showConfirmPayment}
					onClose={() => setShowConfirmPayment(false)}
					onConfirm={executePayment}
					title="Confirm Payment"
					message={`You are about to pay $${myBid.toFixed(2)} using ${paymentMethod}. Please confirm this transaction.`}
					confirmText="Confirm Payment"
					cancelText="Cancel"
					confirmVariant="primary"
				/>

				{/* Bitcoin Payment Modal */}
				{showBitcoinPayment && paymentAddress && (
					<BitcoinPaymentModal
						isOpen={showBitcoinPayment}
						onClose={() => setShowBitcoinPayment(false)}
						amountUsd={myBid}
						toAddress={paymentAddress}
						fromAddress={(window as any).__lastBtcAddress || ""}
						network={(window as any).__lastBtcNetwork || 'mainnet'}
						walletType={(window as any).__lastBtcWalletType || 'unisat'}
						onSuccess={handleBitcoinPaymentSuccess}
					/>
				)}
				
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
						{isLoadingHistory && messages.length === 0 && (
							<div className="flex items-center justify-center py-8">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
								<span className="ml-3 text-slate-400">Loading chat history...</span>
							</div>
						)}
						{messages.length === 0 && !isLoadingHistory && (
							<div className="text-center py-8 text-slate-400">
								<p className="text-lg mb-2">💬 No messages yet</p>
								<p className="text-sm">Be the first to chat!</p>
							</div>
						)}
						{messages.map((msg, i) => (
							<div key={i} className={`text-sm p-3 rounded-xl ${
								msg.type === 'bid'
									? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-l-4 border-yellow-500'
									: msg.type === 'tip'
										? 'bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-l-4 border-green-500'
										: msg.type === 'vote'
											? 'bg-gradient-to-r from-orange-500/20 to-amber-500/20 border-l-4 border-orange-400'
											: 'bg-blue-500/10 border-l-4 border-blue-500/50'
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
								{msg.type === 'vote' && (
									<div>
										<div className="flex items-center gap-2 mb-1">
											<span className="font-bold text-orange-300">{msg.username}</span>
											<span className="text-xs text-slate-500">{formatRelativeTime(msg.ts)}</span>
										</div>
										<span className="text-orange-100">{msg.message}</span>
									</div>
								)}
								{msg.type === 'chat' && (
									<div>
										<div className="flex items-center gap-2 mb-1">
											<span className="font-bold text-blue-300">{msg.username}</span>
											<span className="text-xs text-slate-500">{formatRelativeTime(msg.ts)}</span>
										</div>
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
							placeholder="Type a message... (Press Enter to send)"
							autoComplete="off"
							aria-label="Chat message"
							className="flex-1 bg-purple-500/10 border-2 border-purple-500/30 focus:border-purple-500 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
							value={chatMessage}
							onChange={(e) => setChatMessage(e.target.value)}
							onKeyDown={handleChatKeyDown}
						/>
						<Button onClick={sendMessage} disabled={isSendingMessage} className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
							{isSendingMessage ? "Sending..." : "Send"}
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
						{paymentAddress && (
							<div className="flex justify-between items-center p-3 bg-green-500/10 rounded-xl">
								<span className="text-slate-300 text-sm">Payment Address</span>
								<Tooltip content={`Click to copy: ${paymentAddress}`} position="left">
									<button
										onClick={async () => {
											const success = await copyToClipboard(paymentAddress);
											if (success) {
												showToast("Payment address copied!", "success");
											} else {
												showToast("Failed to copy address", "error");
											}
										}}
										className="text-xs text-green-400 hover:text-green-300 transition-colors font-mono"
										aria-label="Copy payment address"
									>
										{paymentAddress.slice(0, 6)}...{paymentAddress.slice(-4)}
									</button>
								</Tooltip>
							</div>
						)}
					</div>
				</div>

				{/* Recent Bids */}
				<div className="glass rounded-2xl p-6 border border-purple-500/20">
					<h2 className="font-bold text-white mb-4 flex items-center gap-2">
						<span className="text-xl">🗳️</span> Live Voting
					</h2>
					<div className="space-y-2">
						{["artist_1", "artist_2", "artist_3", "artist_4"].map((artistId) => {
							const artistNum = artistId.split("_")[1];
							const voteData = votes[artistId];
							const count = voteData?.count ?? 0;
							const isMyVote = myVote === artistId;

							return (
								<div
									key={artistId}
									className={`flex items-center justify-between px-3 py-2 rounded-xl border ${
										isMyVote ? "bg-purple-500/30 border-purple-400 text-white" : "bg-purple-500/10 border-purple-500/30 text-purple-200"
									}`}
								>
									<div className="flex items-center gap-3">
										<span className="text-lg font-semibold text-white">Artist {artistNum}</span>
										{isMyVote && <span className="text-xs bg-purple-500/70 px-2 py-0.5 rounded-full text-white">Your Vote</span>}
									</div>
									<div className="flex items-center gap-2 text-white">
										<span className="text-lg">❤️</span>
										<span className="font-bold text-white">{count}</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Recent Bids */}
				<div className="glass rounded-2xl p-6 border border-yellow-500/20">
					<h2 className="font-bold text-white mb-4 flex items-center gap-2">
						<span className="text-xl">💰</span> Recent Bids
					</h2>
						<ul className="space-y-2">
						{bids.slice(0, 5).map((b, i) => (
								<li key={i} className="p-3 bg-yellow-500/10 rounded-xl border-l-4 border-yellow-500 flex justify-between items-center group">
									<div className="flex flex-col">
										<span className="text-slate-300 text-sm">{b.username || `User ${b.userId.slice(0, 6)}`}</span>
										<span className="text-xs text-slate-500">{formatRelativeTime(b.ts)}</span>
									</div>
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
							<li key={i} className="p-3 bg-green-500/10 rounded-xl border-l-4 border-green-500 flex justify-between items-center group">
								<div className="flex flex-col">
									<span className="text-slate-300 text-sm">{t.username || `User ${t.userId.slice(0, 6)}`}</span>
									<span className="text-xs text-slate-500">{formatRelativeTime(t.ts)}</span>
								</div>
								<span className="font-bold text-green-400">${t.amountUsd}</span>
							</li>
						))}
						{tips.length === 0 && (
							<li className="text-slate-400 text-sm text-center py-4">
								<div className="flex flex-col items-center gap-2">
									<span>💵 No tips yet</span>
									<span className="text-xs">Support the artists!</span>
								</div>
							</li>
						)}
					</ul>
				</div>

				{/* Spotify Music Player */}
				<SpotifyPlayer defaultUri="playlist:37i9dQZF1DX4dyzvuaRJ0n" />
			</aside>
		</main>
		</ErrorBoundary>
	);
}
