# ============================================
# Nimbo ERP - Dockerfile (multi-stage)
# ============================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder
RUN apk add --no-cache python3 make g++ git
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Stage 2: Runtime ----
FROM node:22-alpine AS runner
RUN apk add --no-cache python3 make g++
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -S appuser -u 1001 -G appgroup

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false

COPY --from=builder /app/dist ./dist

RUN mkdir -p /app/db-data && chown -R appuser:appgroup /app/db-data

EXPOSE 3000

USER appuser

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

VOLUME ["/app/db-data"]

CMD ["node", "dist/server.cjs"]
