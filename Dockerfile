# ============================================
# Stage 1: Build Frontend
# ============================================
FROM node:20-alpine AS frontend-builder

# Accept build arguments
ARG DEV_BYPASS_AUTH=false

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# Create .env file in parent directory for Vite to pick up
RUN mkdir -p /app && echo "DEV_BYPASS_AUTH=${DEV_BYPASS_AUTH}" > /app/.env

RUN npm run build
# Output: /app/frontend/dist

# ============================================
# Stage 2: Build Backend
# ============================================
FROM node:20-alpine AS backend-builder

WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci

COPY backend/ ./
RUN npm run build
# Output: /app/backend/dist

# ============================================
# Stage 3: Production Runtime
# ============================================
FROM node:20-alpine

WORKDIR /app

# Copy backend package files
COPY backend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built backend
COPY --from=backend-builder /app/backend/dist ./dist

# Copy built frontend (served as static files)
COPY --from=frontend-builder /app/frontend/dist ./public

# Environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/server.js"]
