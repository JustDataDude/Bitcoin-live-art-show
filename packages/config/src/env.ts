import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  LIVEKIT_URL: z.string().optional().default(""),
  LIVEKIT_API_KEY: z.string().optional().default(""),
  LIVEKIT_API_SECRET: z.string().optional().default(""),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z.string().optional().default(""),
  INSCRIBER_BTC_RECEIVE_ADDR: z.string().optional().default(""),
  PLATFORM_FEE_BPS: z.string().optional().default("250"),
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  LIVEKIT_URL: process.env.LIVEKIT_URL,
  LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
  INSCRIBER_BTC_RECEIVE_ADDR: process.env.INSCRIBER_BTC_RECEIVE_ADDR,
  PLATFORM_FEE_BPS: process.env.PLATFORM_FEE_BPS,
});
