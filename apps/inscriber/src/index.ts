import Redis from "ioredis";
import { QUEUES } from "@live-art/config";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

async function work() {
  // simple BRPOP loop
  while (true) {
    const item = await redis.brpop(QUEUES.INSCRIBE, 0);
    if (!item) continue;
    const [, payload] = item;
    try {
      const job = JSON.parse(payload) as { requestId: string; lotId: string };
      // simulate processing
      console.log("inscribing", job);
      await new Promise((r) => setTimeout(r, 1500));
      console.log("inscribed", job.requestId);
      // In real app: update DB status via HTTP or direct DB
    } catch (e) {
      console.error("inscriber error", e);
    }
  }
}

work();
