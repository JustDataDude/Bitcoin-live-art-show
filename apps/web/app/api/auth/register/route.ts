import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
	try {
		const { username, password, email, walletAddress, walletChain } = await req.json();
		
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

		// Check if username already exists
		const existingUser = await prisma.user.findFirst({
			where: {
				username: username.trim(),
			},
		});

		if (existingUser) {
			return NextResponse.json(
				{ success: false, error: "Username is already taken" },
				{ status: 400 }
			);
		}

		// Hash password
		const passwordHash = await bcrypt.hash(password, 10);

		// Generate handle - ensure uniqueness
		// For wallet-based handles, check if wallet is already linked to a user
		if (walletAddress?.trim()) {
			const existingWallet = await prisma.wallet.findFirst({
				where: {
					chain: (walletChain || "EVM").toUpperCase(),
					address: walletAddress.trim(),
				},
				include: { user: true },
			});
			
			if (existingWallet && existingWallet.user) {
				// Wallet is already linked - check if we can update the existing user
				if (existingWallet.user.username && existingWallet.user.username !== username.trim()) {
					return NextResponse.json(
						{ success: false, error: "This wallet address is already linked to another account." },
						{ status: 400 }
					);
				}
				// Use existing user's handle
				var handle = existingWallet.user.handle;
			} else {
				// Create new wallet-based handle
				var handle = `wallet_${walletChain || "EVM"}_${walletAddress.trim()}`;
			}
		} else {
			// Generate unique user handle
			var handle = `user_${Math.random().toString(36).slice(2, 10)}`;
		}
		
		// Check if handle already exists and generate a new one if needed (only for non-wallet handles)
		if (!walletAddress?.trim()) {
			let handleExists = await prisma.user.findUnique({ where: { handle } });
			let attempts = 0;
			while (handleExists && attempts < 20) {
				handle = `user_${Math.random().toString(36).slice(2, 15)}_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
				handleExists = await prisma.user.findUnique({ where: { handle } });
				attempts++;
			}
			
			if (handleExists) {
				return NextResponse.json(
					{ success: false, error: "Unable to generate unique handle. Please try again." },
					{ status: 500 }
				);
			}
		}

		// Create user
		const user = await prisma.user.create({
			data: {
				handle,
				username: username.trim(),
				passwordHash,
				email: email?.trim() || null,
				role: "viewer",
			} as any,
		});

		// Create wallet if provided
		if (walletAddress?.trim()) {
			await prisma.wallet.create({
				data: {
					userId: user.id,
					chain: (walletChain || "EVM").toUpperCase(),
					address: walletAddress.trim(),
				},
			});
		}

		return NextResponse.json({
			success: true,
			user: {
				id: user.id,
				username: user.username,
				handle: user.handle,
			},
		});
	} catch (error: any) {
		console.error("[Auth] Error registering user:", error);
		
		// Provide more specific error messages
		if (error.code === "P2002") {
			// Unique constraint violation
			if (error.meta?.target?.includes("username")) {
				return NextResponse.json(
					{ success: false, error: "Username is already taken" },
					{ status: 400 }
				);
			}
			if (error.meta?.target?.includes("handle")) {
				return NextResponse.json(
					{ success: false, error: "Handle already exists. Please try again." },
					{ status: 400 }
				);
			}
		}
		
		return NextResponse.json(
			{ success: false, error: error.message || "Failed to register user. Please check the server logs." },
			{ status: 500 }
		);
	}
}

