import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const app = express();
app.use(cors());
app.use(express.json());

// Fee configuration
const FEE_RATES = {
  bid: 0.05,      // 5% fee on bids
  tip: 0.10,     // 10% fee on tips
  payment: 0.03, // 3% fee on final payments
} as const;

// Helper function to check if user is admin
async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user?.role === "admin" || user?.role === "ADMIN";
  } catch {
    return false;
  }
}

// Helper function to get user from socket
async function getUserFromSocket(socket: Socket) {
  const providedHandle = typeof socket.data?.userHandle === 'string' && socket.data.userHandle.trim() ? socket.data.userHandle.trim() : null;
  if (!providedHandle) return null;
  
  try {
    return await prisma.user.findUnique({ where: { handle: providedHandle } });
  } catch {
    return null;
  }
}

// Fee generation utility
async function generateFee(params: {
  sourceType: "bid" | "tip" | "payment";
  sourceId: string;
  lotId?: string;
  amountUsd: number;
  feeRate?: number;
  chain?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const rate = params.feeRate ?? FEE_RATES[params.sourceType];
    const feeAmount = Math.floor(params.amountUsd * rate);
    
    if (feeAmount <= 0) return; // Skip if fee is zero or negative
    
    await (prisma.fee as any).create({
      data: {
        lotId: params.lotId,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        amountUsd: feeAmount,
        feeRate: rate,
        status: "pending",
        chain: params.chain,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      },
    });
    
    console.log(`[Fee] Generated ${params.sourceType} fee: $${feeAmount / 100} (${rate * 100}% of $${params.amountUsd / 100})`);
  } catch (error) {
    console.error("[Fee] Error generating fee:", error);
  }
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Helper function to get or create user by socket ID
async function getOrCreateUser(socket: Socket, username?: string) {
  const providedHandle = typeof socket.data?.userHandle === 'string' && socket.data.userHandle.trim() ? socket.data.userHandle.trim() : null;
  const handle = providedHandle || `socket_${socket.id}`;

  // Upsert to avoid race-condition on unique handle
  const user = await prisma.user.upsert({
    where: { handle },
    update: username ? { username } : {},
    create: {
      handle,
      role: "viewer",
      ...(username ? { username } : {}),
    },
  } as any);

  return user as any;
}

// WebRTC streams state
const streams: Record<string, { publisherId: string; viewers: Set<string> }> = {};

// Global banned users for this session
const bannedUsers = new Set<string>();

// Deleted message IDs (soft delete)
const deletedMessages = new Set<number>();

io.on("connection", (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);
  // Optional registration to persist identity across sessions
  socket.on("register_user", async ({ userHandle, username }: { userHandle?: string; username?: string }) => {
    try {
      if (typeof userHandle === 'string' && userHandle.trim()) {
        socket.data.userHandle = userHandle.trim();
      }
      await getOrCreateUser(socket, username);
      console.log(`[Auth] Registered user: handle=${socket.data.userHandle || `socket_${socket.id}`} username=${username || 'unchanged'}`);
    } catch (err) {
      console.error("[Auth] register_user error:", err);
    }
  });

  // Register or link a wallet address to the current user identity
  socket.on("register_wallet", async ({ chain, address, username }: { chain: string; address: string; username?: string }) => {
    try {
      const normalizedChain = (chain || '').toUpperCase();
      const normalizedAddress = (address || '').trim();
      if (!normalizedChain || !normalizedAddress) return;

      // If wallet exists, load its user; else link to current or new user
      let wallet = await prisma.wallet.findFirst({ where: { chain: normalizedChain, address: normalizedAddress } });
      let user;

      if (wallet) {
        user = await prisma.user.findUnique({ where: { id: wallet.userId } });
      }

      if (!user) {
        // Try current handle if set
        if (socket.data.userHandle) {
          user = await prisma.user.findUnique({ where: { handle: socket.data.userHandle } });
        }
      }

      if (!user) {
        // Create a new user anchored to wallet address
        const handle = `wallet_${normalizedChain}_${normalizedAddress}`;
        user = await prisma.user.upsert({
          where: { handle },
          update: {},
          create: {
            handle,
            role: "viewer",
          } as any,
        });
      }
      if (username && (user as any).username !== username) {
        user = await (prisma.user as any).update({ where: { id: user.id }, data: { username } });
      }

      // Ensure wallet record exists and is linked to user
      if (!wallet) {
        wallet = await prisma.wallet.create({
          data: {
            userId: user.id,
            chain: normalizedChain,
            address: normalizedAddress,
          },
        });
      } else if (wallet.userId !== user.id) {
        // Re-link wallet to this user if it somehow points elsewhere (rare)
        await prisma.wallet.update({ where: { id: wallet.id }, data: { userId: user.id } });
      }

      socket.data.userHandle = user.handle;
      socket.emit("wallet_registered", { ok: true, handle: user.handle, username: (user as any).username, chain: normalizedChain, address: normalizedAddress });
      console.log(`[Auth] register_wallet: ${normalizedChain}:${normalizedAddress} -> ${user.handle} (${user.username || 'no-username'})`);
    } catch (err) {
      console.error("[Auth] register_wallet error:", err);
      socket.emit("wallet_registered", { ok: false });
    }
  });

  socket.on("join_lot", ({ lotId }) => {
    socket.join(lotId);
  });

  // WebRTC Publisher Events
  socket.on("start-stream", ({ streamId, streamType }) => {
    console.log(`[WebRTC] Stream started: ${streamId} (${streamType}) by ${socket.id}`);
    
    streams[streamId] = {
      publisherId: socket.id,
      viewers: new Set(),
    };

    // Notify all viewers that stream is available
    io.emit("stream-available", { streamId });
  });

  socket.on("stop-stream", ({ streamId }) => {
    console.log(`[WebRTC] Stream stopped: ${streamId}`);
    
    if (streams[streamId]) {
      // Notify all viewers that stream is unavailable
      io.emit("stream-unavailable", { streamId });
      delete streams[streamId];
    }
  });

  // WebRTC Viewer Events
  socket.on("watch-stream", ({ streamId }) => {
    console.log(`[WebRTC] ${socket.id} wants to watch ${streamId}`);
    
    const stream = streams[streamId];
    if (stream) {
      // Check if viewer is already watching
      const wasAlreadyWatching = stream.viewers.has(socket.id);
      
      // Add viewer to stream (Set.add is idempotent, but we track it)
      stream.viewers.add(socket.id);
      
      // Only notify publisher about NEW viewers (not reconnection/re-watch attempts)
      if (!wasAlreadyWatching) {
        console.log(`[WebRTC] New viewer ${socket.id} joined stream ${streamId}`);
        io.to(stream.publisherId).emit("viewer-joined", {
          streamId,
          viewerId: socket.id,
        });
      } else {
        console.log(`[WebRTC] Viewer ${socket.id} already watching ${streamId}, skipping viewer-joined event`);
      }

      // Update viewer count
      io.to(stream.publisherId).emit("viewer-count", {
        streamId,
        count: stream.viewers.size,
      });

      // Notify viewer that stream is available
      socket.emit("stream-available", { streamId });
    } else {
      // Stream not available
      socket.emit("stream-unavailable", { streamId });
    }
  });

  // WebRTC Signaling
  socket.on("webrtc-offer", ({ streamId, viewerId, offer }) => {
    console.log(`[WebRTC] Forwarding offer from ${socket.id} to ${viewerId} for ${streamId}`);
    io.to(viewerId).emit("webrtc-offer", { streamId, offer });
  });

  socket.on("webrtc-answer", ({ streamId, answer }) => {
    console.log(`[WebRTC] Forwarding answer from ${socket.id} for ${streamId}`);
    const stream = streams[streamId];
    if (stream) {
      io.to(stream.publisherId).emit("webrtc-answer", {
        streamId,
        viewerId: socket.id,
        answer,
      });
    }
  });

  socket.on("webrtc-ice-candidate", ({ streamId, viewerId, candidate }) => {
    if (viewerId) {
      // Publisher sending ICE candidate to specific viewer
      io.to(viewerId).emit("webrtc-ice-candidate", { streamId, candidate });
    } else {
      // Viewer sending ICE candidate to publisher
      const stream = streams[streamId];
      if (stream) {
        io.to(stream.publisherId).emit("webrtc-ice-candidate", {
          streamId,
          viewerId: socket.id,
          candidate,
        });
      }
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    
    // Check if this was a publisher
    Object.keys(streams).forEach((streamId) => {
      const stream = streams[streamId];
      if (stream.publisherId === socket.id) {
        // Publisher disconnected, notify viewers
        io.emit("stream-unavailable", { streamId });
        delete streams[streamId];
      } else if (stream.viewers.has(socket.id)) {
        // Viewer disconnected
        stream.viewers.delete(socket.id);
        
        // Notify publisher
        io.to(stream.publisherId).emit("viewer-left", {
          streamId,
          viewerId: socket.id,
        });

        // Update viewer count
        io.to(stream.publisherId).emit("viewer-count", {
          streamId,
          count: stream.viewers.size,
        });
      }
    });
  });

  socket.on("place_bid", async ({ lotId, amountUsd, username }) => {
    try {
      // Get or create user
      const user = await getOrCreateUser(socket, username);
      if (!user) throw new Error('User not resolved');
      
      // Get current highest bid
      const currentHighest = await prisma.bid.findFirst({
        where: { lotId },
        orderBy: { amountUsd: 'desc' },
      });
      
      const minIncrement = Math.max(1, Math.floor((currentHighest?.amountUsd || 0) * 0.05));
      const required = (currentHighest?.amountUsd || 0) + minIncrement;
      
      if (amountUsd < required) {
        console.log(`[Bid] Rejected: $${amountUsd} is below required $${required}`);
        return; // ignore invalid bids
      }

      // Save bid to database
      const bid = await prisma.bid.create({
        data: {
          lotId,
          userId: user.id,
          amountUsd,
        },
      });

      // Generate fee for this bid
      await generateFee({
        sourceType: "bid",
        sourceId: bid.id,
        lotId,
        amountUsd,
      });

      const evt = {
        type: "BID_PLACED",
        data: { 
          lotId, 
          userId: socket.id, 
          username: (user as any).username,
          amountUsd, 
          createdAt: bid.createdAt.toISOString() 
        },
      } as const;

      io.to(lotId).emit("BID_PLACED", evt);
      console.log(`[Bid] ${(user as any).username} bid $${amountUsd} on ${lotId}`);
    } catch (error) {
      console.error("[Bid] Error:", error);
    }
  });

  socket.on("send_tip", async ({ lotId, amountUsd, username, message }) => {
    try {
      // Get or create user
      const user = await getOrCreateUser(socket, username);
      if (!user) throw new Error('User not resolved');
      
      // Save tip to database
      const tip = await (prisma.tip as any).create({
        data: {
          lotId,
          userId: user.id,
          amountUsd,
          message: message || null,
          chain: "USD", // Can be updated when real payments are integrated
        } as any,
      });

      // Generate fee for this tip
      await generateFee({
        sourceType: "tip",
        sourceId: tip.id,
        lotId,
        amountUsd,
        chain: tip.chain,
      });

      // Update lot's tip total
      await prisma.lot.update({
        where: { id: lotId },
        data: {
          tipsTotalUsd: {
            increment: amountUsd,
          },
        },
      });

      const evt = {
        type: "TIP_RECEIVED",
        data: { 
          lotId, 
          userId: socket.id, 
          username: (user as any).username,
          amountUsd, 
          message: message || '',
          chain: "USD", 
          createdAt: tip.createdAt.toISOString() 
        },
      };
      
      io.to(lotId).emit("TIP_RECEIVED", evt);
      console.log(`[Tip] ${(user as any).username} tipped $${amountUsd} on ${lotId}: "${message}"`);
    } catch (error) {
      console.error("[Tip] Error:", error);
    }
  });

  // Ban user handler
  socket.on("ban_user", ({ username }) => {
    if (username) {
      bannedUsers.add(username);
      console.log(`[Ban] User banned: ${username}`);
      io.emit("user_banned", { username });
    }
  });

  // Unban user handler
  socket.on("unban_user", ({ username }) => {
    if (username) {
      bannedUsers.delete(username);
      console.log(`[Ban] User unbanned: ${username}`);
      io.emit("user_unbanned", { username });
    }
  });

  // Delete message handler
  socket.on("delete_message", ({ messageId }) => {
    if (messageId) {
      deletedMessages.add(messageId);
      console.log(`[Chat] Message deleted: ${messageId}`);
      io.emit("message_deleted", { messageId });
    }
  });

  // Stop all streams handler (admin/studio action)
  socket.on("stop_all_streams", () => {
    console.log("[WebRTC] Stopping all streams");
    // Notify all publishers to stop their streams
    io.emit("stop_all_streams");
    // Clear all stream states
    Object.keys(streams).forEach((streamId) => {
      delete streams[streamId];
    });
  });

  socket.on("send_message", async ({ lotId, message, username }) => {
    try {
      // Check if user is banned
      if (bannedUsers.has(username)) {
        console.log(`[Chat] Blocked message from banned user: ${username}`);
        socket.emit("error", { message: "You have been banned from chat" });
        return;
      }

      // Get or create user
      const user = await getOrCreateUser(socket, username);
      if (!user) throw new Error('User not resolved');
      
      // Save chat message to database
      const chatMessage = await (prisma as any).chatMessage.create({
        data: {
          lotId,
          userId: user.id,
          username: (user as any).username,
          message,
          type: "chat",
        } as any,
      });

      const evt = {
        type: "CHAT_MESSAGE",
        data: {
          lotId,
          messageId: chatMessage.id,
          userId: socket.id,
          username: (user as any).username,
          message,
          createdAt: chatMessage.createdAt.toISOString(),
        },
      };
      
      io.to(lotId).emit("CHAT_MESSAGE", evt);
      console.log(`[Chat] ${(user as any).username}: ${message}`);
    } catch (error) {
      console.error("[Chat] Error:", error);
    }
  });

  // Admin: Get fee summary
  socket.on("admin_get_fees", async ({ status, lotId }) => {
    try {
      const user = await getUserFromSocket(socket);
      if (!user || !(await isAdmin(user.id))) {
        socket.emit("error", { message: "Unauthorized: Admin access required" });
        return;
      }

      const where: any = {};
      if (status) where.status = status;
      if (lotId) where.lotId = lotId;

      const fees = await (prisma.fee as any).findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 100, // Limit to 100 most recent
      });

      const summary = await (prisma.fee as any).groupBy({
        by: ['status'],
        _sum: { amountUsd: true },
        _count: true,
      });

      socket.emit("admin_fees", {
        fees,
        summary: summary.map((s: any) => ({
          status: s.status,
          totalAmount: s._sum.amountUsd || 0,
          count: s._count,
        })),
      });
    } catch (error) {
      console.error("[Admin] Error getting fees:", error);
      socket.emit("error", { message: "Failed to fetch fees" });
    }
  });

  // Admin: Collect fees
  socket.on("admin_collect_fees", async ({ feeIds, chain, txHash }) => {
    try {
      const user = await getUserFromSocket(socket);
      if (!user || !(await isAdmin(user.id))) {
        socket.emit("error", { message: "Unauthorized: Admin access required" });
        return;
      }

      if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
        socket.emit("error", { message: "feeIds array is required" });
        return;
      }

      // Only collect pending fees
      const pendingFees = await (prisma.fee as any).findMany({
        where: {
          id: { in: feeIds },
          status: "pending",
        },
      });

      if (pendingFees.length === 0) {
        socket.emit("error", { message: "No pending fees found to collect" });
        return;
      }

      const now = new Date();
      const totalAmount = pendingFees.reduce((sum: number, fee: any) => sum + fee.amountUsd, 0);

      // Mark fees as collected
      await (prisma.fee as any).updateMany({
        where: {
          id: { in: pendingFees.map((f) => f.id) },
        },
        data: {
          status: "collected",
          collectedAt: now,
          collectedBy: user.id,
          chain: chain || null,
          txHash: txHash || null,
        },
      });

      console.log(`[Admin] Collected ${pendingFees.length} fees totaling $${totalAmount / 100} by ${(user as any).username}`);

      socket.emit("admin_fees_collected", {
        count: pendingFees.length,
        totalAmount,
        feeIds: pendingFees.map((f: any) => f.id),
      });

      // Broadcast fee collection event to all admins
      io.emit("fees_collected", {
        count: pendingFees.length,
        totalAmount,
        collectedBy: (user as any).username,
        collectedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("[Admin] Error collecting fees:", error);
      socket.emit("error", { message: "Failed to collect fees" });
    }
  });
});

