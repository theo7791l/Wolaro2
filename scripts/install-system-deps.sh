#!/bin/bash

# Installation automatique des dépendances système pour Wolaro

set -e

echo "==========================================="
echo "    System Dependencies Installer"
echo "==========================================="
echo ""

# Détection de l'OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    echo "Cannot detect OS. Please install dependencies manually."
    exit 1
fi

echo "Detected OS: $OS"
echo ""

if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    echo "[1/5] Updating package list..."
    sudo apt-get update -qq
    
    echo "[2/5] Installing Node.js 20..."
    if ! command -v node &> /dev/null || [ $(node -v | cut -d'v' -f2 | cut -d'.' -f1) -lt 20 ]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "   Node.js 20+ already installed"
    fi
    
    echo "[3/5] Installing PostgreSQL 15..."
    if ! command -v psql &> /dev/null; then
        sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
        wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null
        sudo apt-get update -qq
        sudo apt-get install -y postgresql-15
        sudo systemctl enable postgresql
        sudo systemctl start postgresql
    else
        echo "   PostgreSQL already installed"
    fi
    
    echo "[4/5] Installing Redis..."
    if ! command -v redis-cli &> /dev/null; then
        sudo apt-get install -y redis-server
        sudo systemctl enable redis-server
        sudo systemctl start redis-server
    else
        echo "   Redis already installed"
    fi
    
    echo "[5/5] Installing build tools and canvas dependencies..."
    sudo apt-get install -y \
        build-essential \
        python3 \
        python3-pip \
        libcairo2-dev \
        libpango1.0-dev \
        libjpeg-dev \
        libgif-dev \
        librsvg2-dev \
        pkg-config
    
elif [ "$OS" = "fedora" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    echo "[1/5] Installing Node.js 20..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
    fi
    
    echo "[2/5] Installing PostgreSQL 15..."
    if ! command -v psql &> /dev/null; then
        sudo dnf install -y postgresql15-server postgresql15
        sudo postgresql-setup --initdb
        sudo systemctl enable postgresql
        sudo systemctl start postgresql
    fi
    
    echo "[3/5] Installing Redis..."
    if ! command -v redis-cli &> /dev/null; then
        sudo dnf install -y redis
        sudo systemctl enable redis
        sudo systemctl start redis
    fi
    
    echo "[4/5] Installing build tools..."
    sudo dnf groupinstall -y "Development Tools"
    sudo dnf install -y python3 python3-pip
    
    echo "[5/5] Installing canvas dependencies..."
    sudo dnf install -y cairo-devel pango-devel libjpeg-turbo-devel giflib-devel
    
elif [ "$OS" = "arch" ] || [ "$OS" = "manjaro" ]; then
    echo "[1/4] Installing Node.js..."
    sudo pacman -Syu --noconfirm nodejs npm
    
    echo "[2/4] Installing PostgreSQL..."
    sudo pacman -S --noconfirm postgresql
    sudo -u postgres initdb -D /var/lib/postgres/data
    sudo systemctl enable postgresql
    sudo systemctl start postgresql
    
    echo "[3/4] Installing Redis..."
    sudo pacman -S --noconfirm redis
    sudo systemctl enable redis
    sudo systemctl start redis
    
    echo "[4/4] Installing build tools and canvas dependencies..."
    sudo pacman -S --noconfirm base-devel python cairo pango libjpeg-turbo giflib librsvg
    
else
    echo "Unsupported OS: $OS"
    echo "Please install manually:"
    echo "  - Node.js 20+"
    echo "  - PostgreSQL 15+"
    echo "  - Redis 7+"
    echo "  - Build tools (gcc, make, python3)"
    echo "  - Canvas dependencies (cairo, pango, jpeg, gif, rsvg)"
    exit 1
fi

echo ""
echo "==========================================="
echo "    System Dependencies Installed!"
echo "==========================================="
echo ""
echo "Next steps:"
echo "  1. npm install"
echo "  2. cp .env.example .env && nano .env"
echo "  3. npm run migrate"
echo "  4. npm run dev"
echo ""
