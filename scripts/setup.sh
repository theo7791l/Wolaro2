#!/bin/bash

echo "========================================"
echo "  Wolaro - Installation Script"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js $(node --version) detected"

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️ PostgreSQL not found. Please install PostgreSQL 15+."
fi

# Check if Redis is installed
if ! command -v redis-cli &> /dev/null; then
    echo "⚠️ Redis not found. Please install Redis 7+."
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created. Please edit it with your credentials."
else
    echo "✓ .env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✓ Logs directory created"

# Build TypeScript
echo ""
echo "Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Failed to build"
    exit 1
fi

echo "✓ Build completed"

echo ""
echo "========================================"
echo "  Installation Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Discord bot token and database credentials"
echo "2. Setup PostgreSQL database and run migrations"
echo "3. Start the bot with: npm start"
echo ""
echo "For production: npm run start:cluster"
echo "For Docker: docker-compose up -d"
echo ""
