/**
 * Migration Runner
 * Exécute toutes les migrations dans l'ordre
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface Migration {
  id: number;
  name: string;
  executed_at: Date;
}

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) UNIQUE NOT NULL,
      executed_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

async function getExecutedMigrations(): Promise<string[]> {
  const result = await pool.query<Migration>(
    'SELECT name FROM migrations ORDER BY id'
  );
  return result.rows.map(row => row.name);
}

async function markMigrationExecuted(name: string) {
  await pool.query(
    'INSERT INTO migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
    [name]
  );
}

async function runMigrations() {
  console.log('🚀 Starting database migrations...');
  
  try {
    // Ensure migrations tracking table exists
    await ensureMigrationsTable();
    
    // Get already executed migrations
    const executed = await getExecutedMigrations();
    console.log(`📊 Found ${executed.length} executed migrations`);
    
    // Check for migration files
    const migrationsDir = path.join(__dirname, '../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('📁 No migrations directory found, creating it...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    if (files.length === 0) {
      console.log('ℹ️ No SQL migration files found in /migrations');
      console.log('💡 Running built-in protection migration...');
      
      // Run protection migration directly
      const protectionMigration = path.join(__dirname, 'migrate-protection.ts');
      require(protectionMigration);
      return;
    }
    
    // Execute pending migrations
    let executedCount = 0;
    
    for (const file of files) {
      if (executed.includes(file)) {
        console.log(`⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      console.log(`🔄 Executing ${file}...`);
      
      const sql = fs.readFileSync(
        path.join(migrationsDir, file),
        'utf-8'
      );
      
      await pool.query(sql);
      await markMigrationExecuted(file);
      
      console.log(`✅ ${file} executed successfully`);
      executedCount++;
    }
    
    if (executedCount === 0) {
      console.log('✅ All migrations are up to date!');
    } else {
      console.log(`\n✨ Successfully executed ${executedCount} migration(s)!`);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
