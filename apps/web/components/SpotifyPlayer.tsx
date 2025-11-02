"use client";

import { useState } from "react";

interface SpotifyPlayerProps {
	defaultUri?: string;
}

export function SpotifyPlayer({ defaultUri = "playlist:37i9dQZF1DX4dyzvuaRJ0n" }: SpotifyPlayerProps) {
	const [spotifyUri, setSpotifyUri] = useState(defaultUri);
	const [inputUri, setInputUri] = useState("");
	const [isExpanded, setIsExpanded] = useState(false);
	const [loadError, setLoadError] = useState(false);

	// Convert Spotify URI or URL to embed format
	const getEmbedUrl = (uri: string) => {
		// Handle full Spotify URLs
		if (uri.includes("spotify.com")) {
			const match = uri.match(/spotify\.com\/(track|album|playlist|artist)\/([a-zA-Z0-9]+)/);
			if (match) {
				return `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
			}
		}
		
		// Handle spotify:type:id format
		if (uri.includes("spotify:")) {
			const [, type, id] = uri.split(":");
			return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
		}
		
		// Default format
		const [type, id] = uri.split(":");
		return `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;
	};

	const handleUpdateUri = () => {
		if (inputUri.trim()) {
			setSpotifyUri(inputUri.trim());
			setInputUri("");
		}
	};

	return (
		<div className="glass rounded-2xl overflow-hidden border border-green-500/20">
			{/* Header */}
			<div 
				className="px-4 py-3 bg-gradient-to-r from-green-500/10 to-emerald-500/10 flex items-center justify-between cursor-pointer"
				onClick={() => setIsExpanded(!isExpanded)}
			>
				<div className="flex items-center gap-2">
					<span className="text-2xl">🎵</span>
					<h3 className="font-bold text-white">Music Player</h3>
				</div>
				<button className="text-slate-400 hover:text-white transition-colors">
					{isExpanded ? "▼" : "▲"}
				</button>
			</div>

			{/* Spotify Player */}
			{isExpanded && (
				<div className="p-4 space-y-4 bg-black/20">
					{/* Embed Player */}
					<div className="rounded-xl overflow-hidden bg-slate-900 min-h-[200px] flex items-center justify-center">
						{loadError ? (
							<div className="text-center p-8">
								<span className="text-4xl mb-2 block">🎵</span>
								<p className="text-slate-400 text-sm mb-4">
									Spotify player couldn't load.
								</p>
								<p className="text-slate-500 text-xs">
									Please check your internet connection and try again.
								</p>
								<button
									onClick={() => setLoadError(false)}
									className="mt-4 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 text-sm hover:bg-green-500/30 transition-colors"
								>
									Retry
								</button>
							</div>
						) : (
							<iframe
								src={getEmbedUrl(spotifyUri)}
								width="100%"
								height="352"
								frameBorder="0"
								allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture; accelerometer; gyroscope"
								allowFullScreen
								loading="lazy"
								className="rounded-xl"
								title="Spotify Player"
								onError={() => {
									console.warn("Spotify iframe failed to load");
									setLoadError(true);
								}}
							/>
						)}
					</div>

					{/* Custom URI Input */}
					<div className="space-y-2">
						<p className="text-xs text-slate-400">
							💡 Paste a Spotify track, album, or playlist link to change the music
						</p>
						<div className="flex gap-2">
							<input
								type="text"
								placeholder="https://open.spotify.com/playlist/..."
								value={inputUri}
								onChange={(e) => setInputUri(e.target.value)}
								className="flex-1 bg-green-500/10 border-2 border-green-500/30 focus:border-green-500 rounded-xl px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all"
								onKeyDown={(e) => e.key === "Enter" && handleUpdateUri()}
							/>
							<button
								onClick={handleUpdateUri}
								className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-semibold px-6 py-2 rounded-xl transition-all"
							>
								Load
							</button>
						</div>
					</div>

					{/* Quick Presets */}
					<div className="space-y-2">
						<p className="text-xs text-slate-400">🎧 Quick Playlists:</p>
						<div className="grid grid-cols-2 gap-2">
							<button
								onClick={() => setSpotifyUri("playlist:37i9dQZF1DX4dyzvuaRJ0n")}
								className="bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 transition-all"
							>
								🎸 Mint 400 Records
							</button>
							<button
								onClick={() => setSpotifyUri("playlist:37i9dQZF1DX0XUsuxWHRQd")}
								className="bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 transition-all"
							>
								🎹 RapCaviar
							</button>
							<button
								onClick={() => setSpotifyUri("playlist:37i9dQZF1DX4SBhb3fqCJd")}
								className="bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 transition-all"
							>
								🔥 Hot Hits USA
							</button>
							<button
								onClick={() => setSpotifyUri("playlist:37i9dQZF1DX1s9knjP51Oa")}
								className="bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 transition-all"
							>
								🌊 Chill Vibes
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

