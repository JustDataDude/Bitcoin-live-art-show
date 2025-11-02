import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	try {
		const bids = await prisma.bid.findMany({
			where: { lotId: params.id },
			include: {
				user: {
					select: {
						username: true,
						handle: true,
					},
				},
			},
			orderBy: { createdAt: 'desc' },
			take: 50, // Latest 50 bids
		});

		// Format for frontend
		const formattedBids = bids.map((bid) => ({
			userId: bid.user.handle,
			userHandle: bid.user.handle,
			username: bid.user.username || bid.user.handle,
			amount: bid.amountUsd,
			amountUsd: bid.amountUsd,
			createdAt: bid.createdAt.toISOString(),
		}));

		return NextResponse.json(formattedBids);
	} catch (error) {
		console.error("[API] Error fetching bids:", error);
		return NextResponse.json({ error: "Failed to fetch bids" }, { status: 500 });
	}
}

