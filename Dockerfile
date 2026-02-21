# Multi-stage Dockerfile for Node.js TypeScript Backend

# Base stage with Node.js
FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies and build tools
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Development stage
FROM base AS development
ENV NODE_ENV=development

# Install pnpm and all dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Development command
CMD ["pnpm", "run", "dev"]

# Build stage
FROM development AS build
ENV NODE_ENV=production

# Build the TypeScript application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN corepack enable pnpm && \
    pnpm install --frozen-lockfile --prod

# Copy built application and necessary files
COPY --from=build /app/src ./src
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Create logs directory
RUN mkdir -p logs && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "start"]