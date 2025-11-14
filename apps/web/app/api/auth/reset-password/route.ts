import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
	try {
		const { token, newPassword } = await req.json();
		
		if (!token || typeof token !== "string") {
			return NextResponse.json(
				{ success: false, error: "Reset token is required" },
				{ status: 400 }
			);
		}

		if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
			return NextResponse.json(
				{ success: false, error: "Password must be at least 8 characters long" },
				{ status: 400 }
			);
		}

		// Find user by reset token
		const user = await prisma.user.findFirst({
			where: {
				resetToken: token,
				resetTokenExpiry: {
					gt: new Date(), // Token must not be expired
				},
			} as any,
		}) as any;

		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Invalid or expired reset token" },
				{ status: 400 }
			);
		}

		// Hash new password
		const passwordHash = await bcrypt.hash(newPassword, 10);

		// Update password and clear reset token
		await prisma.user.update({
			where: { id: user.id },
			data: {
				passwordHash,
				resetToken: null,
				resetTokenExpiry: null,
			} as any,
		});

		return NextResponse.json({
			success: true,
			message: "Password has been reset successfully",
		});
	} catch (error) {
		console.error("[Auth] Error resetting password:", error);
		return NextResponse.json(
			{ success: false, error: "Failed to reset password" },
			{ status: 500 }
		);
	}
}

