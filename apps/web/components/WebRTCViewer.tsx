"use client";

import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

interface WebRTCViewerProps {
	streamId: string;
	label: string;
}

export function WebRTCViewer({ streamId, label }: WebRTCViewerProps) {
	const [isConnected, setIsConnected] = useState(false);
	const [isLive, setIsLive] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const socketRef = useRef<Socket | null>(null);
	const peerRef = useRef<RTCPeerConnection | null>(null);

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

			// Request to watch this stream
			socket.emit("watch-stream", { streamId });
		});

		socket.on("connect_error", (error) => {
			console.error(`[WebRTC Viewer ${streamId}] Connection error:`, error);
		});

		socket.on("disconnect", (reason) => {
			console.warn(`[WebRTC Viewer ${streamId}] Disconnected:`, reason);
			setIsConnected(false);
		});

		socket.on("stream-available", ({ streamId: availableStreamId }) => {
			if (availableStreamId === streamId) {
				console.log(`[WebRTC Viewer ${streamId}] Stream is available`);
				setIsLive(true);
				// Only request to watch if we don't already have a peer connection
				// The server will prevent duplicate viewer-joined events anyway
				if (!peerRef.current || peerRef.current.signalingState === "closed") {
					socket.emit("watch-stream", { streamId });
				}
			}
		});

		socket.on("stream-unavailable", ({ streamId: unavailableStreamId }) => {
			if (unavailableStreamId === streamId) {
				console.log(`[WebRTC Viewer ${streamId}] Stream is unavailable`);
				setIsLive(false);
				if (peerRef.current) {
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
			// Clean up peer connection
			if (peerRef.current) {
				peerRef.current.close();
				peerRef.current = null;
			}
			
			// Clean up video stream
			if (videoRef.current) {
				const stream = videoRef.current.srcObject as MediaStream;
				if (stream) {
					stream.getTracks().forEach(track => {
						track.stop();
						stream.removeTrack(track);
					});
				}
				videoRef.current.srcObject = null;
				videoRef.current.load();
			}
			
			// Remove all socket listeners
			socket.off("webrtc-offer");
			socket.off("webrtc-ice-candidate");
			socket.off("stream-available");
			socket.off("stream-unavailable");
			
			// Disconnect socket
			socket.disconnect();
		};
	}, [streamId]);

	const handleOffer = async (offer: RTCSessionDescriptionInit) => {
		try {
			// Close existing peer connection if one exists
			if (peerRef.current) {
				console.log(`[WebRTC Viewer ${streamId}] Closing existing peer connection`);
				peerRef.current.close();
				peerRef.current = null;
			}

			// Create peer connection
			const peer = new RTCPeerConnection({
				iceServers: [
					{ urls: "stun:stun.l.google.com:19302" },
					{ urls: "stun:stun1.l.google.com:19302" },
				],
			});

			// Handle incoming media stream
			peer.ontrack = (event) => {
				console.log(`[WebRTC Viewer ${streamId}] Received track:`, event.track.kind);
				if (videoRef.current && event.streams[0]) {
					videoRef.current.srcObject = event.streams[0];
					console.log(`[WebRTC Viewer ${streamId}] Video srcObject set`);
					
					// Force video to play
					videoRef.current.play().catch((err) => {
						console.warn(`[WebRTC Viewer ${streamId}] Autoplay prevented:`, err);
					});
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

