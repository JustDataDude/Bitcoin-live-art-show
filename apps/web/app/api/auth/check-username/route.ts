import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";

export async function POST(req: Request) {
	try {
		const { username } = await req.json();
		
		if (!username || typeof username !== "string") {
			return NextResponse.json(
				{ available: false, error: "Username is required" },
				{ status: 400 }
			);
		}

		// Check if username already exists
		const existingUser = await prisma.user.findFirst({
			where: {
				username: username.trim(),
			},
		});

		return NextResponse.json({
			available: !existingUser,
			username: username.trim(),
		});
	} catch (error) {
		console.error("[Auth] Error checking username:", error);
		return NextResponse.json(
			{ available: false, error: "Failed to check username" },
			{ status: 500 }
		);
	}
}