app.get("/health", (_req: any, res: any) => res.json({ ok: true }));

// REST API: Get fees summary (admin only)
app.get("/api/admin/fees", async (req: any, res: any) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];
    const status = req.query.status;
    const lotId = req.query.lotId;

    if (!userId) {
      return res.status(401).json({ error: "userId required" });
    }

    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const where: any = {};
    if (status) where.status = status;
    if (lotId) where.lotId = lotId;

    const fees = await (prisma.fee as any).findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const summary = await (prisma.fee as any).groupBy({
      by: ['status'],
      _sum: { amountUsd: true },
      _count: true,
    });

    res.json({
      fees,
      summary: summary.map((s: any) => ({
        status: s.status,
        totalAmount: s._sum.amountUsd || 0,
        count: s._count,
      })),
    });
  } catch (error) {
    console.error("[API] Error getting fees:", error);
    res.status(500).json({ error: "Failed to fetch fees" });
  }
});

// REST API: Collect fees (admin only)
app.post("/api/admin/fees/collect", async (req: any, res: any) => {
  try {
    const { userId, feeIds, chain, txHash } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "userId required" });
    }

    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    if (!feeIds || !Array.isArray(feeIds) || feeIds.length === 0) {
      return res.status(400).json({ error: "feeIds array is required" });
    }

    // Only collect pending fees
    const pendingFees = await (prisma.fee as any).findMany({
      where: {
        id: { in: feeIds },
        status: "pending",
      },
    });

    if (pendingFees.length === 0) {
      return res.status(400).json({ error: "No pending fees found to collect" });
    }

    const now = new Date();
    const totalAmount = pendingFees.reduce((sum: number, fee: any) => sum + fee.amountUsd, 0);

    // Mark fees as collected
    await (prisma.fee as any).updateMany({
      where: {
        id: { in: pendingFees.map((f) => f.id) },
      },
      data: {
        status: "collected",
        collectedAt: now,
        collectedBy: userId,
        chain: chain || null,
        txHash: txHash || null,
      },
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    console.log(`[Admin] Collected ${pendingFees.length} fees totaling $${totalAmount / 100} by ${(user as any)?.username || userId}`);

    // Broadcast fee collection event to all connected clients
    io.emit("fees_collected", {
      count: pendingFees.length,
      totalAmount,
      collectedBy: (user as any)?.username || userId,
      collectedAt: now.toISOString(),
    });

    res.json({
      success: true,
      count: pendingFees.length,
      totalAmount,
      feeIds: pendingFees.map((f) => f.id),
    });
  } catch (error) {
    console.error("[API] Error collecting fees:", error);
    res.status(500).json({ error: "Failed to collect fees" });
  }
});

