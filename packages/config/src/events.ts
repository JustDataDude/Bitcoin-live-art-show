export type AuctionEventType =
  | "BID_PLACED"
  | "OUTBID"
  | "CLOCK_TICK"
  | "TIP_RECEIVED"
  | "LOT_ENDED";

export interface BidPlacedPayload {
  lotId: string;
  userId: string;
  amountUsd: number;
  createdAt: string;
}

export interface TipReceivedPayload {
  lotId: string;
  userId: string;
  amountUsd: number;
  chain: string;
  txHash?: string;
  createdAt: string;
}

export type AuctionEventPayload =
  | { type: "BID_PLACED"; data: BidPlacedPayload }
  | { type: "OUTBID"; data: { lotId: string; userId: string; amountUsd: number } }
  | { type: "CLOCK_TICK"; data: { lotId: string; secondsRemaining: number } }
  | { type: "TIP_RECEIVED"; data: TipReceivedPayload }
  | { type: "LOT_ENDED"; data: { lotId: string; sold: boolean; finalUsd?: number } };

export const channel = {
  show: (id: string) => `show:${id}`,
  lot: (id: string) => `lot:${id}`,
};

export const QUEUES = {
  INSCRIBE: "queue:inscribe",
} as const;
