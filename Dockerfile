# ── Stage 1: Build React frontend + install all deps ──────────────────────────
FROM node:20-alpine AS builder

# Native module compilation (better-sqlite3 needs python3, make, g++)
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ── Stage 2: Production runner ─────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

# Copy node_modules with pre-compiled native binaries from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built React app
COPY --from=builder /app/dist ./dist

# Copy server source + TS config (tsx runs server.ts directly at startup)
COPY server.ts tsconfig.json ./

ENV NODE_ENV=production

# Cloud Run injects PORT at runtime; default 8080
EXPOSE 8080

CMD ["node_modules/.bin/tsx", "server.ts"]
