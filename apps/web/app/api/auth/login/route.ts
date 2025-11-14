import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
	try {
		const { username, password } = await req.json();
		
		console.log("[Auth] Login attempt for username:", username?.trim());
		
		if (!username || typeof username !== "string") {
			console.log("[Auth] Login failed: Username is required");
			return NextResponse.json(
				{ success: false, error: "Username is required" },
				{ status: 400 }
			);
		}

		if (!password || typeof password !== "string") {
			console.log("[Auth] Login failed: Password is required");
			return NextResponse.json(
				{ success: false, error: "Password is required" },
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
			console.log(`[Auth] Login failed: User not found for username: ${trimmedUsername}`);
			return NextResponse.json(
				{ success: false, error: "Invalid username or password" },
				{ status: 401 }
			);
		}

		console.log(`[Auth] User found: ${user.username}, has password: ${!!user.passwordHash}`);

		// Check if user has a password (for backward compatibility with existing users)
		if (!user.passwordHash) {
			console.log(`[Auth] Login failed: User ${user.username} doesn't have a password set`);
			return NextResponse.json(
				{ 
					success: false, 
					error: "This account doesn't have a password set. Please use 'Forgot Password' to set one, or create a new account.",
					needsPassword: true 
				},
				{ status: 401 }
			);
		}

		// Verify password
		const isValidPassword = await bcrypt.compare(password, user.passwordHash);
		
		console.log(`[Auth] Password verification result: ${isValidPassword}`);
		
		if (!isValidPassword) {
			console.log(`[Auth] Login failed: Invalid password for user ${user.username}`);
			return NextResponse.json(
				{ success: false, error: "Invalid username or password" },
				{ status: 401 }
			);
		}

		console.log(`[Auth] Login successful for user: ${user.username}`);
		
		return NextResponse.json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				handle: user.handle,
			},
		});
	} catch (error: any) {
		console.error("[Auth] Error logging in:", error);
		console.error("[Auth] Error details:", error?.message, error?.stack);
		return NextResponse.json(
			{ success: false, error: error?.message || "Failed to login" },
			{ status: 500 }
		);
	}
}

