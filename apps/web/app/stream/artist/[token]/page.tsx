"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { WebRTCPublisher } from "../../../../components/WebRTCPublisher";
import io from "socket.io-client";

export default function ArtistStreamPage() {
	const params = useParams();
	const router = useRouter();
	const token = params.token as string;
	const [streamId, setStreamId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [artistName, setArtistName] = useState<string>("");
	const [showNameInput, setShowNameInput] = useState(true);

	useEffect(() => {
		const fetchStreamInfo = async () => {
			try {
				console.log("[Artist Stream] Fetching token info for:", token);
				const response = await fetch(`/api/stream/token/${token}`);
				const responseData = await response.json();
				console.log("[Artist Stream] Response:", responseData);
				
				if (!response.ok) {
					// If token validation fails, try using token as direct streamId (development fallback)
					if (token.startsWith("artist_")) {
						console.log("[Artist Stream] Using token as direct streamId");
						setStreamId(token);
						setIsLoading(false);
						return;
					}
					throw new Error(responseData.error || "Invalid or expired streaming link");
				}
				
				if (responseData.type !== "artist") {
					throw new Error("This link is for host streaming, not artist");
				}
				setStreamId(responseData.streamId);
				
				// Load saved artist name from localStorage
				const savedName = localStorage.getItem(`artist_name_${responseData.streamId}`);
				if (savedName) {
					setArtistName(savedName);
					setShowNameInput(false);
				}
			} catch (err) {
				console.error("[Artist Stream] Error:", err);
				setError(err instanceof Error ? err.message : "Failed to load stream");
			} finally {
				setIsLoading(false);
			}
		};

		if (token) {
			fetchStreamInfo();
		}
	}, [token]);

	const [socket, setSocket] = useState<any>(null);

	// Initialize socket connection for sending artist name
	useEffect(() => {
		if (!streamId) return;
		
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		const socketInstance = io(wsUrl, {
			transports: ["polling", "websocket"],
			reconnection: true,
		});
		setSocket(socketInstance);

		return () => {
			socketInstance.disconnect();
		};
	}, [streamId]);

	const handleSetName = () => {
		if (artistName.trim() && streamId) {
			// Save to localStorage
			localStorage.setItem(`artist_name_${streamId}`, artistName.trim());
			
			// Send to server to broadcast to all viewers
			if (socket) {
				socket.emit("set_artist_name", { streamId, artistName: artistName.trim() });
			}
			
			setShowNameInput(false);
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
				<div className="text-center">
					<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
					<p className="text-white">Loading streaming setup...</p>
				</div>
			</div>
		);
	}

	if (error || !streamId) {
		return (
			<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
				<div className="glass rounded-2xl p-8 max-w-md w-full border border-red-500/30">
					<h1 className="text-2xl font-bold text-white mb-4">❌ Stream Error</h1>
					<p className="text-red-400 mb-6">{error || "Stream ID not found"}</p>
					<button
						onClick={() => router.push("/")}
						className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all"
					>
						Go Home
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
			<div className="max-w-4xl mx-auto">
				{/* Header */}
				<div className="mb-8 text-center">
					<h1 className="text-4xl font-bold text-white mb-2">
						🎨 Artist Studio
					</h1>
					<p className="text-slate-300">
						Share your screen to stream your art creation live
					</p>
					<p className="text-sm text-slate-500 mt-2">
						Stream ID: <span className="font-mono">{streamId}</span>
					</p>
				</div>

				{/* Artist Name Input */}
				{showNameInput && (
					<div className="mb-6 glass rounded-2xl p-6 border border-blue-500/30">
						<h3 className="text-lg font-semibold text-white mb-4">✨ Set Your Artist Name</h3>
						<p className="text-sm text-slate-300 mb-4">
							Choose a unique name that will be displayed to viewers instead of "{streamId?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}"
						</p>
						<div className="flex gap-3">
							<input
								type="text"
								value={artistName}
								onChange={(e) => setArtistName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleSetName();
									}
								}}
								placeholder="Enter your artist name..."
								className="flex-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-2 border-blue-500/30 focus:border-blue-500 rounded-xl px-4 py-3 text-black font-bold placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
								maxLength={30}
							/>
							<button
								onClick={handleSetName}
								disabled={!artistName.trim()}
								className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold px-6 py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
							>
								Set Name
							</button>
						</div>
					</div>
				)}

				{/* Show current name if set */}
				{!showNameInput && artistName && (
					<div className="mb-6 glass rounded-xl p-4 border border-green-500/30">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-slate-400">Your Artist Name:</p>
								<p className="text-lg font-bold text-white">{artistName}</p>
							</div>
							<button
								onClick={() => {
									setShowNameInput(true);
								}}
								className="text-sm text-blue-400 hover:text-blue-300 underline"
							>
								Change
							</button>
						</div>
					</div>
				)}

				{/* Streaming Component */}
				<div className="glass rounded-2xl p-6 border border-purple-500/30">
					<WebRTCPublisher
						streamId={streamId}
						streamType="screen"
						label={artistName ? `🎨 ${artistName}` : `🎨 ${streamId?.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase()) || "Artist"}`}
					/>
				</div>

				{/* Instructions */}
				<div className="mt-6 glass rounded-xl p-4 border border-blue-500/30">
					<h3 className="text-lg font-semibold text-white mb-2">📋 Instructions</h3>
					<ol className="list-decimal list-inside space-y-2 text-slate-300 text-sm">
						<li>Click "Start Screen Share" button above</li>
						<li>Select the screen or window you want to share</li>
						<li>Your screen will be streamed live to viewers</li>
						<li>Click "Stop Streaming" when you're done</li>
					</ol>
				</div>
			</div>
		</div>
	);
}

