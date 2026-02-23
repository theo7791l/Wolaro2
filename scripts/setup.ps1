# Wolaro2 Setup Script for Windows
# Run this script in PowerShell to set up the bot

$ErrorActionPreference = "Stop"

Write-Host "🚀 Wolaro2 Setup Script" -ForegroundColor Cyan
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Not running as Administrator" -ForegroundColor Yellow
    Write-Host "   Some features may require administrator privileges" -ForegroundColor Yellow
    Write-Host ""
}

# Check Node.js
Write-Host "🔍 Checking Node.js..." -ForegroundColor Green
try {
    $nodeVersion = node --version
    Write-Host "   ✅ Node.js found: $nodeVersion" -ForegroundColor Green
    
    # Extract major version
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 20) {
        Write-Host "   ❌ Node.js version must be 20 or higher" -ForegroundColor Red
        Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "   ❌ Node.js not found" -ForegroundColor Red
    Write-Host "   Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Check npm
Write-Host "🔍 Checking npm..." -ForegroundColor Green
try {
    $npmVersion = npm --version
    Write-Host "   ✅ npm found: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ npm not found" -ForegroundColor Red
    exit 1
}

# Check Git
Write-Host "🔍 Checking Git..." -ForegroundColor Green
try {
    $gitVersion = git --version
    Write-Host "   ✅ Git found: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Git not found (optional)" -ForegroundColor Yellow
}

# Check Docker (optional)
Write-Host "🔍 Checking Docker..." -ForegroundColor Green
try {
    $dockerVersion = docker --version
    Write-Host "   ✅ Docker found: $dockerVersion" -ForegroundColor Green
    $hasDocker = $true
} catch {
    Write-Host "   ⚠️  Docker not found (optional but recommended)" -ForegroundColor Yellow
    $hasDocker = $false
}

Write-Host ""
Write-Host "===========================" -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "📄 Creating .env file..." -ForegroundColor Green
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "   ✅ Created .env from .env.example" -ForegroundColor Green
        Write-Host "   📝 Please edit .env and fill in your configuration" -ForegroundColor Yellow
        Write-Host ""
        
        # Ask if user wants to edit now
        $edit = Read-Host "Do you want to edit .env now? (y/n)"
        if ($edit -eq "y" -or $edit -eq "Y") {
            notepad .env
        }
    } else {
        Write-Host "   ❌ .env.example not found" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "   ✅ .env file already exists" -ForegroundColor Green
}

Write-Host ""

# Ask user for installation method
if ($hasDocker) {
    Write-Host "Choose installation method:" -ForegroundColor Cyan
    Write-Host "1. Docker (Recommended)" -ForegroundColor Green
    Write-Host "2. Local (Requires PostgreSQL and Redis)" -ForegroundColor Yellow
    Write-Host ""
    $choice = Read-Host "Enter choice (1 or 2)"
    
    if ($choice -eq "1") {
        # Docker installation
        Write-Host ""
        Write-Host "🐳 Starting Docker installation..." -ForegroundColor Cyan
        Write-Host ""
        
        try {
            Write-Host "Building and starting containers..." -ForegroundColor Green
            docker-compose up -d --build
            
            Write-Host ""
            Write-Host "✅ Docker containers started successfully!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Useful commands:" -ForegroundColor Cyan
            Write-Host "  - View logs: docker-compose logs -f bot" -ForegroundColor White
            Write-Host "  - Stop: docker-compose down" -ForegroundColor White
            Write-Host "  - Restart: docker-compose restart bot" -ForegroundColor White
            Write-Host ""
        } catch {
            Write-Host "❌ Docker installation failed" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
            exit 1
        }
    } else {
        # Local installation
        Write-Host ""
        Write-Host "💻 Starting local installation..." -ForegroundColor Cyan
        Write-Host ""
        
        Write-Host "⚠️  Make sure PostgreSQL and Redis are running!" -ForegroundColor Yellow
        Write-Host ""
        
        $continue = Read-Host "Continue? (y/n)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 0
        }
        
        # Install dependencies
        Write-Host "📦 Installing dependencies..." -ForegroundColor Green
        npm install
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ npm install failed" -ForegroundColor Red
            exit 1
        }
        
        # Build TypeScript
        Write-Host "🔨 Building TypeScript..." -ForegroundColor Green
        npm run build
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "❌ Build failed" -ForegroundColor Red
            exit 1
        }
        
        Write-Host ""
        Write-Host "✅ Installation completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "To start the bot:" -ForegroundColor Cyan
        Write-Host "  - Development: npm run dev" -ForegroundColor White
        Write-Host "  - Production: npm start" -ForegroundColor White
        Write-Host ""
    }
} else {
    # No Docker, only local installation
    Write-Host "💻 Starting local installation..." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "⚠️  You need to install PostgreSQL and Redis manually" -ForegroundColor Yellow
    Write-Host "   PostgreSQL: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "   Redis: https://github.com/tporadowski/redis/releases (or use WSL2)" -ForegroundColor White
    Write-Host ""
    
    $continue = Read-Host "Have you installed PostgreSQL and Redis? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "👋 Please install PostgreSQL and Redis first, then run this script again" -ForegroundColor Yellow
        exit 0
    }
    
    # Install dependencies
    Write-Host "📦 Installing dependencies..." -ForegroundColor Green
    npm install
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ npm install failed" -ForegroundColor Red
        Write-Host ""
        Write-Host "If you encounter errors with native modules, try:" -ForegroundColor Yellow
        Write-Host "  npm install --global windows-build-tools (as Administrator)" -ForegroundColor White
        exit 1
    }
    
    # Build TypeScript
    Write-Host "🔨 Building TypeScript..." -ForegroundColor Green
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "✅ Installation completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Make sure PostgreSQL and Redis are running" -ForegroundColor White
    Write-Host "2. Apply database schema: psql -U wolaro -d wolaro -f src/database/schema.sql" -ForegroundColor White
    Write-Host "3. Start the bot: npm run dev (development) or npm start (production)" -ForegroundColor White
    Write-Host ""
}

Write-Host "🎉 Setup completed!" -ForegroundColor Green
Write-Host "📚 Documentation: https://github.com/theo7791l/Wolaro2" -ForegroundColor Cyan
