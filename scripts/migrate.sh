#!/bin/bash

# Wolaro Database Migration Script
# Applies database schema to PostgreSQL

set -e

echo "==========================================="
echo "    Wolaro Database Migration"
echo "==========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# Check required variables
if [ -z "$DB_HOST" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ]; then
    echo "Error: Missing database configuration in .env"
    echo "Required: DB_HOST, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: ${DB_PORT:-5432}"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Test connection
echo "[1/3] Testing database connection..."
export PGPASSWORD=$DB_PASSWORD
if psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d postgres -c "\q" 2>/dev/null; then
    echo "✓ Connection successful"
else
    echo "Error: Cannot connect to database"
    echo "Please check your database credentials"
    exit 1
fi
echo ""

# Create database if not exists
echo "[2/3] Creating database..."
psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d postgres -c "CREATE DATABASE $DB_NAME" 2>/dev/null || echo "✓ Database already exists"
echo ""

# Apply schema
echo "[3/3] Applying schema..."
if [ -f "src/database/schema.sql" ]; then
    psql -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME -f src/database/schema.sql
    echo "✓ Schema applied successfully"
else
    echo "Error: schema.sql not found"
    exit 1
fi
echo ""

echo "==========================================="
echo "    Migration Complete!"
echo "==========================================="
echo ""
echo "Database is ready. You can now start the bot:"
echo "  npm run dev"
echo ""
