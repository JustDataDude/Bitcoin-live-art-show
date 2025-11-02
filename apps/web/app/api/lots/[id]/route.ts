import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	const lot = await prisma.lot.findUnique({ where: { id: params.id } });
	if (!lot) return NextResponse.json({ error: "not found" }, { status: 404 });
	return NextResponse.json(lot);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
	const body = await req.json();
	const lot = await prisma.lot.update({
		where: { id: params.id },
		data: body,
	});
	return NextResponse.json(lot);
}