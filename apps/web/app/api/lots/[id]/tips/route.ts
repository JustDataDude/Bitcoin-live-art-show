import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	try {
		const tips = await prisma.tip.findMany({
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
			take: 50, // Latest 50 tips
		});

		// Format for frontend
		const formattedTips = tips.map((tip) => ({
			userId: tip.user.handle,
			username: tip.user.username || tip.user.handle,
			amountUsd: tip.amountUsd,
			message: tip.message,
			chain: tip.chain,
			createdAt: tip.createdAt.toISOString(),
		}));

		return NextResponse.json(formattedTips);
	} catch (error) {
		console.error("[API] Error fetching tips:", error);
		return NextResponse.json({ error: "Failed to fetch tips" }, { status: 500 });
	}
}

