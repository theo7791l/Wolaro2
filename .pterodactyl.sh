#!/bin/bash
# Pterodactyl Startup Script for Wolaro2
# Optimized for low-RAM environments

set -e

echo "🚀 Starting Wolaro2..."

# Clone or update repo
if [[ ! -d .git ]]; then
  echo "📥 Cloning repository..."
  git clone https://github.com/theo7791l/Wolaro2 /tmp/clone
  mv /tmp/clone/* .
  mv /tmp/clone/.* . 2>/dev/null || true
  rm -rf /tmp/clone
fi

if [[ -d .git ]] && [[ "${AUTO_UPDATE}" == "1" ]]; then
  echo "🔄 Updating from git..."
  git pull
fi

# Install dependencies (without auto-build)
if [[ -f package.json ]]; then
  echo "📦 Installing dependencies..."
  npm install --omit=dev --ignore-scripts
fi

# Build only if dist/ doesn't exist
if [[ ! -d dist ]]; then
  echo "🔨 Building project (first time)..."
  echo "⚠️  This may take a while and use RAM..."
  
  # Try building with memory limit
  node --max-old-space-size=512 node_modules/.bin/tsc || {
    echo "❌ Build failed due to insufficient memory"
    echo "💡 Solution: Build locally and upload dist/ folder"
    exit 1
  }
else
  echo "✅ dist/ folder exists, skipping build"
fi

# Deploy commands
if [[ -f dist/deploy-commands.js ]]; then
  echo "📡 Deploying commands..."
  node dist/deploy-commands.js
else
  echo "⚠️  deploy-commands.js not found, skipping..."
fi

# Start bot
echo "🎉 Starting Wolaro2..."
exec node dist/index.js ${NODE_ARGS}
