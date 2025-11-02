import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const body = await req.json();
	const lot = await prisma.lot.create({
		data: {
			showId: body.showId,
			title: body.title,
			description: body.description || "",
			currency: body.currency || "USD",
			status: "PREP",
			reserveUsd: body.reserveUsd ?? null,
		},
	});
	return NextResponse.json(lot);
}
