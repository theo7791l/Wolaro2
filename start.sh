#!/bin/bash

# Wolaro2 Production Start Script
# Auto-rebuild TypeScript and start bot

echo "🚀 Starting Wolaro2..."
echo ""

# Check if dist exists and is older than src
if [ ! -d "dist" ] || [ "$(find src -type f -newer dist 2>/dev/null | wc -l)" -gt 0 ]; then
  echo "📦 Building TypeScript..."
  npm run build
  echo "✅ Build complete"
  echo ""
fi

# Start bot
echo "▶️  Starting bot..."
node dist/index.js
