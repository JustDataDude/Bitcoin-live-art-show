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

		const tips = await prisma.tip.findMany({
			where,
			select: {
				amountUsd: true,
				message: true,
				chain: true,
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

		const hasMore = tips.length > limit;
		const result = hasMore ? tips.slice(0, limit) : tips;
		const nextCursor = hasMore ? result[result.length - 1].createdAt.toISOString() : null;

		// Format for frontend
		const formattedTips = result.map((tip) => ({
			userId: tip.user.handle,
			username: tip.user.username || tip.user.handle,
			amountUsd: tip.amountUsd,
			message: tip.message,
			chain: tip.chain,
			createdAt: tip.createdAt.toISOString(),
		}));

		return NextResponse.json({
			tips: formattedTips,
			nextCursor,
			hasMore,
		});
	} catch (error) {
		console.error("[API] Error fetching tips:", error);
		return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
	}
}

