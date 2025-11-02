import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
	const body = await req.json();
	const show = await prisma.show.create({
		data: {
			title: body.title,
			status: "SCHEDULED",
			artistId: body.artistId,
		},
	});
	return NextResponse.json(show);
}
