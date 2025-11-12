import { NextResponse } from "next/server";

// In-memory store for streaming tokens (in production, use Redis or database)
// This is shared with the generate route
declare global {
	var streamTokens: Map<string, { streamId: string; type: "artist" | "host"; expiresAt: number }> | undefined;
}

if (!global.streamTokens) {
	global.streamTokens = new Map<string, { streamId: string; type: "artist" | "host"; expiresAt: number }>();
	
	// Clean up expired tokens every 5 minutes
	setInterval(() => {
		const now = Date.now();
		for (const [token, data] of global.streamTokens!.entries()) {
			if (data.expiresAt < now) {
				global.streamTokens!.delete(token);
			}
		}
	}, 5 * 60 * 1000);
}

const streamTokens = global.streamTokens;

export async function GET(
	_req: Request,
	{ params }: { params: { token: string } }
) {
	try {
		const token = params.token;
		console.log("[Stream Token] Validating token:", token);
		console.log("[Stream Token] Store size:", streamTokens.size);
		console.log("[Stream Token] Store keys:", Array.from(streamTokens.keys()).slice(0, 5));
		
		const tokenData = streamTokens.get(token);

		if (!tokenData) {
			// Development fallback: if token looks like a direct streamId, allow it
			if (token.startsWith("artist_") || token.startsWith("host_")) {
				console.log("[Stream Token] Using direct streamId fallback:", token);
				return NextResponse.json({
					streamId: token,
					type: token.startsWith("artist_") ? "artist" : "host",
				});
			}
			
			console.log("[Stream Token] Token not found in store");
			return NextResponse.json(
				{ error: "Invalid or expired token" },
				{ status: 404 }
			);
		}

		// Check if token expired
		if (tokenData.expiresAt < Date.now()) {
			streamTokens.delete(token);
			console.log("[Stream Token] Token expired");
			return NextResponse.json(
				{ error: "Token expired" },
				{ status: 410 }
			);
		}

		console.log("[Stream Token] Token validated successfully:", tokenData);
		return NextResponse.json({
			streamId: tokenData.streamId,
			type: tokenData.type,
		});
	} catch (error) {
		console.error("[Stream Token] Error:", error);
		return NextResponse.json(
			{ error: "Failed to validate token" },
			{ status: 500 }
		);
	}
}

