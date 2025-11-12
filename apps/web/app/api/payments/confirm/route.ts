import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";
import Redis from "ioredis";
import { QUEUES } from "@live-art/config";

export async function POST(req: Request) {
	const body = await req.json();
	const { lotId, payerId, amountUsd, chain = "BASE_SEPOLIA", network, txHash } = body;
	
	// Determine chain string for Bitcoin networks
	let chainString = chain;
	if (chain?.startsWith("BITCOIN_")) {
		chainString = chain; // Already formatted
	} else if (network) {
		chainString = `BITCOIN_${network.toUpperCase()}`;
	}
	
	// Use provided txHash or generate mock
	const finalTxHash = txHash || (chainString.startsWith("BITCOIN_") ? `btc-mock-tx-${Date.now()}` : "mock-tx-hash");
	
	const payment = await prisma.payment.create({
		data: { 
			lotId, 
			payerId, 
			amountUsd, 
			chain: chainString, 
			status: txHash ? "CONFIRMED" : "PENDING", // Pending if no txHash yet
			txHash: finalTxHash
		},
	});

	// Generate platform fee for the confirmed payment
	try {
		const FEE_RATE = 0.03; // 3% on final payments
		const feeAmount = Math.floor((amountUsd || 0) * FEE_RATE);
		if (feeAmount > 0) {
			await (prisma as any).fee.create({
				data: {
					lotId,
					sourceType: "payment",
					sourceId: payment.id,
					amountUsd: feeAmount,
					feeRate: FEE_RATE,
					status: "pending",
					chain,
					metadata: JSON.stringify({ payerId }),
				},
			});
		}
	} catch (err) {
		console.error("[Fee] Failed to generate payment fee:", err);
	}
	// Move lot to SETTLING and create inscription request
	await prisma.lot.update({ where: { id: lotId }, data: { status: "SETTLING" } });
	const insReq = await prisma.inscriptionRequest.create({
		data: { lotId, status: "READY", buyerPaysFee: true },
	});
	// enqueue
	const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
	await redis.lpush(QUEUES.INSCRIBE, JSON.stringify({ requestId: insReq.id, lotId }));
	await redis.quit();
	return NextResponse.json({ payment, insReq });
}
