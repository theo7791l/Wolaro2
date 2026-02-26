/**
 * Deploy Commands - Fixed dotenv path resolution
 */

import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Charger le .env depuis la racine du projet (pas depuis dist/)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
// Fallback : essayer aussi le dossier courant
if (!process.env.DISCORD_TOKEN) {
  dotenv.config();
}

const commands: any[] = [];
const foldersPath = path.join(__dirname, 'modules');

if (!fs.existsSync(foldersPath)) {
  console.error('❌ Le dossier dist/modules n\'existe pas. Veuillez compiler le projet avec "npm run build" d\'abord.');
  process.exit(1);
}

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('❌ CLIENT_ID manquant dans .env');
  process.exit(1);
}

const commandFolders = fs.readdirSync(foldersPath);

console.log('🔍 Scan automatique des commandes...');

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder, 'commands');

  if (!fs.existsSync(commandsPath)) continue;

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const commandModule = require(filePath);
      
      let commandInstance = null;
      
      for (const key of Object.keys(commandModule)) {
        const exported = commandModule[key];
        
        if (typeof exported === 'function' && exported.prototype) {
          try {
            const instance = new exported();
            if (instance.data && typeof instance.execute === 'function') {
              commandInstance = instance;
              break;
            }
          } catch (e) {
            // Not a valid command class, continue
          }
        } else if (exported && typeof exported === 'object' && exported.data && exported.execute) {
          commandInstance = exported;
          break;
        }
      }
      
      if (commandInstance && commandInstance.data) {
        const commandData = typeof commandInstance.data.toJSON === 'function' 
          ? commandInstance.data.toJSON() 
          : commandInstance.data;
          
        commands.push(commandData);
        const commandName = commandData.name || 'unknown';
        console.log(`  ✅ /${commandName.padEnd(20)} │ module: ${folder}`);
      } else {
        console.log(`  ⚠️  ${file} n'a pas de structure valide`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Impossible de charger ${file} : ${error.message}`);
    }
  }
}

console.log(`📦 ${commands.length} commandes trouvées.`);

if (commands.length === 0) {
  console.warn('⚠️  Aucune commande trouvée. Le bot démarrera sans commandes slash.');
  process.exit(0);
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

(async () => {
  try {
    console.log('🌐 Enregistrement global (toutes les guilds)...');

    const data: any = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID!),
      { body: commands }
    );

    console.log(`✅ ${data.length} commandes enregistrées avec succès !`);
  } catch (error) {
    console.error('❌ Erreur lors de l\'enregistrement des commandes:', error);
    process.exit(1);
  }
})();
