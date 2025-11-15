# Auth Service Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (for caching)
COPY services/auth-service/package*.json ./
RUN npm ci

# Copy Prisma schema
COPY services/auth-service/prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY services/auth-service/src ./src/
COPY services/auth-service/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Expose port
EXPOSE 4001

# Start service
CMD ["npm", "start"]
