import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";

// Get all marketplace items
export async function GET() {
	try {
		// For now, return lots that have been sold (status = "SETTLED" or "SOLD")
		// In production, you'd have a separate MarketplaceItem model
		const lots = await prisma.lot.findMany({
			where: {
				status: {
					in: ["SETTLED", "SOLD", "COMPLETED"],
				},
			},
			include: {
				show: true,
				bids: {
					orderBy: {
						amountUsd: "desc",
					},
					take: 1,
					include: {
						user: true,
					},
				},
			},
		});

		// Transform lots into marketplace items
		const items = lots.map((lot: any) => {
			const topBid = lot.bids?.[0];
			const artistId = lot.show?.artistId || "unknown";
			// Generate a placeholder image URL based on lot ID (you can replace this with actual image URLs when available)
			const imageUrl = lot.imageUrl || `https://picsum.photos/seed/${lot.id}/800/800`;
			return {
				id: lot.id,
				title: lot.title || "Untitled",
				description: lot.description || "",
				artistName: `Artist ${artistId}`,
				artistId: artistId,
				currentPrice: topBid?.amountUsd || lot.reserveUsd || 0,
				royaltyRate: 10, // Default 10% royalty
				ownerId: topBid?.userId || "unknown",
				ownerName: topBid?.user?.username || topBid?.user?.handle || "Unknown",
				status: lot.status === "SOLD" ? "sold" : "available" as const,
				createdAt: lot.auctionEndsAt?.toISOString() || new Date().toISOString(),
				imageUrl: imageUrl,
			};
		});

		return NextResponse.json(items);
	} catch (error) {
		console.error("[Marketplace] Error fetching items:", error);
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		const errorStack = error instanceof Error ? error.stack : undefined;
		console.error("[Marketplace] Error details:", { errorMessage, errorStack });
		return NextResponse.json(
			{ error: "Failed to fetch marketplace items", details: errorMessage },
			{ status: 500 }
		);
	}
}

// Create a marketplace offer/trade
export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { itemId, buyerId, amountUsd, artistId } = body;

		if (!itemId || !buyerId || !amountUsd) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		// Calculate royalty (10% default)
		const royaltyRate = 0.10;
		const royaltyAmount = Math.floor(amountUsd * royaltyRate);
		const sellerAmount = amountUsd - royaltyAmount;

		// In production, you would:
		// 1. Create a Trade/Offer record
		// 2. Transfer ownership
		// 3. Process payment to seller
		// 4. Process royalty payment to artist
		// 5. Update marketplace item status

		// For now, return a mock response
		return NextResponse.json({
			success: true,
			tradeId: `trade_${Date.now()}`,
			amountUsd,
			royaltyAmount,
			sellerAmount,
			royaltyRate: royaltyRate * 100, // Return as percentage
			message: `Trade successful! Artist receives ${royaltyRate * 100}% ($${royaltyAmount}) royalty.`,
		});
	} catch (error) {
		console.error("[Marketplace] Error creating trade:", error);
		return NextResponse.json(
			{ error: "Failed to create trade" },
			{ status: 500 }
		);
	}
}

