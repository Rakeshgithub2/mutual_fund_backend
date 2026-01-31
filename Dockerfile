# Multi-stage Dockerfile for Node.js TypeScript application

# Base stage with Node.js
FROM node:18-alpine AS base
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

# Install all dependencies (including dev dependencies)
RUN npm install -g pnpm && \
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

# Build the application
RUN pnpm run build

# Production stage
FROM node:18-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Copy package files
COPY package*.json pnpm-lock.yaml* ./

# Install only production dependencies
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile --prod

# Copy built application and Prisma schema
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Create logs directory
RUN mkdir -p logs && \
    chown -R node:node /app

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Default command
CMD ["npm", "start"]