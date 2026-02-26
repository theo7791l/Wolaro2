/**
 * Deploy Commands - Support TypeScript + JavaScript + Sous-dossiers
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

// Normalisation : accepter DISCORD_CLIENT_ID ou CLIENT_ID
if (!process.env.CLIENT_ID && process.env.DISCORD_CLIENT_ID) {
  process.env.CLIENT_ID = process.env.DISCORD_CLIENT_ID;
}

const commands: any[] = [];
const foldersPath = path.join(__dirname, 'modules');

if (!fs.existsSync(foldersPath)) {
  console.error('❌ Le dossier modules n\'existe pas.');
  console.error('   En développement : exécutez "npm run dev"');
  console.error('   En production : exécutez "npm run build" puis "npm run deploy"');
  process.exit(1);
}

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}

if (!process.env.CLIENT_ID) {
  console.error('❌ CLIENT_ID ou DISCORD_CLIENT_ID manquant dans .env');
  process.exit(1);
}

/**
 * Scan récursif pour trouver toutes les commandes, même dans les sous-dossiers
 */
function scanCommandsRecursive(basePath: string, moduleName: string): void {
  if (!fs.existsSync(basePath)) return;

  const items = fs.readdirSync(basePath);

  for (const item of items) {
    const itemPath = path.join(basePath, item);
    const stat = fs.statSync(itemPath);

    if (stat.isDirectory()) {
      // Si c'est un dossier "commands", scanner les fichiers
      if (item === 'commands') {
        scanCommandFiles(itemPath, moduleName);
      } else {
        // Sinon, continuer la récursion (pour les sous-modules comme "protection")
        scanCommandsRecursive(itemPath, moduleName);
      }
    }
  }
}

/**
 * Scanne les fichiers de commandes dans un dossier
 */
function scanCommandFiles(commandsPath: string, moduleName: string): void {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const commandModule = require(filePath);

      let commandInstance = null;

      // Méthode 1 : export default
      if (commandModule.default) {
        const exported = commandModule.default;
        
        // Si c'est une classe
        if (typeof exported === 'function') {
          try {
            const instance = new exported();
            if (instance.data && typeof instance.execute === 'function') {
              commandInstance = instance;
            }
          } catch (e) {
            // Si l'instanciation échoue, vérifier si c'est un objet direct
            if (exported.data && exported.execute) {
              commandInstance = exported;
            }
          }
        }
        // Si c'est déjà un objet
        else if (typeof exported === 'object' && exported.data && exported.execute) {
          commandInstance = exported;
        }
      }

      // Méthode 2 : exports nommés - chercher toutes les possibilités
      if (!commandInstance) {
        for (const key of Object.keys(commandModule)) {
          if (key === 'default') continue;
          
          const exported = commandModule[key];

          if (typeof exported === 'function') {
            try {
              const instance = new exported();
              if (instance.data && typeof instance.execute === 'function') {
                commandInstance = instance;
                break;
              }
            } catch (e) {
              // Pas une classe valide, continuer
            }
          } else if (exported && typeof exported === 'object' && exported.data && exported.execute) {
            commandInstance = exported;
            break;
          }
        }
      }

      if (commandInstance && commandInstance.data) {
        const commandData =
          typeof commandInstance.data.toJSON === 'function'
            ? commandInstance.data.toJSON()
            : commandInstance.data;

        commands.push(commandData);
        const commandName = commandData.name || 'unknown';
        console.log(`  ✅ /${commandName.padEnd(20)} │ module: ${moduleName}`);
      } else {
        console.log(`  ⚠️  ${file} n'a pas de structure valide`);
      }
    } catch (error: any) {
      console.log(`  ⚠️  Impossible de charger ${file} : ${error.message}`);
    }
  }
}

const commandFolders = fs.readdirSync(foldersPath);

console.log('🔍 Scan automatique des commandes (récursif)...');

for (const folder of commandFolders) {
  const modulePath = path.join(foldersPath, folder);
  
  // Vérifier si c'est un dossier
  if (!fs.statSync(modulePath).isDirectory()) continue;

  // Scanner récursivement pour trouver tous les dossiers "commands"
  scanCommandsRecursive(modulePath, folder);
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
