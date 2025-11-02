import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";

export async function GET(req: Request) {
	const url = new URL(req.url);
	const room = url.searchParams.get("room") || "demo";
	const identity = url.searchParams.get("identity") || `guest-${Date.now()}`;

	// Check for required environment variables
	const apiKey = process.env.LIVEKIT_API_KEY;
	const apiSecret = process.env.LIVEKIT_API_SECRET;
	const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

	if (!apiKey || !apiSecret || !livekitUrl) {
		console.error("[LiveKit] Missing environment variables:", {
			hasApiKey: !!apiKey,
			hasApiSecret: !!apiSecret,
			hasUrl: !!livekitUrl,
		});
		return NextResponse.json(
			{ error: "LiveKit not configured. Please set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and NEXT_PUBLIC_LIVEKIT_URL" },
			{ status: 500 }
		);
	}

	try {
		// Create access token
		const token = new AccessToken(apiKey, apiSecret, {
			identity,
			ttl: "10m", // Token valid for 10 minutes
		});

		// Grant permissions
		token.addGrant({
			roomJoin: true,
			room,
			canPublish: true,
			canSubscribe: true,
			canPublishData: true,
		});

		const jwt = await token.toJwt();

		console.log(`[LiveKit] Token generated for ${identity} in room ${room}`);

		return NextResponse.json({
			url: livekitUrl,
			token: jwt,
		});
	} catch (error) {
		console.error("[LiveKit] Error generating token:", error);
		return NextResponse.json(
			{ error: "Failed to generate token" },
			{ status: 500 }
		);
	}
}
