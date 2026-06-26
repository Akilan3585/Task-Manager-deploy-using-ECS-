# ── Stage 1: Install dependencies ──────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first (layer cache: only reinstalls when package.json changes)
COPY package*.json ./

# Install production deps only
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Lean production image ─────────────────────────────────
FROM node:20-alpine

# Create non-root user for security
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

WORKDIR /app

# Copy node_modules and source separately — avoids the lstat mount error
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

# Expose app port
EXPOSE 3500

ENV NODE_ENV=production

CMD ["node", "server.js"]
