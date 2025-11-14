"use client";

import { useEffect, useRef, useState, memo } from "react";
import { io, Socket } from "socket.io-client";

interface WebRTCViewerProps {
	streamId: string;
	label: string;
}

function WebRTCViewerComponent({ streamId, label }: WebRTCViewerProps) {
	const [isConnected, setIsConnected] = useState(false);
	const [isLive, setIsLive] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const socketRef = useRef<Socket | null>(null);
	const peerRef = useRef<RTCPeerConnection | null>(null);
	const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		// Connect to signaling server
		const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4001";
		
		console.log(`[WebRTC Viewer ${streamId}] Connecting to: ${wsUrl}`);
		const socket = io(wsUrl, {
			transports: ["polling", "websocket"],
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionAttempts: 5,
		});
		socketRef.current = socket;

		socket.on("connect", () => {
			console.log(`[WebRTC Viewer ${streamId}] Connected to signaling server`);
			setIsConnected(true);

			// Request to watch this stream immediately
			const requestWatch = () => {
				// Only request if we don't already have a peer connection in a good state
				if (socket.connected) {
					const hasGoodConnection = peerRef.current && 
						peerRef.current.signalingState !== "closed" &&
						peerRef.current.connectionState === "connected" &&
						(peerRef.current.iceConnectionState === "connected" || peerRef.current.iceConnectionState === "completed");
					
					if (!hasGoodConnection) {
						console.log(`[WebRTC Viewer ${streamId}] Requesting to watch stream`);
						socket.emit("watch-stream", { streamId });
						return true;
					} else {
						console.log(`[WebRTC Viewer ${streamId}] Already have good peer connection, skipping watch request`);
					}
				}
				return false;
			};
			
			// Request immediately
			requestWatch();
			
			// Retry after delays to catch streams that are already active
			// This helps when the stream is already running when the page loads
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
			}
			
			// Retry after 1 second if still no peer connection
			retryTimeoutRef.current = setTimeout(() => {
				if (socket.connected && socketRef.current?.connected && !isLive) {
					const hasConnection = peerRef.current && 
						peerRef.current.signalingState !== "closed" &&
						peerRef.current.connectionState !== "closed" &&
						peerRef.current.connectionState !== "failed";
					
					if (!hasConnection) {
						console.log(`[WebRTC Viewer ${streamId}] Retry 1s: Requesting watch-stream (stream may already be active)`);
						requestWatch();
					}
				}
				retryTimeoutRef.current = null;
			}, 1000);
			
			// Additional retry after 3 seconds for streams that take longer to establish
			setTimeout(() => {
				if (socket.connected && socketRef.current?.connected && !isLive) {
					const hasConnection = peerRef.current && 
						peerRef.current.signalingState !== "closed" &&
						peerRef.current.connectionState !== "closed" &&
						peerRef.current.connectionState !== "failed";
					
					if (!hasConnection) {
						console.log(`[WebRTC Viewer ${streamId}] Retry 3s: Requesting watch-stream again`);
						requestWatch();
					}
				}
			}, 3000);
		});

		socket.on("connect_error", (error) => {
			console.error(`[WebRTC Viewer ${streamId}] Connection error:`, error);
		});

		socket.on("disconnect", (reason) => {
			// Only log unexpected disconnects (not manual cleanups)
			// "io client disconnect" is the normal reason when we call socket.disconnect()
			if (reason !== "io client disconnect") {
				console.warn(`[WebRTC Viewer ${streamId}] Unexpected disconnect:`, reason);
			}
			// Only update state if socket still exists (not during cleanup)
			if (socketRef.current === socket) {
				setIsConnected(false);
			}
		});

		socket.on("stream-available", ({ streamId: availableStreamId }) => {
			if (availableStreamId === streamId) {
				console.log(`[WebRTC Viewer ${streamId}] Stream is available`);
				// Don't set isLive here - wait until we actually have media
				// Clear retry timeout since stream is now available
				if (retryTimeoutRef.current) {
					clearTimeout(retryTimeoutRef.current);
					retryTimeoutRef.current = null;
				}
				// Check if we have a fully working peer connection
				const hasGoodConnection = peerRef.current && 
					peerRef.current.signalingState !== "closed" &&
					peerRef.current.connectionState === "connected" &&
					(peerRef.current.iceConnectionState === "connected" || peerRef.current.iceConnectionState === "completed");
				
				// If we don't have a fully working connection, request to watch
				// This will trigger the publisher to send an offer
				if (!hasGoodConnection) {
					console.log(`[WebRTC Viewer ${streamId}] No fully working peer connection, requesting to watch stream`);
					socket.emit("watch-stream", { streamId });
				} else if (peerRef.current) {
					const state = peerRef.current.signalingState;
					const connState = peerRef.current.connectionState;
					const iceState = peerRef.current.iceConnectionState;
					console.log(`[WebRTC Viewer ${streamId}] Already have fully working peer connection (state: ${state}, conn: ${connState}, ice: ${iceState}), waiting for offer`);
				}
			}
		});

		socket.on("stream-unavailable", ({ streamId: unavailableStreamId }) => {
			if (unavailableStreamId === streamId) {
				console.log(`[WebRTC Viewer ${streamId}] Stream is unavailable`);
				setIsLive(false);
				if (peerRef.current) {
					console.log(`[WebRTC Viewer ${streamId}] Closing peer connection due to stream unavailability`);
					peerRef.current.close();
					peerRef.current = null;
				}
				if (videoRef.current) {
					// Stop all tracks in the current stream
					const stream = videoRef.current.srcObject as MediaStream;
					if (stream) {
						stream.getTracks().forEach(track => track.stop());
					}
					// Clear the video source
					videoRef.current.srcObject = null;
					// Force video to clear by loading empty source
					videoRef.current.load();
				}
			}
		});

		socket.on("webrtc-offer", async ({ streamId: offerStreamId, offer }) => {
			if (offerStreamId !== streamId) return;
			console.log(`[WebRTC Viewer ${streamId}] Received offer:`, offer);
			
			// Check if we already have an active peer connection
			// If we do and it's in a good state, ignore duplicate offers
			if (peerRef.current) {
				const state = peerRef.current.signalingState;
				const connectionState = peerRef.current.connectionState;
				const iceState = peerRef.current.iceConnectionState;
				
				// If we have an active connection that's working, ignore the duplicate offer
				if (state === "stable" && 
					(connectionState === "connected" || connectionState === "connecting") &&
					(iceState === "connected" || iceState === "checking" || iceState === "completed")) {
					console.log(`[WebRTC Viewer ${streamId}] Ignoring duplicate offer - already have active connection (state: ${state}, conn: ${connectionState}, ice: ${iceState})`);
					return;
				}
			}
			
			await handleOffer(offer);
		});

		socket.on("webrtc-ice-candidate", async ({ candidate }) => {
			if (peerRef.current && candidate) {
				try {
					// Check if peer connection is still valid
					if (peerRef.current.signalingState !== "closed" && peerRef.current.connectionState !== "closed") {
						await peerRef.current.addIceCandidate(new RTCIceCandidate(candidate));
					} else {
						console.warn(`[WebRTC Viewer ${streamId}] Cannot add ICE candidate, peer is closed`);
					}
				} catch (error: any) {
					// Ignore errors about invalid state or when candidate was already added
					if (!error.message?.includes("InvalidStateError") && !error.message?.includes("candidate")) {
						console.error(`[WebRTC Viewer ${streamId}] Error adding ICE candidate:`, error);
					}
				}
			}
		});

		return () => {
			// Immediate cleanup for faster page transitions
			console.log(`[WebRTC Viewer ${streamId}] Cleaning up on unmount`);
			
			// Clear retry timeout immediately
			if (retryTimeoutRef.current) {
				clearTimeout(retryTimeoutRef.current);
				retryTimeoutRef.current = null;
			}
			
			// Clean up peer connection immediately
			if (peerRef.current) {
				try {
					// Stop all tracks first
					peerRef.current.getReceivers().forEach(receiver => {
						if (receiver.track) {
							receiver.track.stop();
						}
					});
					peerRef.current.close();
				} catch (e) {
					// Ignore errors during cleanup
				}
				peerRef.current = null;
			}
			
			// Clean up video stream immediately
			if (videoRef.current) {
				try {
					const stream = videoRef.current.srcObject as MediaStream;
					if (stream) {
						stream.getTracks().forEach(track => {
							track.stop();
						});
					}
					videoRef.current.srcObject = null;
					videoRef.current.load();
				} catch (e) {
					// Ignore errors during cleanup
				}
			}
			
			// Disconnect socket immediately (don't wait for listeners)
			if (socketRef.current) {
				const socket = socketRef.current;
				
				// Disconnect immediately - this will remove all listeners automatically
				if (socket.connected) {
					socket.disconnect();
				}
				
				// Remove listeners after disconnect for safety
				socket.off("webrtc-offer");
				socket.off("webrtc-ice-candidate");
				socket.off("stream-available");
				socket.off("stream-unavailable");
				socket.off("connect");
				socket.off("connect_error");
				socket.off("disconnect");
				
				socketRef.current = null;
			}
		};
	}, [streamId]);

	const handleOffer = async (offer: RTCSessionDescriptionInit) => {
		try {
			// Check if we have an existing peer connection
			if (peerRef.current) {
				const state = peerRef.current.signalingState;
				const connectionState = peerRef.current.connectionState;
				const iceState = peerRef.current.iceConnectionState;
				
				// Close if in bad states
				const isBadState = state === "closed" || 
					connectionState === "closed" || 
					connectionState === "failed" ||
					connectionState === "disconnected" ||
					iceState === "failed" ||
					iceState === "disconnected" ||
					iceState === "closed";
				
				// If already connected and working, ignore duplicate offer
				const isWorking = (connectionState === "connected" || connectionState === "connecting") &&
					(iceState === "connected" || iceState === "checking" || iceState === "completed");
				
				// If in a signaling state that can't accept an offer, close it
				const cannotAcceptOffer = state === "have-local-offer" || state === "have-remote-offer";
				
				if (isBadState || cannotAcceptOffer) {
					console.log(`[WebRTC Viewer ${streamId}] Closing existing peer connection (state: ${state}, conn: ${connectionState}, ice: ${iceState})`);
					peerRef.current.close();
					peerRef.current = null;
				} else if (isWorking) {
					console.log(`[WebRTC Viewer ${streamId}] Already have working connection, ignoring duplicate offer`);
					return;
				} else {
					// For any other state (including stable/new/new), close and create new
					// It's safer to always create a fresh connection rather than trying to reuse
					console.log(`[WebRTC Viewer ${streamId}] Closing existing connection (state: ${state}, conn: ${connectionState}, ice: ${iceState}), creating new`);
					if (peerRef.current) {
						peerRef.current.close();
						peerRef.current = null;
					}
				}
			}

			// Create new peer connection
			const peer = new RTCPeerConnection({
				iceServers: [
					{ urls: "stun:stun.l.google.com:19302" },
					{ urls: "stun:stun1.l.google.com:19302" },
				],
			});

			// Handle incoming media stream
			peer.ontrack = (event) => {
				console.log(`[WebRTC Viewer ${streamId}] Received track:`, event.track.kind, `(id: ${event.track.id}, state: ${event.track.readyState})`);
				
				// Set isLive to true when we receive media tracks
				if (event.track.readyState === "live") {
					setIsLive(true);
				}
				
				// Handle track state changes
				event.track.onended = () => {
					console.log(`[WebRTC Viewer ${streamId}] Track ${event.track.id} ended`);
					setIsLive(false);
				};
				
				event.track.onmute = () => {
					console.log(`[WebRTC Viewer ${streamId}] Track ${event.track.id} muted`);
				};
				
				event.track.onunmute = () => {
					console.log(`[WebRTC Viewer ${streamId}] Track ${event.track.id} unmuted`);
					setIsLive(true);
				};
				
				if (videoRef.current && event.streams[0]) {
					const video = videoRef.current;
					
					// Set up event listeners before changing srcObject
					const handleLoadedMetadata = () => {
						console.log(`[WebRTC Viewer ${streamId}] Video metadata loaded`);
						video.play().catch((err) => {
							// Only log if it's not an interruption error
							if (!err.message?.includes("interrupted") && !err.message?.includes("AbortError")) {
								console.warn(`[WebRTC Viewer ${streamId}] Autoplay prevented:`, err);
							}
						});
					};
					
					const handleCanPlay = () => {
						console.log(`[WebRTC Viewer ${streamId}] Video can play`);
						if (video.paused) {
							video.play().catch((err) => {
								if (!err.message?.includes("interrupted") && !err.message?.includes("AbortError")) {
									console.warn(`[WebRTC Viewer ${streamId}] Autoplay prevented:`, err);
								}
							});
						}
					};
					
					// Remove old listeners if they exist
					video.removeEventListener('loadedmetadata', handleLoadedMetadata);
					video.removeEventListener('canplay', handleCanPlay);
					
					// Add new listeners
					video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
					video.addEventListener('canplay', handleCanPlay, { once: true });
					
					// Set the new stream (or update if stream already exists)
					if (video.srcObject !== event.streams[0]) {
						video.srcObject = event.streams[0];
						console.log(`[WebRTC Viewer ${streamId}] Video srcObject set, stream is now LIVE`);
					} else {
						console.log(`[WebRTC Viewer ${streamId}] Stream already set, track added to existing stream`);
					}
					
					// Try to play immediately if video is ready
					if (video.readyState >= 2) { // HAVE_CURRENT_DATA
						video.play().catch((err) => {
							if (!err.message?.includes("interrupted") && !err.message?.includes("AbortError")) {
								console.warn(`[WebRTC Viewer ${streamId}] Autoplay prevented:`, err);
							}
						});
					}
				}
			};

			// Handle connection state changes
			peer.onconnectionstatechange = () => {
				console.log(`[WebRTC Viewer ${streamId}] Connection state:`, peer.connectionState);
				// Clean up video when connection closes
				if (peer.connectionState === "closed" || peer.connectionState === "failed") {
					setIsLive(false);
					if (videoRef.current) {
						const stream = videoRef.current.srcObject as MediaStream;
						if (stream) {
							stream.getTracks().forEach(track => track.stop());
						}
						videoRef.current.srcObject = null;
						videoRef.current.load();
					}
				}
			};

			peer.oniceconnectionstatechange = () => {
				console.log(`[WebRTC Viewer ${streamId}] ICE connection state:`, peer.iceConnectionState);
				// Clean up video when ICE connection fails
				if (peer.iceConnectionState === "disconnected" || peer.iceConnectionState === "failed") {
					setIsLive(false);
					if (videoRef.current) {
						const stream = videoRef.current.srcObject as MediaStream;
						if (stream) {
							stream.getTracks().forEach(track => track.stop());
						}
						videoRef.current.srcObject = null;
						videoRef.current.load();
					}
				}
			};

			// Handle ICE candidates
			peer.onicecandidate = (event) => {
				if (event.candidate) {
					socketRef.current?.emit("webrtc-ice-candidate", {
						streamId,
						candidate: event.candidate,
					});
				}
			};

			// Set remote description and create answer
			// Verify we're in the correct state (should be "stable" before setting remote desc)
			const initialState = peer.signalingState;
			if (initialState !== "stable") {
				console.warn(`[WebRTC Viewer ${streamId}] Unexpected initial state: ${initialState}`);
			}

			await peer.setRemoteDescription(new RTCSessionDescription(offer));
			console.log(`[WebRTC Viewer ${streamId}] Set remote description, state: ${peer.signalingState}`);

			const answer = await peer.createAnswer();
			await peer.setLocalDescription(answer);
			console.log(`[WebRTC Viewer ${streamId}] Set local description, state: ${peer.signalingState}`);

			// Send answer back
			socketRef.current?.emit("webrtc-answer", {
				streamId,
				answer,
			});

			peerRef.current = peer;
			console.log(`[WebRTC Viewer ${streamId}] Sent answer, waiting for media...`);
		} catch (error: any) {
			console.error(`[WebRTC Viewer ${streamId}] Error in handleOffer:`, error);
			// Clean up on error
			if (peerRef.current) {
				peerRef.current.close();
				peerRef.current = null;
			}
		}
	};

	return (
		<div className="aspect-video bg-neutral-900 rounded border border-neutral-800 overflow-hidden relative">
			<video
				ref={videoRef}
				autoPlay
				playsInline
				muted={true}
				controls={true}
				className="w-full h-full object-cover"
			/>
			{!isLive && (
				<div className="absolute inset-0 flex items-center justify-center bg-neutral-900">
					<div className="text-center">
						<span className="text-neutral-400">{label}</span>
						<p className="text-xs text-neutral-500 mt-1">
							{isConnected ? "Waiting for stream..." : "Connecting..."}
						</p>
					</div>
				</div>
			)}
			{isLive && (
				<div className="absolute bottom-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
					<div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>
					LIVE
				</div>
			)}
		</div>
	);
}

// Memoize to prevent unnecessary re-renders
export const WebRTCViewer = memo(WebRTCViewerComponent, (prevProps, nextProps) => {
	// Only re-render if streamId or label changes
	return prevProps.streamId === nextProps.streamId && prevProps.label === nextProps.label;
});

