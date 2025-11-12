import { NextResponse } from "next/server";
import { prisma } from "@live-art/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	try {
		const lot = await prisma.lot.findUnique({ where: { id: params.id } });
		if (!lot) {
			return NextResponse.json({ error: "Lot not found" }, { status: 404 });
		}

		// For now, use environment variable or return a default
		// In production, this would be stored per lot or show
		const paymentAddress = process.env.INSCRIBER_BTC_RECEIVE_ADDR || "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

		return NextResponse.json({ 
			address: paymentAddress,
			lotId: params.id 
		});
	} catch (error) {
		console.error("[Payment Address] Error:", error);
		return NextResponse.json(
			{ error: "Failed to fetch payment address" },
			{ status: 500 }
		);
	}
}

