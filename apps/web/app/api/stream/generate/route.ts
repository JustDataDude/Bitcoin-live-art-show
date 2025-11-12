import { NextResponse } from "next/server";

// Shared in-memory store for streaming tokens (in production, use Redis or database)
// This must match the declaration in token/[token]/route.ts
declare global {
	var streamTokens: Map<string, { streamId: string; type: "artist" | "host"; expiresAt: number }> | undefined;
}

// Use the same global store as the token validation route
if (!global.streamTokens) {
	global.streamTokens = new Map<string, { streamId: string; type: "artist" | "host"; expiresAt: number }>();
}

const streamTokens = global.streamTokens;

function createStreamToken(streamId: string, type: "artist" | "host", expiresInHours: number = 24): string {
	const token = `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
	const expiresAt = Date.now() + expiresInHours * 60 * 60 * 1000;
	
	streamTokens.set(token, {
		streamId,
		type,
		expiresAt,
	});

	console.log("[Generate Stream Token] Created token:", token, "for streamId:", streamId);
	console.log("[Generate Stream Token] Store size:", streamTokens.size);
	
	return token;
}

function getBaseUrl(req: Request) {
	const envUrl = process.env.NEXT_PUBLIC_BASE_URL;
	if (envUrl && envUrl.trim().length > 0) {
		return envUrl.replace(/\/$/, "");
	}

	try {
		const url = new URL(req.url);
		const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
		const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host ?? "localhost:3000";
		return `${proto}://${host}`;
	} catch {
		return "http://localhost:3000";
	}
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { streamId, type } = body;

		if (!streamId || !type) {
			return NextResponse.json(
				{ error: "streamId and type are required" },
				{ status: 400 }
			);
		}

		if (type !== "artist" && type !== "host") {
			return NextResponse.json(
				{ error: "type must be 'artist' or 'host'" },
				{ status: 400 }
			);
		}

		// Validate streamId format
		if (type === "artist" && !streamId.startsWith("artist_")) {
			return NextResponse.json(
				{ error: "Artist streamId must start with 'artist_'" },
				{ status: 400 }
			);
		}

		if (type === "host" && !streamId.startsWith("host_")) {
			return NextResponse.json(
				{ error: "Host streamId must start with 'host_'" },
				{ status: 400 }
			);
		}

		const token = createStreamToken(streamId, type, 24); // Expires in 24 hours
		const baseUrl = getBaseUrl(req);
		const streamUrl = `${baseUrl}/stream/${type}/${token}`;

		return NextResponse.json({
			token,
			streamId,
			type,
			url: streamUrl,
			expiresIn: "24 hours",
		});
	} catch (error) {
		console.error("[Generate Stream Token] Error:", error);
		return NextResponse.json(
			{ error: "Failed to generate stream token" },
			{ status: 500 }
		);
	}
}

