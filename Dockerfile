# SECURITY UPDATE: Node.js 20.18.1 (January 2026 security release)
# Fixes 8 CVEs including buffer memory leak, HTTP/2 DoS, and TLS vulnerabilities
FROM node:20.18.1-alpine

# Install dependencies for native modules (including canvas and opus)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev \
    pixman-dev \
    libtool \
    autoconf \
    automake \
    opus-dev \
    pkgconfig

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm install

# Copy source code
COPY src ./src

# Build TypeScript (requires tsc from devDependencies)
RUN npm run build

# Remove dev dependencies after build
RUN npm prune --production

# Create logs directory
RUN mkdir -p /app/logs

# Expose ports
EXPOSE 3000 3001

# Health check with better timeout for startup
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "dist/index.js"]
