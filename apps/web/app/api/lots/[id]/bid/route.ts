import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";
import Redis from "ioredis";
import { channel } from "@live-art/config";

export async function POST(req: Request, { params }: { params: { id: string } }) {
	const { userId, amountUsd } = await req.json();
	const lot = await prisma.lot.findUnique({ where: { id: params.id } });
	if (!lot) return NextResponse.json({ error: "lot not found" }, { status: 404 });
	if (lot.status !== "LIVE") return NextResponse.json({ error: "lot not live" }, { status: 400 });

	const bid = await prisma.bid.create({
		data: { lotId: params.id, userId, amountUsd },
	});
	const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
	await redis.publish(
		channel.lot(params.id),
		JSON.stringify({ type: "BID_PLACED", data: { lotId: params.id, userId, amountUsd, createdAt: new Date().toISOString() } })
	);
	await redis.quit();
	return NextResponse.json(bid);
}
