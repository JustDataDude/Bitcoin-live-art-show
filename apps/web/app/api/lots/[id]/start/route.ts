import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
	const auctionEndsAt = new Date(Date.now() + 60 * 1000); // 60s demo
	const lot = await prisma.lot.update({
		where: { id: params.id },
		data: { status: "LIVE", auctionEndsAt },
	});
	return NextResponse.json(lot);
}
