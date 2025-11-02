"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@live-art/ui";
import { io, Socket } from "socket.io-client";

interface WebRTCPublisherProps {
	streamId: string;
	streamType: "webcam" | "screen";
	label: string;
}

export function WebRTCPublisher({ streamId, streamType, label }: WebRTCPublisherProps) {
	const [isStreaming, setIsStreaming] = useState(false);
	const [viewerCount, setViewerCount] = useState(0);
	const [error, setError] = useState<string | null>(null);

	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const socketRef = useRef<Socket | null>(null);
	const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

	useEffect(() => {
		// Connect to signaling server
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		
		console.log(`[WebRTC Publisher ${streamId}] Connecting to: ${wsUrl}`);
		const socket = io(wsUrl, {
			transports: ["polling", "websocket"],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});
		socketRef.current = socket;

		socket.on("connect", () => {
			console.log(`[WebRTC Publisher ${streamId}] Connected to signaling server`);
		});

		socket.on("connect_error", (error) => {
			console.error(`[WebRTC Publisher ${streamId}] Connection error:`, error);
			setError(`Failed to connect to WebSocket server: ${error.message}`);
		});

		socket.on("disconnect", (reason) => {
			console.warn(`[WebRTC Publisher ${streamId}] Disconnected:`, reason);
		});

		socket.on("viewer-joined", async ({ viewerId }) => {
			console.log(`[WebRTC Publisher ${streamId}] Viewer joined: ${viewerId}`);
			
			// Check if peer connection already exists and is valid
			const existingPeer = peersRef.current.get(viewerId);
			if (existingPeer) {
				const state = existingPeer.signalingState;
				const connectionState = existingPeer.connectionState;
				
				// If peer is already connected or connecting, don't create a new one
				if (state !== "closed" && connectionState !== "closed" && connectionState !== "failed") {
					console.log(`[WebRTC Publisher ${streamId}] Peer connection already exists for ${viewerId} (state: ${state}, conn: ${connectionState}), skipping`);
					return;
				} else {
					// Clean up invalid peer connection
					console.log(`[WebRTC Publisher ${streamId}] Cleaning up invalid peer connection for ${viewerId}`);
					existingPeer.close();
					peersRef.current.delete(viewerId);
				}
			}
			
			if (streamRef.current) {
				console.log(`[WebRTC Publisher ${streamId}] Creating peer connection for viewer: ${viewerId}`);
				try {
					await createPeerConnection(viewerId);
				} catch (error: any) {
					console.error(`[WebRTC Publisher ${streamId}] Failed to create peer connection:`, error);
					// Clean up on error
					closePeerConnection(viewerId);
				}
			} else {
				console.warn(`[WebRTC Publisher ${streamId}] No stream available to send to viewer ${viewerId}`);
			}
		});

		socket.on("viewer-left", ({ viewerId }) => {
			console.log(`[WebRTC Publisher ${streamId}] Viewer left: ${viewerId}`);
			closePeerConnection(viewerId);
		});

		socket.on("webrtc-answer", async ({ viewerId, answer }) => {
			const peer = peersRef.current.get(viewerId);
			if (!peer) {
				console.warn(`[WebRTC Publisher ${streamId}] Received answer for unknown viewer: ${viewerId}`);
				return;
			}

			try {
				// Check if we're in a valid state to set remote description
				const state = peer.signalingState;
				if (state === "stable" || state === "closed") {
					console.warn(`[WebRTC Publisher ${streamId}] Cannot set remote answer, peer is in ${state} state`);
					return;
				}

				// Only set remote description if we have a local offer
				if (state === "have-local-offer" || state === "have-local-pranswer") {
					await peer.setRemoteDescription(new RTCSessionDescription(answer));
					console.log(`[WebRTC Publisher ${streamId}] Set remote description for ${viewerId}, new state: ${peer.signalingState}`);
				} else {
					console.warn(`[WebRTC Publisher ${streamId}] Unexpected signaling state when receiving answer: ${state}`);
				}
			} catch (error: any) {
				console.error(`[WebRTC Publisher ${streamId}] Error setting remote description:`, error);
				// If error is about state, don't throw - just log it
				if (error.message?.includes("state")) {
					console.warn(`[WebRTC Publisher ${streamId}] State mismatch ignored for ${viewerId}`);
				}
			}
		});

		socket.on("webrtc-ice-candidate", async ({ viewerId, candidate }) => {
			const peer = peersRef.current.get(viewerId);
			if (peer && candidate) {
				try {
					// Check if peer connection is still valid
					if (peer.signalingState !== "closed" && peer.connectionState !== "closed") {
						await peer.addIceCandidate(new RTCIceCandidate(candidate));
					} else {
						console.warn(`[WebRTC Publisher ${streamId}] Cannot add ICE candidate, peer is closed`);
					}
				} catch (error: any) {
					// Ignore errors about invalid state or when candidate was already added
					if (!error.message?.includes("InvalidStateError") && !error.message?.includes("candidate")) {
						console.error(`[WebRTC Publisher ${streamId}] Error adding ICE candidate:`, error);
					}
				}
			}
		});

		socket.on("viewer-count", ({ count }) => {
			setViewerCount(count);
		});

		socket.on("stop_all_streams", () => {
			console.log(`[WebRTC Publisher ${streamId}] Received stop_all_streams command`);
			stopStreaming();
		});

		// Periodic cleanup of closed peer connections
		const cleanupInterval = setInterval(() => {
			for (const [id, peer] of peersRef.current.entries()) {
				if (peer.signalingState === "closed" || peer.connectionState === "closed" || peer.connectionState === "failed") {
					console.log(`[WebRTC Publisher ${streamId}] Periodic cleanup: removing closed peer ${id}`);
					peer.close();
					peersRef.current.delete(id);
				}
			}
		}, 5000); // Clean up every 5 seconds

		return () => {
			clearInterval(cleanupInterval);
			stopStreaming();
			socket.disconnect();
		};
	}, [streamId]);

	const createPeerConnection = async (viewerId: string) => {
		try {
			// Clean up any closed/invalid peer connections first to free resources
			for (const [id, peer] of peersRef.current.entries()) {
				if (peer.signalingState === "closed" || peer.connectionState === "closed") {
					console.log(`[WebRTC Publisher ${streamId}] Cleaning up closed peer connection for ${id}`);
					peer.close();
					peersRef.current.delete(id);
				}
			}

			// Close existing peer connection if one exists for this viewer
			const existingPeer = peersRef.current.get(viewerId);
			if (existingPeer) {
				console.log(`[WebRTC Publisher ${streamId}] Closing existing peer connection for ${viewerId}`);
				existingPeer.close();
				peersRef.current.delete(viewerId);
				// Give it a moment to fully close
				await new Promise(resolve => setTimeout(resolve, 100));
			}

			console.log(`[WebRTC Publisher ${streamId}] Creating peer connection for ${viewerId} (current peer count: ${peersRef.current.size})`);
			
			const peer = new RTCPeerConnection({
				iceServers: [
					{ urls: "stun:stun.l.google.com:19302" },
					{ urls: "stun:stun1.l.google.com:19302" },
				],
			});

			// Add all tracks from the stream
			const tracks = streamRef.current?.getTracks() || [];
			console.log(`[WebRTC Publisher ${streamId}] Adding ${tracks.length} tracks to peer`);
			
			tracks.forEach((track) => {
				console.log(`[WebRTC Publisher ${streamId}] Adding ${track.kind} track`);
				peer.addTrack(track, streamRef.current!);
			});

			// Handle connection state with cleanup on failure
			peer.onconnectionstatechange = () => {
				console.log(`[WebRTC Publisher ${streamId}] Connection state for ${viewerId}:`, peer.connectionState);
				// Clean up on failure or close
				if (peer.connectionState === "failed" || peer.connectionState === "closed") {
					console.log(`[WebRTC Publisher ${streamId}] Peer connection ${viewerId} entered ${peer.connectionState}, cleaning up`);
					closePeerConnection(viewerId);
				}
			};

			peer.oniceconnectionstatechange = () => {
				console.log(`[WebRTC Publisher ${streamId}] ICE state for ${viewerId}:`, peer.iceConnectionState);
			};

			// Handle ICE candidates
			peer.onicecandidate = (event) => {
				if (event.candidate) {
					socketRef.current?.emit("webrtc-ice-candidate", {
						streamId,
						viewerId,
						candidate: event.candidate,
					});
				}
			};

			// Create and send offer
			const offer = await peer.createOffer();
			await peer.setLocalDescription(offer);

			console.log(`[WebRTC Publisher ${streamId}] Sending offer to ${viewerId}`);
			socketRef.current?.emit("webrtc-offer", {
				streamId,
				viewerId,
				offer,
			});

			peersRef.current.set(viewerId, peer);
			
		} catch (error: any) {
			console.error(`[WebRTC Publisher ${streamId}] Error creating peer connection:`, error);
			
			// If we hit the limit, try to clean up more aggressively
			if (error.message?.includes("so many PeerConnections")) {
				console.warn(`[WebRTC Publisher ${streamId}] Hit peer connection limit, cleaning up all closed connections`);
				for (const [id, peer] of peersRef.current.entries()) {
					if (peer.signalingState === "closed" || peer.connectionState === "closed" || peer.connectionState === "failed") {
						peer.close();
						peersRef.current.delete(id);
					}
				}
				setError("Too many peer connections. Please refresh the page.");
			}
			
			// Ensure cleanup
			closePeerConnection(viewerId);
			throw error;
		}
	};

	const closePeerConnection = (viewerId: string) => {
		const peer = peersRef.current.get(viewerId);
		if (peer) {
			peer.close();
			peersRef.current.delete(viewerId);
		}
	};

	const startStreaming = async () => {
		try {
			setError(null);
			let stream: MediaStream;

			if (streamType === "webcam") {
				stream = await navigator.mediaDevices.getUserMedia({
					video: { width: 1280, height: 720 },
					audio: true,
				});
			} else {
				stream = await navigator.mediaDevices.getDisplayMedia({
					video: { width: 1920, height: 1080 },
					audio: true,
				});
			}

			streamRef.current = stream;

			// Display local preview
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
			}

			// Announce stream to server
			socketRef.current?.emit("start-stream", { streamId, streamType });
			setIsStreaming(true);

			console.log(`[WebRTC Publisher ${streamId}] Started ${streamType} stream`);
		} catch (err: any) {
			console.error(`[WebRTC Publisher ${streamId}] Error starting stream:`, err);
			setError(err.message || "Failed to start stream");
		}
	};

	const stopStreaming = () => {
		// Stop all tracks
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = null;

		// Close all peer connections
		peersRef.current.forEach((peer) => peer.close());
		peersRef.current.clear();

		// Clear video preview
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}

		// Notify server
		socketRef.current?.emit("stop-stream", { streamId });
		setIsStreaming(false);
		setViewerCount(0);

		console.log(`[WebRTC Publisher ${streamId}] Stopped stream`);
	};

	return (
		<div className="space-y-3 p-4 bg-neutral-900 rounded-lg border border-neutral-800">
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-white">{label}</h3>
				{isStreaming && (
					<div className="flex items-center gap-2">
						<div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
						<span className="text-xs text-red-400">LIVE</span>
						<span className="text-xs text-neutral-400">• {viewerCount} viewers</span>
					</div>
				)}
			</div>

			<div className="aspect-video bg-black rounded border border-neutral-700 overflow-hidden relative">
				<video
					ref={videoRef}
					autoPlay
					muted
					playsInline
					className="w-full h-full object-cover"
				/>
				{!isStreaming && (
					<div className="absolute inset-0 flex items-center justify-center">
						<span className="text-neutral-500">
							{streamType === "webcam" ? "📹 Webcam Preview" : "🖥️ Screen Share Preview"}
						</span>
					</div>
				)}
			</div>

			{error && (
				<div className="p-2 bg-red-900/20 border border-red-700 rounded text-red-400 text-sm">
					{error}
				</div>
			)}

			<Button
				onClick={isStreaming ? stopStreaming : startStreaming}
				variant={isStreaming ? "secondary" : "primary"}
			>
				{isStreaming
					? `Stop ${streamType === "webcam" ? "Webcam" : "Screen Share"}`
					: `Start ${streamType === "webcam" ? "Webcam" : "Screen Share"}`}
			</Button>

			<p className="text-xs text-neutral-500">
				{streamType === "webcam"
					? "Click 'Start Webcam' to broadcast your camera feed."
					: "Click 'Start Screen Share' and select a screen or window to broadcast."}
			</p>
		</div>
	);
}

