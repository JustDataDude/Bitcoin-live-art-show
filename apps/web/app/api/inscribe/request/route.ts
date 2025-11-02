import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import Redis from "ioredis";
import { QUEUES } from "@live-art/config";

export async function POST(req: Request) {
	const body = await req.json();
	const { lotId } = body;
	const insReq = await prisma.inscriptionRequest.create({ data: { lotId, status: "READY", buyerPaysFee: true } });
	const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
	await redis.lpush(QUEUES.INSCRIBE, JSON.stringify({ requestId: insReq.id, lotId }));
	await redis.quit();
	return NextResponse.json(insReq);
}
