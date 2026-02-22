#!/bin/bash

# Wolaro Setup Script
# This script sets up the development environment

set -e

echo "==========================================="
echo "    Wolaro Setup Script"
echo "==========================================="
echo ""

# Check Node.js version
echo "[1/7] Checking Node.js version..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "Error: Node.js 20+ is required (current: v$NODE_VERSION)"
    exit 1
fi
echo "✓ Node.js $(node -v) detected"
echo ""

# Check PostgreSQL
echo "[2/7] Checking PostgreSQL..."
if ! command -v psql &> /dev/null; then
    echo "Warning: PostgreSQL not found. Please install PostgreSQL 15+"
else
    echo "✓ PostgreSQL detected"
fi
echo ""

# Check Redis
echo "[3/7] Checking Redis..."
if ! command -v redis-cli &> /dev/null; then
    echo "Warning: Redis not found. Please install Redis 7+"
else
    echo "✓ Redis detected"
fi
echo ""

# Install dependencies
echo "[4/7] Installing dependencies..."
npm install
echo "✓ Dependencies installed"
echo ""

# Create .env file
echo "[5/7] Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ .env file created from .env.example"
    echo "Please edit .env with your configuration:"
    echo "  - DISCORD_TOKEN"
    echo "  - DB_PASSWORD"
    echo "  - GEMINI_API_KEY (for AI module)"
    echo "  - ENCRYPTION_KEY (32+ chars)"
    echo "  - API_JWT_SECRET (32+ chars)"
else
    echo "✓ .env file already exists"
fi
echo ""

# Create logs directory
echo "[6/7] Creating directories..."
mkdir -p logs
echo "✓ Logs directory created"
echo ""

# Build TypeScript
echo "[7/7] Building TypeScript..."
npm run build
echo "✓ TypeScript compiled"
echo ""

echo "==========================================="
echo "    Setup Complete!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "  1. Edit .env file with your credentials"
echo "  2. Run migrations: npm run migrate"
echo "  3. Start bot: npm run dev"
echo ""
echo "For production:"
echo "  - Docker: npm run docker:up"
echo "  - PM2: npm run pm2:start"
echo ""
