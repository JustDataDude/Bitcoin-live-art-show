import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import bcrypt from "bcryptjs";

/**
 * API route to set a password for an account that doesn't have one.
 * This is used for accounts created before passwords were required.
 */
export async function POST(req: Request) {
	try {
		const { username, password } = await req.json();
		
		console.log("[Auth] Set password request for username:", username?.trim());
		
		if (!username || typeof username !== "string") {
			return NextResponse.json(
				{ success: false, error: "Username is required" },
				{ status: 400 }
			);
		}

		if (!password || typeof password !== "string" || password.length < 8) {
			return NextResponse.json(
				{ success: false, error: "Password must be at least 8 characters long" },
				{ status: 400 }
			);
		}

		const trimmedUsername = username.trim();
		
		// Find user by username
		const user = await prisma.user.findFirst({
			where: {
				username: trimmedUsername,
			},
			select: {
				id: true,
				username: true,
				handle: true,
				passwordHash: true,
			} as any,
		}) as any;

		if (!user) {
			return NextResponse.json(
				{ success: false, error: "User not found" },
				{ status: 404 }
			);
		}

		// Check if user already has a password
		if (user.passwordHash) {
			return NextResponse.json(
				{ success: false, error: "This account already has a password. Please use the login form." },
				{ status: 400 }
			);
		}

		// Hash and set the password
		const passwordHash = await bcrypt.hash(password, 10);
		
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordHash,
			} as any,
		});

		console.log(`[Auth] Password set successfully for user: ${user.username}`);

		return NextResponse.json({
			success: true,
			message: "Password has been set successfully. You can now log in.",
			user: {
				id: user.id,
				username: user.username,
				handle: user.handle,
			},
		});
	} catch (error: any) {
		console.error("[Auth] Error setting password:", error);
		return NextResponse.json(
			{ success: false, error: error?.message || "Failed to set password" },
			{ status: 500 }
		);
	}
}

