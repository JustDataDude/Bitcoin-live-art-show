import { prisma } from "@live-art/db";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: { id: string } }) {
	try {
		const { searchParams } = new URL(req.url);
		const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200); // Max 200
		const cursor = searchParams.get('cursor'); // ISO timestamp for pagination
		
		const where: any = { lotId: params.id };
		if (cursor) {
			where.createdAt = { gt: new Date(cursor) }; // For ascending order, get newer than cursor
		}

		const messages = await prisma.chatMessage.findMany({
			where,
			select: {
				id: true,
				username: true,
				message: true,
				type: true,
				createdAt: true,
				user: {
					select: {
						handle: true,
					},
				},
			},
			orderBy: { createdAt: 'asc' }, // Oldest first for chat
			take: limit + 1, // Fetch one extra to check if there's more
		});

		const hasMore = messages.length > limit;
		const result = hasMore ? messages.slice(0, limit) : messages;
		const nextCursor = hasMore ? result[result.length - 1].createdAt.toISOString() : null;

		// Format for frontend
		const formattedMessages = result.map((msg) => ({
			messageId: msg.id,
			userId: msg.user.handle,
			username: msg.username,
			message: msg.message,
			type: msg.type,
			ts: msg.createdAt.getTime(),
			createdAt: msg.createdAt.toISOString(),
		}));

		return NextResponse.json({
			messages: formattedMessages,
			nextCursor,
			hasMore,
		});
	} catch (error) {
		console.error("[API] Error fetching messages:", error);
		return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
	}
}

