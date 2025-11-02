import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
	const show = await prisma.show.update({
		where: { id: params.id },
		data: { status: "LIVE", startAt: new Date() },
	});
	return NextResponse.json(show);
}
