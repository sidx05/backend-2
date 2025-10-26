## Multi-stage Dockerfile
## Builder: install deps (including dev) and build the TypeScript output
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install full deps for build
COPY package*.json ./
# Install dependencies but skip lifecycle scripts (postinstall runs `npm run build` and
# the source isn't copied yet). We'll run build explicitly after copying the source.
RUN npm ci --ignore-scripts

# Copy rest of the app
COPY . .

# Run the build (produces /app/dist)
RUN npm run build

# Copy non-TS assets required at runtime (e.g., Swagger YAML)
RUN mkdir -p dist/config \
  && cp -f src/config/swagger.yaml dist/config/swagger.yaml

# Production image: copy only what's needed
FROM node:20-alpine AS runner
WORKDIR /app

# Copy package.json and production node_modules from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Copy built files and healthcheck
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/healthcheck.js ./healthcheck.js

# Create logs directory (optional)
RUN mkdir -p logs

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

USER nextjs

# Expose port used by the app (Render/most hosts provide PORT env)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js || exit 1

# Start the application
CMD ["node", "dist/index.js"]