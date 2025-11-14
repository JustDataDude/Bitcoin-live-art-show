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
	const browserLimitHitRef = useRef<boolean>(false);
	const viewerQueueRef = useRef<Set<string>>(new Set());
	const processViewerQueueRef = useRef<(() => Promise<void>) | null>(null);
	const maxConcurrentViewers = 5; // Increased for better support
	const trackEndHandlersRef = useRef<Map<string, () => void>>(new Map());

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

		socket.on("viewer-joined", async ({ viewerId, isReconnect }) => {
			console.log(`[WebRTC Publisher ${streamId}] Viewer joined: ${viewerId}${isReconnect ? ' (reconnect)' : ''}`);
			
			// If we've hit the browser limit, add to queue instead of refusing
			if (browserLimitHitRef.current) {
				console.warn(`[WebRTC Publisher ${streamId}] Browser limit was hit, adding ${viewerId} to queue`);
				viewerQueueRef.current.add(viewerId);
				return;
			}
			
			// Check if we're at capacity
			const currentActiveConnections = Array.from(peersRef.current.values()).filter(peer => {
				const state = peer.connectionState;
				const iceState = peer.iceConnectionState;
				return state === "connected" || state === "connecting" ||
					iceState === "connected" || iceState === "checking" || iceState === "completed";
			}).length;
			
			if (currentActiveConnections >= maxConcurrentViewers) {
				console.log(`[WebRTC Publisher ${streamId}] At capacity (${currentActiveConnections}/${maxConcurrentViewers}), adding ${viewerId} to queue`);
				viewerQueueRef.current.add(viewerId);
				return;
			}
			
			// For reconnects, wait a moment to see if the old connection is still valid
			if (isReconnect) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}
			
			// Aggressively clean up all closed/failed/stuck connections first
			for (const [id, peer] of peersRef.current.entries()) {
				const state = peer.signalingState;
				const connState = peer.connectionState;
				const iceState = peer.iceConnectionState;
				
				// Clean up closed/failed connections
				const isBad = state === "closed" || 
					connState === "closed" || 
					connState === "failed" ||
					connState === "disconnected" ||
					iceState === "failed" ||
					iceState === "disconnected" ||
					iceState === "closed";
				
				// Also clean up connections stuck in "new" state for too long (likely failed to establish)
				const isStuck = state === "stable" && 
					connState === "new" && 
					iceState === "new";
				
				if (isBad || isStuck) {
					console.log(`[WebRTC Publisher ${streamId}] Cleaning up ${isBad ? 'bad' : 'stuck'} peer ${id} (state: ${state}, conn: ${connState}, ice: ${iceState})`);
					try {
						// Stop all tracks first
						peer.getSenders().forEach(sender => {
							if (sender.track) {
								sender.track.stop();
							}
						});
						peer.close();
					} catch (e) {
						// Ignore errors when closing already closed peers
					}
					peersRef.current.delete(id);
				}
			}
			
			// Check if peer connection already exists and is valid
			const existingPeer = peersRef.current.get(viewerId);
			if (existingPeer) {
				const state = existingPeer.signalingState;
				const connectionState = existingPeer.connectionState;
				const iceState = existingPeer.iceConnectionState;
				
				// If peer is already connected and working, don't create a new one
				const isWorking = (connectionState === "connected") &&
					(iceState === "connected" || iceState === "completed");
				
				if (isWorking) {
					console.log(`[WebRTC Publisher ${streamId}] Peer connection already exists and is working for ${viewerId} (state: ${state}, conn: ${connectionState}, ice: ${iceState}), skipping`);
					return;
				} else {
					// Clean up invalid/stuck peer connection
					console.log(`[WebRTC Publisher ${streamId}] Cleaning up invalid/stuck peer connection for ${viewerId} (state: ${state}, conn: ${connectionState}, ice: ${iceState})`);
					try {
						existingPeer.close();
					} catch (e) {
						// Ignore errors
					}
					peersRef.current.delete(viewerId);
				}
			}
			
			// Check active connections count (not just total)
			const currentActiveCount = Array.from(peersRef.current.values()).filter(peer => {
				const state = peer.connectionState;
				const iceState = peer.iceConnectionState;
				return state === "connected" || state === "connecting" ||
					iceState === "connected" || iceState === "checking" || iceState === "completed";
			}).length;
			
			if (currentActiveCount >= maxConcurrentViewers) {
				console.warn(`[WebRTC Publisher ${streamId}] At capacity (${currentActiveCount}/${maxConcurrentViewers}), adding ${viewerId} to queue`);
				viewerQueueRef.current.add(viewerId);
				return;
			}
			
			if (streamRef.current) {
				console.log(`[WebRTC Publisher ${streamId}] Creating peer connection for viewer: ${viewerId}`);
				try {
					const result = await createPeerConnection(viewerId);
					// If createPeerConnection returns undefined, it means we hit the browser limit
					if (result === undefined) {
						console.warn(`[WebRTC Publisher ${streamId}] Cannot create connection due to browser limit`);
						return;
					}
				} catch (error: any) {
					// Only log if it's not the browser limit error (we already handled that)
					if (!error.message?.includes("so many PeerConnections") && 
						!error.message?.includes("PeerConnections") &&
						error.name !== "UnknownError") {
						console.error(`[WebRTC Publisher ${streamId}] Failed to create peer connection:`, error);
					}
					// Clean up on error
					closePeerConnection(viewerId);
				}
			} else {
				console.warn(`[WebRTC Publisher ${streamId}] No stream available to send to viewer ${viewerId}`);
			}
		});

		// Function to process queued viewers (stored in ref so it can be accessed from peer handlers)
		const processViewerQueue = async () => {
			if (browserLimitHitRef.current || !streamRef.current || viewerQueueRef.current.size === 0) {
				return;
			}
			
			const queueActiveConnections = Array.from(peersRef.current.values()).filter(peer => {
				const state = peer.connectionState;
				const iceState = peer.iceConnectionState;
				return state === "connected" || state === "connecting" ||
					iceState === "connected" || iceState === "checking" || iceState === "completed";
			}).length;
			
			if (queueActiveConnections >= maxConcurrentViewers) {
				return;
			}
			
			// Get next viewer from queue
			const nextViewerId = Array.from(viewerQueueRef.current)[0];
			if (nextViewerId) {
				viewerQueueRef.current.delete(nextViewerId);
				console.log(`[WebRTC Publisher ${streamId}] Processing queued viewer: ${nextViewerId}`);
				// Create connection for queued viewer (will be defined later, but accessible via closure)
				setTimeout(async () => {
					try {
						await createPeerConnection(nextViewerId);
					} catch (error: any) {
						console.error(`[WebRTC Publisher ${streamId}] Failed to create connection for queued viewer:`, error);
						// Re-add to queue if it failed due to capacity
						if (!error.message?.includes("browser limit")) {
							viewerQueueRef.current.add(nextViewerId);
						}
					}
				}, 100);
			}
		};
		
		// Store in ref so it can be accessed from peer connection handlers
		processViewerQueueRef.current = processViewerQueue;

		socket.on("webrtc-answer", async ({ viewerId, answer }) => {
			const peer = peersRef.current.get(viewerId);
			if (!peer) {
				console.warn(`[WebRTC Publisher ${streamId}] Received answer for unknown viewer: ${viewerId}`);
				return;
			}

			try {
				// Check if we're in a valid state to set remote description
				const state = peer.signalingState;
				const connState = peer.connectionState;
				const iceState = peer.iceConnectionState;
				
				// If already in stable state, check if connection is working
				if (state === "stable") {
					// If connection is working, answer was already processed - ignore
					if (connState === "connected" && (iceState === "connected" || iceState === "completed")) {
						console.log(`[WebRTC Publisher ${streamId}] Answer already processed, connection is working for ${viewerId}`);
						return;
					}
					// If in stable but not connected, something went wrong - close and recreate
					console.warn(`[WebRTC Publisher ${streamId}] Peer in stable state but not connected (conn: ${connState}, ice: ${iceState}), closing connection`);
					closePeerConnection(viewerId);
					// Try to recreate if stream is still active
					if (streamRef.current) {
						setTimeout(() => {
							createPeerConnection(viewerId).catch(err => {
								console.error(`[WebRTC Publisher ${streamId}] Failed to recreate connection:`, err);
							});
						}, 500);
					}
					return;
				}
				
				// If closed, ignore
				if (state === "closed") {
					console.warn(`[WebRTC Publisher ${streamId}] Cannot set remote answer, peer is closed`);
					return;
				}

				// Only set remote description if we have a local offer
				if (state === "have-local-offer" || state === "have-local-pranswer") {
					await peer.setRemoteDescription(new RTCSessionDescription(answer));
					console.log(`[WebRTC Publisher ${streamId}] Set remote description for ${viewerId}, new state: ${peer.signalingState}`);
				} else {
					console.warn(`[WebRTC Publisher ${streamId}] Unexpected signaling state when receiving answer: ${state} (conn: ${connState}, ice: ${iceState})`);
				}
			} catch (error: any) {
				console.error(`[WebRTC Publisher ${streamId}] Error setting remote description:`, error);
				// If error is about state, the answer was likely already processed
				if (error.message?.includes("state") || error.message?.includes("stable")) {
					console.warn(`[WebRTC Publisher ${streamId}] State mismatch - answer may have been already processed for ${viewerId}`);
					// Check if connection is actually working despite the error
					const peer = peersRef.current.get(viewerId);
					if (peer && peer.connectionState === "connected") {
						console.log(`[WebRTC Publisher ${streamId}] Connection is working despite state error, ignoring`);
					}
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

		socket.on("stop_stream", ({ streamId: targetStreamId }) => {
			if (targetStreamId === streamId) {
				console.log(`[WebRTC Publisher ${streamId}] Received stop_stream command`);
				stopStreaming();
			}
		});

		// Aggressive periodic cleanup of closed/stuck peer connections
		const cleanupInterval = setInterval(() => {
			let cleaned = 0;
			for (const [id, peer] of peersRef.current.entries()) {
				const state = peer.signalingState;
				const connState = peer.connectionState;
				const iceState = peer.iceConnectionState;
				
				// Clean up closed/failed connections
				const isBad = state === "closed" || 
					connState === "closed" || 
					connState === "failed" ||
					connState === "disconnected" ||
					iceState === "failed" ||
					iceState === "disconnected" ||
					iceState === "closed";
				
				// Also clean up connections stuck in "new" state (likely failed to establish)
				const isStuck = state === "stable" && 
					connState === "new" && 
					iceState === "new";
				
				// Clean up connections that have been disconnected for too long
				const isDisconnected = connState === "disconnected" || iceState === "disconnected";
				
				if (isBad || isStuck || isDisconnected) {
					console.log(`[WebRTC Publisher ${streamId}] Periodic cleanup: removing ${isBad ? 'bad' : isStuck ? 'stuck' : 'disconnected'} peer ${id} (state: ${state}, conn: ${connState}, ice: ${iceState})`);
					try {
						// Stop all tracks first
						peer.getSenders().forEach(sender => {
							if (sender.track) {
								sender.track.stop();
							}
						});
						peer.close();
					} catch (e) {
						// Ignore errors
					}
					peersRef.current.delete(id);
					cleaned++;
				}
			}
			if (cleaned > 0) {
				console.log(`[WebRTC Publisher ${streamId}] Cleaned up ${cleaned} peer connections, remaining: ${peersRef.current.size}`);
				// Process queue after cleanup
				if (processViewerQueueRef.current) {
					processViewerQueueRef.current();
				}
			}
		}, 2000); // Clean up every 2 seconds

		return () => {
			// Clear cleanup interval
			clearInterval(cleanupInterval);
			
			// Stop streaming and clean up all peer connections
			stopStreaming();
			
			// Close all peer connections
			for (const [viewerId, peer] of peersRef.current.entries()) {
				try {
					peer.close();
				} catch (error) {
					console.error(`[WebRTC Publisher ${streamId}] Error closing peer ${viewerId}:`, error);
				}
			}
			peersRef.current.clear();
			
			// Remove all socket listeners
			socket.off("viewer-joined");
			socket.off("viewer-left");
			socket.off("webrtc-answer");
			socket.off("webrtc-ice-candidate");
			socket.off("viewer-count");
			socket.off("stop_all_streams");
			socket.off("stop_stream");
			
			// Disconnect socket
			socket.disconnect();
		};
	}, [streamId]);

	const createPeerConnection = async (viewerId: string): Promise<void> => {
		try {
			// Aggressively clean up any closed/invalid/stuck peer connections first to free resources
			for (const [id, peer] of peersRef.current.entries()) {
				const state = peer.signalingState;
				const connState = peer.connectionState;
				const iceState = peer.iceConnectionState;
				
				// Clean up closed/failed connections
				const isBad = state === "closed" || 
					connState === "closed" || 
					connState === "failed" ||
					connState === "disconnected" ||
					iceState === "failed" ||
					iceState === "disconnected" ||
					iceState === "closed";
				
				// Also clean up connections stuck in "new" state
				const isStuck = state === "stable" && 
					connState === "new" && 
					iceState === "new";
				
				if (isBad || isStuck) {
					console.log(`[WebRTC Publisher ${streamId}] Cleaning up ${isBad ? 'bad' : 'stuck'} peer connection for ${id} (state: ${state}, conn: ${connState}, ice: ${iceState})`);
					try {
						peer.close();
					} catch (e) {
						// Ignore errors
					}
					peersRef.current.delete(id);
				}
			}

			// Close existing peer connection if one exists for this viewer
			const existingPeer = peersRef.current.get(viewerId);
			if (existingPeer) {
				console.log(`[WebRTC Publisher ${streamId}] Closing existing peer connection for ${viewerId}`);
				try {
					existingPeer.close();
				} catch (e) {
					// Ignore errors
				}
				peersRef.current.delete(viewerId);
				// Give it a moment to fully close
				await new Promise(resolve => setTimeout(resolve, 200));
			}

			// Check active connections count (not just total)
			const activeConnections = Array.from(peersRef.current.values()).filter(peer => {
				const state = peer.connectionState;
				const iceState = peer.iceConnectionState;
				return state === "connected" || state === "connecting" ||
					iceState === "connected" || iceState === "checking" || iceState === "completed";
			}).length;
			
			if (activeConnections >= maxConcurrentViewers) {
				throw new Error(`Maximum concurrent viewers (${maxConcurrentViewers}) reached`);
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
			
			if (tracks.length === 0) {
				throw new Error("No tracks available in stream");
			}
			
			tracks.forEach((track) => {
				if (track.readyState === "live") {
					console.log(`[WebRTC Publisher ${streamId}] Adding ${track.kind} track (id: ${track.id}, state: ${track.readyState})`);
					try {
						peer.addTrack(track, streamRef.current!);
					} catch (err) {
						console.error(`[WebRTC Publisher ${streamId}] Error adding track:`, err);
						throw err;
					}
				} else {
					console.warn(`[WebRTC Publisher ${streamId}] Track ${track.id} is not live (state: ${track.readyState})`);
				}
			});

			// Handle connection state with cleanup on failure
			peer.onconnectionstatechange = () => {
				const state = peer.connectionState;
				console.log(`[WebRTC Publisher ${streamId}] Connection state for ${viewerId}:`, state);
				
				// If connected, process queue to allow next viewer
				if (state === "connected") {
					console.log(`[WebRTC Publisher ${streamId}] Successfully connected to ${viewerId}`);
					setTimeout(() => {
						if (processViewerQueueRef.current) {
							processViewerQueueRef.current();
						}
					}, 500);
				}
				
				// Only clean up on actual failure or close (not on transient disconnected state)
				if (state === "failed" || state === "closed") {
					console.log(`[WebRTC Publisher ${streamId}] Peer connection ${viewerId} entered ${state}, cleaning up`);
					setTimeout(() => {
						closePeerConnection(viewerId);
						if (processViewerQueueRef.current) {
							processViewerQueueRef.current();
						}
					}, 100);
				} else if (state === "disconnected") {
					// For disconnected, wait a bit before cleaning up (might reconnect)
					console.log(`[WebRTC Publisher ${streamId}] Peer connection ${viewerId} disconnected, waiting for potential reconnect...`);
					setTimeout(() => {
						const peer = peersRef.current.get(viewerId);
						if (peer && (peer.connectionState === "disconnected" || peer.connectionState === "failed")) {
							console.log(`[WebRTC Publisher ${streamId}] Peer ${viewerId} still disconnected after timeout, cleaning up`);
							closePeerConnection(viewerId);
							if (processViewerQueueRef.current) {
								processViewerQueueRef.current();
							}
						}
					}, 5000); // Wait 5 seconds for potential reconnect
				}
			};

			peer.oniceconnectionstatechange = () => {
				const iceState = peer.iceConnectionState;
				console.log(`[WebRTC Publisher ${streamId}] ICE state for ${viewerId}:`, iceState);
				
				// If connected, process queue to allow next viewer
				if (iceState === "connected" || iceState === "completed") {
					console.log(`[WebRTC Publisher ${streamId}] ICE connection established with ${viewerId}`);
					setTimeout(() => {
						if (processViewerQueueRef.current) {
							processViewerQueueRef.current();
						}
					}, 500);
				}
				
				// Only clean up on actual failure or close
				if (iceState === "failed" || iceState === "closed") {
					console.log(`[WebRTC Publisher ${streamId}] ICE connection ${viewerId} entered ${iceState}, cleaning up`);
					setTimeout(() => {
						closePeerConnection(viewerId);
						if (processViewerQueueRef.current) {
							processViewerQueueRef.current();
						}
					}, 100);
				} else if (iceState === "disconnected") {
					// For disconnected, wait a bit before cleaning up (might reconnect)
					console.log(`[WebRTC Publisher ${streamId}] ICE connection ${viewerId} disconnected, waiting for potential reconnect...`);
					setTimeout(() => {
						const peer = peersRef.current.get(viewerId);
						if (peer && (peer.iceConnectionState === "disconnected" || peer.iceConnectionState === "failed")) {
							console.log(`[WebRTC Publisher ${streamId}] ICE ${viewerId} still disconnected after timeout, cleaning up`);
							closePeerConnection(viewerId);
							if (processViewerQueueRef.current) {
								processViewerQueueRef.current();
							}
						}
					}, 5000); // Wait 5 seconds for potential reconnect
				}
			};

			// Handle ICE candidates
			peer.onicecandidate = (event) => {
				if (event.candidate) {
					console.log(`[WebRTC Publisher ${streamId}] ICE candidate for ${viewerId}:`, event.candidate.candidate.substring(0, 50));
					socketRef.current?.emit("webrtc-ice-candidate", {
						streamId,
						viewerId,
						candidate: event.candidate,
					});
				} else {
					console.log(`[WebRTC Publisher ${streamId}] ICE gathering complete for ${viewerId}`);
				}
			};
			
			// Handle ICE gathering state
			peer.onicegatheringstatechange = () => {
				console.log(`[WebRTC Publisher ${streamId}] ICE gathering state for ${viewerId}:`, peer.iceGatheringState);
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
			
			return; // Success
		} catch (error: any) {
			console.error(`[WebRTC Publisher ${streamId}] Error creating peer connection:`, error);
			
			// If we hit the limit, try to clean up more aggressively
			if (error.message?.includes("so many PeerConnections") || 
				error.message?.includes("PeerConnections") ||
				error.name === "UnknownError") {
				console.warn(`[WebRTC Publisher ${streamId}] Hit peer connection limit, aggressively cleaning up all connections`);
				// Close ALL peer connections to free up resources
				for (const [id, peer] of peersRef.current.entries()) {
					try {
						// Stop all tracks first
						peer.getSenders().forEach(sender => {
							if (sender.track) {
								sender.track.stop();
							}
						});
						peer.close();
					} catch (e) {
						// Ignore errors
					}
					peersRef.current.delete(id);
				}
				console.log(`[WebRTC Publisher ${streamId}] Cleared all peer connections, count: ${peersRef.current.size}`);
				
				// Wait a bit to let browser garbage collect
				await new Promise(resolve => setTimeout(resolve, 2000));
				
				// Try to recover by stopping and restarting the stream
				// This forces a complete cleanup
				if (isStreaming && streamRef.current) {
					console.log(`[WebRTC Publisher ${streamId}] Attempting automatic recovery by restarting stream...`);
					setError("Too many peer connections detected. Restarting stream to recover...");
					
					// Stop streaming completely
					const wasStreaming = isStreaming;
					stopStreaming();
					
					// Wait for cleanup
					await new Promise(resolve => setTimeout(resolve, 2000));
					
					// Reset the flag after cleanup
					browserLimitHitRef.current = false;
					
					// Try to restart if we were streaming
					if (wasStreaming) {
						console.log(`[WebRTC Publisher ${streamId}] Attempting to restart stream after recovery...`);
						setTimeout(() => {
							startStreaming().catch(err => {
								console.error(`[WebRTC Publisher ${streamId}] Failed to restart stream:`, err);
								setError("Too many peer connections. Please refresh the page to reset browser limits.");
								// Only set the flag if restart fails
								browserLimitHitRef.current = true;
							});
						}, 500);
					}
				} else {
					// If not streaming, just wait and reset the flag
					// The browser should have garbage collected by now
					setError("Too many peer connections. All connections cleared. Waiting for browser cleanup...");
					setTimeout(() => {
						browserLimitHitRef.current = false;
						setError(null);
						console.log(`[WebRTC Publisher ${streamId}] Browser limit flag reset, ready for new connections`);
						// Process queue after reset
						if (processViewerQueueRef.current) {
							processViewerQueueRef.current();
						}
					}, 3000);
				}
				
				// Return undefined to signal we hit the limit
				return;
			}
			
			// Ensure cleanup
			closePeerConnection(viewerId);
			throw error;
		}
	};

	const closePeerConnection = (viewerId: string) => {
		const peer = peersRef.current.get(viewerId);
		if (peer) {
			try {
				// Stop all tracks first to free resources
				peer.getSenders().forEach(sender => {
					if (sender.track) {
						sender.track.stop();
					}
				});
				// Close the connection
				peer.close();
			} catch (e) {
				// Ignore errors during cleanup
			}
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

			// Handle track ending (especially for screen share)
			stream.getTracks().forEach((track) => {
				const trackId = track.id;
				const trackKind = track.kind;
				const handleTrackEnd = () => {
					console.log(`[WebRTC Publisher ${streamId}] Track ${trackId} (${trackKind}) ended`);
					
					// If it's a video track and we're screen sharing, try to get a new stream
					if (trackKind === "video" && streamType === "screen" && streamRef.current) {
						console.log(`[WebRTC Publisher ${streamId}] Screen share ended, attempting to get new stream`);
						// Try to get a new stream
						navigator.mediaDevices.getDisplayMedia({
							video: { width: 1920, height: 1080 },
							audio: true,
						}).then((newStream) => {
							const newVideoTrack = newStream.getVideoTracks()[0];
							const newAudioTrack = newStream.getAudioTracks()[0];
							
							if (newVideoTrack) {
								console.log(`[WebRTC Publisher ${streamId}] Got new display media, replacing tracks in all peer connections`);
								
								// Replace tracks in all peer connections
								peersRef.current.forEach((peer, viewerId) => {
									const senders = peer.getSenders();
									
									// Find and replace video track
									const videoSender = senders.find(s => s.track?.kind === "video");
									if (videoSender && videoSender.track) {
										console.log(`[WebRTC Publisher ${streamId}] Replacing video track for ${viewerId}`);
										videoSender.replaceTrack(newVideoTrack).catch((err) => {
											console.error(`[WebRTC Publisher ${streamId}] Error replacing video track:`, err);
										});
									}
									
									// Find and replace audio track if available
									if (newAudioTrack) {
										const audioSender = senders.find(s => s.track?.kind === "audio");
										if (audioSender && audioSender.track) {
											console.log(`[WebRTC Publisher ${streamId}] Replacing audio track for ${viewerId}`);
											audioSender.replaceTrack(newAudioTrack).catch((err) => {
												console.error(`[WebRTC Publisher ${streamId}] Error replacing audio track:`, err);
											});
										}
									}
								});
								
								// Update streamRef with new stream
								if (streamRef.current) {
									streamRef.current.getTracks().forEach(t => {
										if (t.id !== trackId) { // Don't stop the track that just ended
											t.stop();
										}
									});
								}
								streamRef.current = newStream;
								if (videoRef.current) {
									videoRef.current.srcObject = newStream;
								}
								
								// Set up track end handlers for new tracks
								if (newVideoTrack) {
									newVideoTrack.onended = handleTrackEnd;
									trackEndHandlersRef.current.set(newVideoTrack.id, handleTrackEnd);
								}
								if (newAudioTrack) {
									newAudioTrack.onended = () => {
										console.log(`[WebRTC Publisher ${streamId}] Audio track ended`);
									};
								}
								
								console.log(`[WebRTC Publisher ${streamId}] Successfully replaced screen share tracks`);
							}
						}).catch((err) => {
							console.error(`[WebRTC Publisher ${streamId}] Failed to get new display media:`, err);
							setError("Screen share ended. Please restart streaming.");
							stopStreaming();
						});
					} else {
						// For other tracks or if not screen sharing, just stop streaming
						console.log(`[WebRTC Publisher ${streamId}] Track ended, stopping stream`);
						stopStreaming();
					}
				};
				
				track.onended = handleTrackEnd;
				trackEndHandlersRef.current.set(trackId, handleTrackEnd);
			});

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

		// Close all peer connections and stop their tracks
		peersRef.current.forEach((peer) => {
			try {
				peer.getSenders().forEach(sender => {
					if (sender.track) {
						sender.track.stop();
					}
				});
				peer.close();
			} catch (e) {
				// Ignore errors
			}
		});
		peersRef.current.clear();

		// Clear video preview
		if (videoRef.current) {
			videoRef.current.srcObject = null;
		}

		// Notify server
		socketRef.current?.emit("stop-stream", { streamId });
		setIsStreaming(false);
		setViewerCount(0);
		
		// Reset browser limit flag when stopping
		browserLimitHitRef.current = false;
		setError(null);

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


