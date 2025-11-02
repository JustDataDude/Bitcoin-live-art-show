import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	const show = await prisma.show.findUnique({ where: { id: params.id } });
	if (!show) return NextResponse.json({ error: "not found" }, { status: 404 });
	return NextResponse.json(show);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
	try {
		const body = await req.json();
		const show = await prisma.show.update({
			where: { id: params.id },
			data: body,
		});
		return NextResponse.json(show);
	} catch (error) {
		console.error("Error updating show:", error);
		return NextResponse.json({ error: "Failed to update show" }, { status: 500 });
	}
}

