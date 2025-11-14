# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared package files and install
COPY services/shared/package*.json ./services/shared/
WORKDIR /app/services/shared
RUN npm ci

# Copy shared source and build
COPY services/shared/. ./
RUN npm run build || echo "No build script in shared"

# Copy template package files and install
WORKDIR /app/services/template
COPY services/template/package*.json ./
RUN npm ci

# Copy template source and build
COPY services/template/. ./
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/services/shared ./services/shared
COPY --from=builder /app/services/template/dist ./services/template/dist
COPY --from=builder /app/services/template/package*.json ./services/template/

# Install production dependencies only
WORKDIR /app/services/template
RUN npm ci --only=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 4001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start service
CMD ["node", "dist/index.js"]
