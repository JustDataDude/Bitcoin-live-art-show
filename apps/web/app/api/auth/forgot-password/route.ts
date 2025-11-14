import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import crypto from "crypto";

export async function POST(req: Request) {
	try {
		const { username, email } = await req.json();
		
		if (!username || typeof username !== "string") {
			return NextResponse.json(
				{ success: false, error: "Username is required" },
				{ status: 400 }
			);
		}

		// Find user by username
		const user = await prisma.user.findFirst({
			where: {
				username: username.trim(),
			},
			select: {
				id: true,
				username: true,
				email: true,
			} as any,
		}) as any;

		if (!user) {
			// Don't reveal if user exists for security
			return NextResponse.json({
				success: true,
				message: "If an account with that username exists, a password reset link has been sent.",
			});
		}

		// Check if email matches (if provided)
		if (email && user.email && user.email.toLowerCase() !== email.toLowerCase().trim()) {
			return NextResponse.json({
				success: true,
				message: "If an account with that username exists, a password reset link has been sent.",
			});
		}

		// Generate reset token
		const resetToken = crypto.randomBytes(32).toString("hex");
		const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

		// Save reset token to database
		await prisma.user.update({
			where: { id: user.id },
			data: {
				resetToken,
				resetTokenExpiry,
			} as any,
		});

		// In a real application, you would send an email here
		// For now, we'll return the reset token in the response (for development)
		// In production, remove this and send via email
		const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/reset-password?token=${resetToken}`;

		console.log(`[Password Reset] Reset link for ${user.username}: ${resetLink}`);

		return NextResponse.json({
			success: true,
			message: "If an account with that username exists, a password reset link has been sent.",
			// Remove this in production - only for development
			resetToken: process.env.NODE_ENV === "development" ? resetToken : undefined,
			resetLink: process.env.NODE_ENV === "development" ? resetLink : undefined,
		});
	} catch (error) {
		console.error("[Auth] Error requesting password reset:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to process password reset request" },
			{ status: 500 }
		);
	}
}

