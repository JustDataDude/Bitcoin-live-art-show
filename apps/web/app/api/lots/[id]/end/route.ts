import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
	const lot = await prisma.lot.update({
		where: { id: params.id },
		data: { status: "SETTLING" },
	});
	return NextResponse.json(lot);
}
