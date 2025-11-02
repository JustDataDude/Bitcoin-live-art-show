FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
RUN pnpm install --frozen-lockfile

# Build WebSocket server
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
WORKDIR /app/apps/ws
RUN pnpm build

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Copy necessary files
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/ws/dist ./apps/ws/dist
COPY --from=builder /app/apps/ws/package.json ./apps/ws/
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages

WORKDIR /app/apps/ws

EXPOSE 4001

CMD ["node", "dist/index.js"]

