/**
 * deploy-commands.ts
 * Enregistre toutes les slash commands de Wolaro auprès de Discord.
 *
 * Usage :
 *   npm run deploy-commands          → enregistrement global (1h de délai)
 *   GUILD_ID=xxx npm run deploy-commands  → enregistrement instantané sur un serveur
 */

import { REST, Routes } from 'discord.js';
import { readdirSync } from 'fs';
import { join, resolve } from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

async function deployCommands(): Promise<void> {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.GUILD_ID; // optionnel : déploiement instantané sur un serveur

  if (!token) {
    console.error('\n❌ DISCORD_TOKEN manquant dans .env');
    process.exit(1);
  }
  if (!clientId) {
    console.error('\n❌ DISCORD_CLIENT_ID manquant dans .env');
    process.exit(1);
  }

  const commands: object[] = [];
  const modulesPath = resolve(__dirname, 'modules');

  console.log('\n🔍 Scan automatique des commandes...\n');

  // Parcourir chaque module dans src/modules/
  let moduleDirs: string[];
  try {
    moduleDirs = readdirSync(modulesPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    console.error(`❌ Impossible de lire le dossier modules : ${modulesPath}`);
    process.exit(1);
  }

  for (const mod of moduleDirs) {
    const commandsPath = join(modulesPath, mod, 'commands');
    let commandFiles: string[];

    try {
      commandFiles = readdirSync(commandsPath).filter(
        (f) => f.endsWith('.js') || f.endsWith('.ts')
      );
    } catch {
      // Ce module n'a pas de dossier commands/ — skip
      continue;
    }

    for (const file of commandFiles) {
      try {
        const filePath = join(commandsPath, file);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const commandModule = await import(filePath);

        // Trouver la classe exportée qui a une propriété `data`
        for (const exportedKey of Object.keys(commandModule)) {
          const Cls = commandModule[exportedKey];
          if (typeof Cls !== 'function') continue;

          let instance: { data?: { name: string; toJSON: () => object } };
          try {
            instance = new Cls();
          } catch {
            continue;
          }

          if (instance?.data && typeof instance.data.toJSON === 'function') {
            const json = instance.data.toJSON() as { name: string };
            commands.push(json);
            const name = `/${json.name}`;
            console.log(`  ✅ ${name.padEnd(25)} │ module: ${mod}`);
          }
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  ⚠️  Impossible de charger ${file} : ${msg}`);
      }
    }
  }

  if (commands.length === 0) {
    console.error('\n❌ Aucune commande trouvée. Vérifiez que le build est à jour.');
    process.exit(1);
  }

  console.log(`\n📦 ${commands.length} commandes trouvées.`);

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    if (guildId) {
      // Déploiement instantané sur un serveur spécifique (dev)
      console.log(`🚀 Enregistrement sur le serveur ${guildId}...`);
      const data = (await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands }
      )) as object[];
      console.log(`\n🎉 ${data.length} commandes enregistrées instantanément sur le serveur ${guildId} !\n`);
    } else {
      // Déploiement global (jusqu'à 1 heure de propagation Discord)
      console.log('🌐 Enregistrement global (toutes les guilds)...');
      const data = (await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands }
      )) as object[];
      console.log(`\n🎉 ${data.length} commandes enregistrées globalement !`);
      console.log('⏳ Délai d\'activation Discord : jusqu\'\u00e0 1 heure.\n');
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ Erreur Discord REST : ${msg}`);
    process.exit(1);
  }
}

deployCommands();
