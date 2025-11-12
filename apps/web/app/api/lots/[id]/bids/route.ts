import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
	try {
		const { searchParams } = new URL(req.url);
		const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // Max 100
		const cursor = searchParams.get('cursor'); // ISO timestamp for pagination
		
		const where: any = { lotId: params.id };
		if (cursor) {
			where.createdAt = { lt: new Date(cursor) };
		}

		const bids = await prisma.bid.findMany({
			where,
			select: {
				amountUsd: true,
				createdAt: true,
				user: {
					select: {
						username: true,
						handle: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
			take: limit + 1, // Fetch one extra to check if there's more
		});

		const hasMore = bids.length > limit;
		const result = hasMore ? bids.slice(0, limit) : bids;
		const nextCursor = hasMore ? result[result.length - 1].createdAt.toISOString() : null;

		// Format for frontend
		const formattedBids = result.map((bid) => ({
			userId: bid.user.handle,
			userHandle: bid.user.handle,
			username: bid.user.username || bid.user.handle,
			amount: bid.amountUsd,
			amountUsd: bid.amountUsd,
			createdAt: bid.createdAt.toISOString(),
		}));

		return NextResponse.json({
			bids: formattedBids,
			nextCursor,
			hasMore,
		});
	} catch (error) {
		console.error("[API] Error fetching bids:", error);
		return NextResponse.json({ error: "Failed to fetch bids" }, { status: 500 });
	}
}

