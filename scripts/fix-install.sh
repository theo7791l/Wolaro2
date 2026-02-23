#!/bin/bash

# Script de fix automatique pour les erreurs npm install

set -e

echo "==========================================="
echo "    Wolaro npm install Auto-Fix"
echo "==========================================="
echo ""

echo "[1/6] Cleaning npm cache..."
npm cache clean --force 2>/dev/null || true
echo "✓ Cache cleaned"
echo ""

echo "[2/6] Removing old node_modules..."
rm -rf node_modules package-lock.json 2>/dev/null || true
echo "✓ Old files removed"
echo ""

echo "[3/6] Fixing npm permissions..."
sudo chown -R $USER:$USER ~/.npm 2>/dev/null || chown -R $USER:$USER ~/.npm 2>/dev/null || true
echo "✓ Permissions fixed"
echo ""

echo "[4/6] Installing dependencies (without optional)..."
if npm install --no-optional --loglevel=error; then
    echo "✓ Core dependencies installed"
else
    echo "✗ Core dependencies failed. Trying with --force..."
    npm install --no-optional --force --loglevel=error
fi
echo ""

echo "[5/6] Attempting to install optional dependencies..."
echo "   (canvas, @discordjs/opus, bufferutil, utf-8-validate)"
echo ""

# Canvas (optionnel, souvent problématique)
if npm install canvas --save-optional 2>/dev/null; then
    echo "✓ canvas installed"
else
    echo "⚠️  canvas failed (optional, not critical)"
    echo "   To fix: sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev"
fi

# @discordjs/opus (optionnel)
if npm install @discordjs/opus --save-optional 2>/dev/null; then
    echo "✓ @discordjs/opus installed"
else
    echo "⚠️  @discordjs/opus failed (optional, not critical)"
fi

# bufferutil (optionnel)
if npm install bufferutil --save-optional 2>/dev/null; then
    echo "✓ bufferutil installed"
else
    echo "⚠️  bufferutil failed (optional, not critical)"
fi

# utf-8-validate (optionnel)
if npm install utf-8-validate --save-optional 2>/dev/null; then
    echo "✓ utf-8-validate installed"
else
    echo "⚠️  utf-8-validate failed (optional, not critical)"
fi

echo ""

echo "[6/6] Verifying installation..."
if node -e "require('discord.js')" 2>/dev/null; then
    echo "✓ discord.js OK"
else
    echo "✗ discord.js FAILED (critical)"
    exit 1
fi

if node -e "require('pg')" 2>/dev/null; then
    echo "✓ pg OK"
else
    echo "✗ pg FAILED (critical)"
    exit 1
fi

if node -e "require('redis')" 2>/dev/null; then
    echo "✓ redis OK"
else
    echo "✗ redis FAILED (critical)"
    exit 1
fi

echo ""
echo "==========================================="
echo "    Installation Fixed!"
echo "==========================================="
echo ""
echo "Optional dependencies that failed are NOT critical."
echo "You can now run: npm run build && npm run dev"
echo ""
