#!/bin/bash

# Wolaro Database Backup Script
# Creates a backup of the PostgreSQL database

set -e

echo "==========================================="
echo "    Wolaro Database Backup"
echo "==========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found"
    exit 1
fi

# Create backups directory
mkdir -p backups

# Generate filename
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="backups/wolaro_${TIMESTAMP}.sql"

echo "Creating backup..."
echo "File: $BACKUP_FILE"
echo ""

# Export database
export PGPASSWORD=$DB_PASSWORD
pg_dump -h $DB_HOST -p ${DB_PORT:-5432} -U $DB_USER -d $DB_NAME > $BACKUP_FILE

if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✓ Backup created successfully"
    echo "  Size: $FILE_SIZE"
    echo "  Location: $BACKUP_FILE"
    
    # Compress backup
    echo ""
    echo "Compressing backup..."
    gzip $BACKUP_FILE
    COMPRESSED_SIZE=$(du -h "${BACKUP_FILE}.gz" | cut -f1)
    echo "✓ Backup compressed"
    echo "  Size: $COMPRESSED_SIZE"
    echo "  Location: ${BACKUP_FILE}.gz"
else
    echo "Error: Backup failed"
    exit 1
fi

echo ""
echo "==========================================="
echo "    Backup Complete!"
echo "==========================================="
echo ""

# Cleanup old backups (keep last 7 days)
echo "Cleaning up old backups (keeping last 7 days)..."
find backups/ -name "wolaro_*.sql.gz" -mtime +7 -delete
BACKUP_COUNT=$(ls -1 backups/wolaro_*.sql.gz 2>/dev/null | wc -l)
echo "✓ $BACKUP_COUNT backup(s) retained"
echo ""