// REST API: Get fee statistics
app.get("/api/admin/fees/stats", async (req: any, res: any) => {
  try {
    const userId = req.query.userId || req.headers['x-user-id'];

    if (!userId) {
      return res.status(401).json({ error: "userId required" });
    }

    if (!(await isAdmin(userId))) {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    const [pendingStats, collectedStats, allFees] = await Promise.all([
      (prisma.fee as any).aggregate({
        where: { status: "pending" },
        _sum: { amountUsd: true },
        _count: true,
      }),
      (prisma.fee as any).aggregate({
        where: { status: "collected" },
        _sum: { amountUsd: true },
        _count: true,
      }),
      (prisma.fee as any).groupBy({
        by: ['sourceType'],
        _sum: { amountUsd: true },
        _count: true,
        where: { status: "collected" },
      }),
    ]);

    res.json({
      pending: {
        totalAmount: pendingStats._sum.amountUsd || 0,
        count: pendingStats._count || 0,
      },
      collected: {
        totalAmount: collectedStats._sum.amountUsd || 0,
        count: collectedStats._count || 0,
      },
      bySource: allFees.map((s: any) => ({
        sourceType: s.sourceType,
        totalAmount: s._sum.amountUsd || 0,
        count: s._count,
      })),
    });
  } catch (error) {
    console.error("[API] Error getting fee stats:", error);
    res.status(500).json({ error: "Failed to fetch fee statistics" });
  }
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 4001;
httpServer.listen(PORT, () => console.log(`ws listening on :${PORT}`));
