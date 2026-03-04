/**
 * deploy-commands.ts
 * Enregistre toutes les slash commands sur Discord.
 *
 * Usage :
 *   npx ts-node scripts/deploy-commands.ts          → serveur de test (GUILD_ID dans .env)
 *   npx ts-node scripts/deploy-commands.ts --global  → toutes les guilds (propagation ~1h)
 */

import { REST, Routes } from 'discord.js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const TOKEN     = process.env.DISCORD_TOKEN!;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const GUILD_ID  = process.env.DISCORD_GUILD_ID;   // optionnel — déploiement rapide sur 1 serveur

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ DISCORD_TOKEN et DISCORD_CLIENT_ID sont requis dans .env');
  process.exit(1);
}

// ─── Chargement des commandes ────────────────────────────────────────────────

const commands: any[] = [];
const modulesPath = path.join(__dirname, '..', 'src', 'modules');

for (const folder of fs.readdirSync(modulesPath)) {
  const commandsPath = path.join(modulesPath, folder, 'commands');
  if (!fs.existsSync(commandsPath)) continue;

  for (const file of fs.readdirSync(commandsPath).filter(f => f.endsWith('.ts') || f.endsWith('.js'))) {
    try {
      const mod = require(path.join(commandsPath, file));
      // Récupérer la première export de classe qui a une propriété `data`
      for (const key of Object.keys(mod)) {
        const Cls = mod[key];
        if (typeof Cls === 'function') {
          try {
            const instance = new Cls();
            if (instance.data?.toJSON) {
              commands.push(instance.data.toJSON());
              console.log(`  ✓ ${folder}/${file} → /${instance.data.name}`);
            }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      console.warn(`  ⚠️  Skipped ${folder}/${file}:`, err);
    }
  }
}

console.log(`\n📦 ${commands.length} commandes trouvées.\n`);

// ─── Déploiement ─────────────────────────────────────────────────────────────

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    const isGlobal = process.argv.includes('--global');

    if (isGlobal) {
      console.log('🌍 Déploiement global (toutes les guilds)…');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
      console.log('✅ Commandes déployées globalement (propagation ~1h).');
    } else if (GUILD_ID) {
      console.log(`🔧 Déploiement sur le serveur de test (${GUILD_ID})…`);
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
      console.log('✅ Commandes déployées instantanément sur le serveur de test.');
    } else {
      console.error('❌ Ajoute DISCORD_GUILD_ID dans .env pour un déploiement rapide, ou utilise --global.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erreur lors du déploiement :', error);
    process.exit(1);
  }
})();
