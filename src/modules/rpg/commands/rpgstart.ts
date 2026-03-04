import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { ICommand, ICommandContext } from '../../../types';

const CLASSES: Record<string, { name: string; hp: number; attack: number; defense: number; critRate: number; desc: string }> = {
  warrior: { name: '⚔️ Guerrier',  hp: 150, attack: 15, defense: 10, critRate: 10, desc: 'Tank robuste avec une grande résistance et des dégâts constants.' },
  mage:    { name: '🔮 Mage',      hp: 80,  attack: 25, defense: 3,  critRate: 20, desc: 'Dégâts maximaux mais très vulnérable aux attaques ennemies.' },
  archer:  { name: '🏹 Archer',    hp: 100, attack: 18, defense: 6,  critRate: 25, desc: 'Maître du critique — frappe vite et précisément.' },
  paladin: { name: '🛡️ Paladin',   hp: 130, attack: 12, defense: 15, critRate: 5,  desc: 'Défenseur ultime — résiste à tout mais frappe lentement.' },
};

export class RpgStartCommand implements ICommand {
  data = new SlashCommandBuilder()
    .setName('rpgstart')
    .setDescription('🎮 Créer ton profil RPG et choisir ta classe')
    .addStringOption(opt =>
      opt.setName('classe')
        .setDescription('Ta classe de départ (choix définitif)')
        .setRequired(true)
        .addChoices(
          { name: '⚔️ Guerrier — 150 PV | 15 ATK | 10 DEF | Crit 10%', value: 'warrior' },
          { name: '🔮 Mage — 80 PV | 25 ATK | 3 DEF | Crit 20%',       value: 'mage'    },
          { name: '🏹 Archer — 100 PV | 18 ATK | 6 DEF | Crit 25%',    value: 'archer'  },
          { name: '🛡️ Paladin — 130 PV | 12 ATK | 15 DEF | Crit 5%',   value: 'paladin' },
        )
    ) as SlashCommandBuilder;

  module = 'rpg';
  guildOnly = true;
  cooldown = 5;

  async execute(interaction: ChatInputCommandInteraction, context: ICommandContext): Promise<void> {
    const existing = await context.database.query(
      'SELECT user_id FROM rpg_profiles WHERE guild_id = $1 AND user_id = $2',
      [interaction.guildId!, interaction.user.id]
    );

    if (existing.length > 0) {
      await interaction.reply({
        content: '❌ Tu as déjà un profil RPG ! Utilise `/rpgprofile` pour le consulter.',
        ephemeral: true,
      });
      return;
    }

    const classKey = interaction.options.getString('classe', true);
    const cls = CLASSES[classKey];

    if (!cls) {
      await interaction.reply({ content: '❌ Classe invalide.', ephemeral: true });
      return;
    }

    await context.database.query(
      `INSERT INTO rpg_profiles
       (guild_id, user_id, level, xp, gold, health, max_health, attack, defense, class, wins, losses, inventory, equipped)
       VALUES ($1, $2, 1, 0, 100, $3, $3, $4, $5, $6, 0, 0, '[]', '{}')`,
      [interaction.guildId!, interaction.user.id, cls.hp, cls.attack, cls.defense, classKey]
    );

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🎮 Aventure commencée !')
      .setDescription(`Bienvenue, **${cls.name}** ! Ton profil RPG a été créé avec succès.\n_${cls.desc}_`)
      .addFields(
        { name: '❤️ Points de vie',    value: `\`${cls.hp}/${cls.hp}\``, inline: true },
        { name: '⚔️ Attaque',          value: `\`${cls.attack}\``,       inline: true },
        { name: '🛡️ Défense',          value: `\`${cls.defense}\``,      inline: true },
        { name: '⚡ Taux de critique', value: `\`${cls.critRate}%\``,    inline: true },
        { name: '🪙 Or de départ',     value: `\`100\``,                 inline: true },
        { name: '📖 Classe',           value: cls.name,                   inline: true },
      )
      .addFields({ name: '\u200b', value: '➡️ Commence par `/battle monstre:squelette` pour ton premier combat !' })
      .setFooter({ text: `${interaction.user.tag} • Niveau 1`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
