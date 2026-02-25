/**
 * Deploy Commands - Fixed to load .js files
 */

import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const commands: any[] = [];
const foldersPath = path.join(__dirname, 'modules');

if (!fs.existsSync(foldersPath)) {
  console.error('❌ Le dossier dist/modules n\'existe pas. Veuillez compiler le projet avec "npm run build" d\'abord.');
  process.exit(1);
}

const commandFolders = fs.readdirSync(foldersPath);

console.log('🔍 Scan automatique des commandes...');

for (const folder of commandFolders) {
  const commandsPath = path.join(foldersPath, folder, 'commands');

  if (!fs.existsSync(commandsPath)) continue;

  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith('.js')); // Only load .js files

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);

    try {
      const command = require(filePath);

      if (command.default?.data && command.default?.execute) {
        commands.push(command.default.data.toJSON());
        console.log(`  ✅ /${command.default.data.name.padEnd(20)} │ module: ${folder}`);
      } else if (command.data && command.execute) {
        commands.push(command.data.toJSON());
        console.log(`  ✅ /${command.data.name.padEnd(20)} │ module: ${folder}`);
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
  console.error('❌ Aucune commande n\'a été trouvée.');
  process.exit(1);
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
