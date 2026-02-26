#!/usr/bin/env node
/**
 * Script de migration simple pour mettre à jour la base de données
 * Usage: node scripts/migrate-db.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function main() {
  console.log('🚀 Démarrage de la migration de la base de données...');

  // Create connection using environment variables
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 1,
  });

  try {
    // Test connection
    console.log('🔍 Test de connexion...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connecté à la base de données');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'MIGRATION_THEOPROTECT.sql');
    console.log(`📄 Lecture du fichier: ${migrationPath}`);
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Fichier de migration introuvable!');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    console.log('⏳ Exécution de la migration...');
    await pool.query(migrationSQL);

    console.log('✅ Migration terminée avec succès!');

    // Verify tables were created
    console.log('\n🔍 Vérification des tables créées:');
    const result = await pool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename LIKE 'protection%'
      ORDER BY tablename
    `);

    if (result.rows.length > 0) {
      console.log('Tables de protection créées:');
      result.rows.forEach(row => {
        console.log(`  ✅ ${row.tablename}`);
      });
    } else {
      console.log('⚠️  Aucune table de protection trouvée');
    }

    console.log('\n✨ La base de données est prête!');
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
