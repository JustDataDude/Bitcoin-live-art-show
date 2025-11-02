import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
	try {
		const messages = await prisma.chatMessage.findMany({
			where: { lotId: params.id },
			include: {
				user: {
					select: {
						username: true,
						handle: true,
					},
				},
			},
			orderBy: { createdAt: 'asc' }, // Oldest first for chat
			take: 100, // Latest 100 messages
		});

		// Format for frontend
		const formattedMessages = messages.map((msg) => ({
			messageId: msg.id,
			userId: msg.user.handle,
			username: msg.username,
			message: msg.message,
			type: msg.type,
			ts: msg.createdAt.getTime(),
			createdAt: msg.createdAt.toISOString(),
		}));

		return NextResponse.json(formattedMessages);
	} catch (error) {
		console.error("[API] Error fetching messages:", error);
		return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
	}
}

