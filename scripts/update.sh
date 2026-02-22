#!/bin/bash

# Wolaro Auto-Update Script
# Pulls latest changes from GitHub and restarts the bot

set -e

COLOR_RESET="\033[0m"
COLOR_INFO="\033[36m"
COLOR_SUCCESS="\033[32m"
COLOR_WARNING="\033[33m"
COLOR_ERROR="\033[31m"

echo -e "${COLOR_INFO}==========================================="
echo -e "    Wolaro Auto-Update System"
echo -e "===========================================${COLOR_RESET}"
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${COLOR_ERROR}Error: git is not installed${COLOR_RESET}"
    exit 1
fi

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo -e "${COLOR_ERROR}Error: Not a git repository${COLOR_RESET}"
    exit 1
fi

# Get current version/commit
CURRENT_COMMIT=$(git rev-parse --short HEAD)
echo -e "${COLOR_INFO}[1/8]${COLOR_RESET} Current version: ${COLOR_WARNING}${CURRENT_COMMIT}${COLOR_RESET}"

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${COLOR_WARNING}Warning: You have uncommitted changes${COLOR_RESET}"
    echo -e "Stashing changes..."
    git stash
    STASHED=true
fi

# Fetch latest changes
echo -e "${COLOR_INFO}[2/8]${COLOR_RESET} Fetching latest changes from GitHub..."
git fetch origin main

# Check if update is available
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "${COLOR_SUCCESS}Already up to date!${COLOR_RESET}"
    if [ "$STASHED" = true ]; then
        echo -e "Restoring stashed changes..."
        git stash pop
    fi
    exit 0
fi

NEW_COMMIT=$(git rev-parse --short origin/main)
echo -e "${COLOR_SUCCESS}Update available: ${CURRENT_COMMIT} -> ${NEW_COMMIT}${COLOR_RESET}"
echo ""

# Create backup
echo -e "${COLOR_INFO}[3/8]${COLOR_RESET} Creating backup..."
BACKUP_DIR="backups/update_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r src "$BACKUP_DIR/" 2>/dev/null || true
cp package.json "$BACKUP_DIR/" 2>/dev/null || true
cp .env "$BACKUP_DIR/" 2>/dev/null || true
echo -e "${COLOR_SUCCESS}Backup created: ${BACKUP_DIR}${COLOR_RESET}"

# Pull changes
echo -e "${COLOR_INFO}[4/8]${COLOR_RESET} Pulling changes..."
git pull origin main

# Restore stashed changes if any
if [ "$STASHED" = true ]; then
    echo -e "Restoring stashed changes..."
    git stash pop || echo -e "${COLOR_WARNING}Warning: Could not restore stashed changes${COLOR_RESET}"
fi

# Install/update dependencies
echo -e "${COLOR_INFO}[5/8]${COLOR_RESET} Checking dependencies..."
if [ -f package-lock.json ]; then
    PACKAGE_CHANGED=$(git diff --name-only ${CURRENT_COMMIT}..${NEW_COMMIT} | grep -c "package.json" || true)
    if [ "$PACKAGE_CHANGED" -gt 0 ]; then
        echo -e "${COLOR_INFO}Dependencies changed, running npm install...${COLOR_RESET}"
        npm install
    else
        echo -e "${COLOR_SUCCESS}No dependency changes${COLOR_RESET}"
    fi
fi

# Build TypeScript
echo -e "${COLOR_INFO}[6/8]${COLOR_RESET} Building TypeScript..."
npm run build

# Check if migrations needed
echo -e "${COLOR_INFO}[7/8]${COLOR_RESET} Checking database migrations..."
SCHEMA_CHANGED=$(git diff --name-only ${CURRENT_COMMIT}..${NEW_COMMIT} | grep -c "schema.sql" || true)
if [ "$SCHEMA_CHANGED" -gt 0 ]; then
    echo -e "${COLOR_WARNING}Database schema changed!${COLOR_RESET}"
    echo -e "Run migrations manually: ${COLOR_INFO}npm run migrate${COLOR_RESET}"
else
    echo -e "${COLOR_SUCCESS}No schema changes${COLOR_RESET}"
fi

# Restart bot
echo -e "${COLOR_INFO}[8/8]${COLOR_RESET} Restarting bot..."
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "wolaro"; then
        pm2 restart wolaro
        echo -e "${COLOR_SUCCESS}Bot restarted via PM2${COLOR_RESET}"
    else
        echo -e "${COLOR_WARNING}PM2 process 'wolaro' not found${COLOR_RESET}"
        echo -e "Start manually: ${COLOR_INFO}npm run pm2:start${COLOR_RESET}"
    fi
else
    echo -e "${COLOR_WARNING}PM2 not found${COLOR_RESET}"
    echo -e "Restart manually or use: ${COLOR_INFO}npm run dev${COLOR_RESET}"
fi

echo ""
echo -e "${COLOR_SUCCESS}==========================================="
echo -e "    Update Complete!"
echo -e "===========================================${COLOR_RESET}"
echo ""
echo -e "Updated from ${COLOR_WARNING}${CURRENT_COMMIT}${COLOR_RESET} to ${COLOR_SUCCESS}${NEW_COMMIT}${COLOR_RESET}"
echo ""
echo -e "Changelog:"
git log --oneline ${CURRENT_COMMIT}..${NEW_COMMIT} | head -5
echo ""
