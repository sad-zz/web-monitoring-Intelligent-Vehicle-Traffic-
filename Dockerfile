# TC Manager - Production Dockerfile
# Multi-stage build for optimized image size

FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

WORKDIR /app

# Copy package files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm ci --only=production

# Final stage
FROM node:18-alpine

# Install runtime dependencies
RUN apk add --no-cache \
    sqlite \
    postgresql-client \
    tini

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy application files
COPY --chown=nodejs:nodejs . .
COPY --from=builder --chown=nodejs:nodejs /app/server/node_modules ./server/node_modules

# Create directories
RUN mkdir -p server/uploads && \
    chown -R nodejs:nodejs server/uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); });"

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["node", "server/index.js"]
