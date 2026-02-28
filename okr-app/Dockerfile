# Build stage
FROM node:22-alpine AS builder

# Install build dependencies for native modules (better-sqlite3, bcrypt)
RUN apk add --no-cache python3 make g++ sqlite

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Production stage
FROM node:22-alpine AS production

# Install runtime dependencies (su-exec for dropping privileges in entrypoint)
RUN apk add --no-cache sqlite su-exec

WORKDIR /app

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ruok -u 1001 -G nodejs

# Copy built application and migration files
COPY --from=builder --chown=ruok:nodejs /app/build ./build
COPY --from=builder --chown=ruok:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=ruok:nodejs /app/package.json ./
COPY --from=builder --chown=ruok:nodejs /app/drizzle ./drizzle

# Create data directory for SQLite database
RUN mkdir -p /app/data && chown ruok:nodejs /app/data

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/okr.db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:3000/api/auth/me || exit 1

# Entrypoint fixes data dir permissions then drops to non-root user
ENTRYPOINT ["/docker-entrypoint.sh"]
