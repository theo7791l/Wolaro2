#!/bin/bash

# Script de test d'installation Wolaro
# Détecte TOUTES les erreurs npm install possibles

set +e  # Ne pas arrêter sur erreur (on veut capturer toutes les erreurs)

echo "==========================================="
echo "    Wolaro Installation Test"
echo "==========================================="
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERROR_COUNT=0
WARNING_COUNT=0

# Test 1: Node.js version
echo "[Test 1/10] Checking Node.js version..."
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ]; then
    echo -e "${RED}✗ Node.js not found${NC}"
    ERROR_COUNT=$((ERROR_COUNT + 1))
elif [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}✗ Node.js version too old (need 20+, found $NODE_VERSION)${NC}"
    ERROR_COUNT=$((ERROR_COUNT + 1))
else
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
fi
echo ""

# Test 2: npm version
echo "[Test 2/10] Checking npm version..."
NPM_VERSION=$(npm -v 2>/dev/null | cut -d'.' -f1)
if [ -z "$NPM_VERSION" ]; then
    echo -e "${RED}✗ npm not found${NC}"
    ERROR_COUNT=$((ERROR_COUNT + 1))
elif [ "$NPM_VERSION" -lt 9 ]; then
    echo -e "${YELLOW}⚠ npm version old (need 9+, found $NPM_VERSION)${NC}"
    WARNING_COUNT=$((WARNING_COUNT + 1))
else
    echo -e "${GREEN}✓ npm $(npm -v)${NC}"
fi
echo ""

# Test 3: Python (requis pour node-gyp)
echo "[Test 3/10] Checking Python (for node-gyp)..."
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓ Python3 found: $(python3 --version)${NC}"
elif command -v python &> /dev/null; then
    echo -e "${GREEN}✓ Python found: $(python --version)${NC}"
else
    echo -e "${YELLOW}⚠ Python not found (needed for native modules like canvas)${NC}"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi
echo ""

# Test 4: Build tools (gcc, make)
echo "[Test 4/10] Checking build tools..."
if command -v gcc &> /dev/null && command -v make &> /dev/null; then
    echo -e "${GREEN}✓ Build tools found (gcc, make)${NC}"
else
    echo -e "${YELLOW}⚠ Build tools missing (needed for native modules)${NC}"
    echo "   Install with: sudo apt-get install build-essential"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi
echo ""

# Test 5: Canvas dependencies
echo "[Test 5/10] Checking canvas dependencies..."
MISSING_LIBS=""
for lib in libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev; do
    if ! dpkg -s $lib &> /dev/null && ! rpm -q $lib &> /dev/null; then
        MISSING_LIBS="$MISSING_LIBS $lib"
    fi
done

if [ -z "$MISSING_LIBS" ]; then
    echo -e "${GREEN}✓ Canvas dependencies found${NC}"
else
    echo -e "${YELLOW}⚠ Missing canvas dependencies:$MISSING_LIBS${NC}"
    echo "   Install with: sudo apt-get install$MISSING_LIBS"
    WARNING_COUNT=$((WARNING_COUNT + 1))
fi
echo ""

# Test 6: PostgreSQL
echo "[Test 6/10] Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    echo -e "${GREEN}✓ PostgreSQL found: $(psql --version)${NC}"
else
    echo -e "${RED}✗ PostgreSQL not found${NC}"
    echo "   Install with: sudo apt-get install postgresql-15"
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi
echo ""

# Test 7: Redis
echo "[Test 7/10] Checking Redis..."
if command -v redis-cli &> /dev/null; then
    echo -e "${GREEN}✓ Redis found: $(redis-cli --version)${NC}"
else
    echo -e "${RED}✗ Redis not found${NC}"
    echo "   Install with: sudo apt-get install redis-server"
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi
echo ""

# Test 8: Disk space
echo "[Test 8/10] Checking disk space..."
AVAIL_SPACE=$(df -BM . | tail -1 | awk '{print $4}' | sed 's/M//')
if [ "$AVAIL_SPACE" -lt 500 ]; then
    echo -e "${RED}✗ Low disk space (${AVAIL_SPACE}MB available, need 500MB+)${NC}"
    ERROR_COUNT=$((ERROR_COUNT + 1))
else
    echo -e "${GREEN}✓ Disk space OK (${AVAIL_SPACE}MB available)${NC}"
fi
echo ""

# Test 9: npm install (dry-run)
echo "[Test 9/10] Testing npm install (dry-run)..."
npm install --dry-run > /tmp/wolaro-npm-test.log 2>&1
NPM_EXIT_CODE=$?

if [ $NPM_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ npm install simulation successful${NC}"
else
    echo -e "${RED}✗ npm install will fail${NC}"
    echo "   Error details in /tmp/wolaro-npm-test.log"
    ERROR_COUNT=$((ERROR_COUNT + 1))
    
    # Analyse des erreurs courantes
    if grep -q "EACCES" /tmp/wolaro-npm-test.log; then
        echo -e "${YELLOW}   → Permission error detected. Try: sudo chown -R \$USER ~/.npm${NC}"
    fi
    if grep -q "canvas" /tmp/wolaro-npm-test.log; then
        echo -e "${YELLOW}   → Canvas build error. Install dependencies or use --no-optional${NC}"
    fi
    if grep -q "gyp" /tmp/wolaro-npm-test.log; then
        echo -e "${YELLOW}   → node-gyp error. Install build tools and Python${NC}"
    fi
    if grep -q "ERESOLVE" /tmp/wolaro-npm-test.log; then
        echo -e "${YELLOW}   → Dependency conflict. Already handled by .npmrc (legacy-peer-deps)${NC}"
    fi
fi
echo ""

# Test 10: .npmrc configuration
echo "[Test 10/10] Checking .npmrc configuration..."
if [ -f ".npmrc" ]; then
    if grep -q "legacy-peer-deps=true" .npmrc && grep -q "optional=true" .npmrc; then
        echo -e "${GREEN}✓ .npmrc correctly configured${NC}"
    else
        echo -e "${YELLOW}⚠ .npmrc missing important flags${NC}"
        WARNING_COUNT=$((WARNING_COUNT + 1))
    fi
else
    echo -e "${RED}✗ .npmrc not found${NC}"
    ERROR_COUNT=$((ERROR_COUNT + 1))
fi
echo ""

# Résumé
echo "==========================================="
echo "           Test Summary"
echo "==========================================="
echo -e "Errors: ${RED}$ERROR_COUNT${NC}"
echo -e "Warnings: ${YELLOW}$WARNING_COUNT${NC}"
echo ""

if [ $ERROR_COUNT -eq 0 ] && [ $WARNING_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! npm install should work.${NC}"
    echo ""
    echo "Run: npm install"
    exit 0
elif [ $ERROR_COUNT -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Some warnings detected. npm install may have issues with optional dependencies.${NC}"
    echo ""
    echo "You can try:"
    echo "  - npm install --no-optional  (skip optional deps like canvas)"
    echo "  - npm install                (proceed anyway)"
    exit 0
else
    echo -e "${RED}❌ Critical errors detected. Fix them before running npm install.${NC}"
    echo ""
    echo "Quick fixes:"
    echo "  1. Install Node.js 20+: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  2. Install PostgreSQL: sudo apt-get install postgresql-15"
    echo "  3. Install Redis: sudo apt-get install redis-server"
    echo "  4. Install build tools: sudo apt-get install build-essential python3"
    exit 1
fi
