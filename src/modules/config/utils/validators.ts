import { Guild, GuildChannel, Role } from 'discord.js';
import { logger } from '../../../utils/logger';

export class ConfigValidators {
    /**
     * Validate a Discord channel ID
     */
    static async validateChannel(value: string, guild: Guild): Promise<boolean> {
        try {
            const channel = await guild.channels.fetch(value);
            return channel !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate a Discord role ID
     */
    static async validateRole(value: string, guild: Guild): Promise<boolean> {
        try {
            const role = await guild.roles.fetch(value);
            return role !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate a number within range
     */
    static validateNumber(value: number, min: number, max: number): boolean {
        return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
    }

    /**
     * Validate a positive integer
     */
    static validatePositiveInteger(value: number): boolean {
        return Number.isInteger(value) && value > 0;
    }

    /**
     * Validate a percentage (0-100)
     */
    static validatePercentage(value: number): boolean {
        return this.validateNumber(value, 0, 100);
    }

    /**
     * Validate a float between 0.0 and 1.0
     */
    static validateFloat01(value: number): boolean {
        return this.validateNumber(value, 0.0, 1.0);
    }

    /**
     * Validate boolean from string
     */
    static validateBoolean(value: string): boolean {
        return ['on', 'off', 'true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase());
    }

    /**
     * Convert string to boolean
     */
    static parseBoolean(value: string): boolean {
        return ['on', 'true', 'yes', '1'].includes(value.toLowerCase());
    }

    /**
     * Validate timezone
     */
    static validateTimezone(value: string): boolean {
        try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate language code
     */
    static validateLanguage(value: string): boolean {
        const supportedLanguages = ['fr', 'en', 'es', 'de', 'it', 'pt'];
        return supportedLanguages.includes(value.toLowerCase());
    }

    /**
     * Validate action type (for moderation)
     */
    static validateAction(value: string): boolean {
        const validActions = ['mute', 'kick', 'ban', 'warn'];
        return validActions.includes(value.toLowerCase());
    }

    /**
     * Validate difficulty level (for RPG)
     */
    static validateDifficulty(value: string): boolean {
        const validDifficulties = ['easy', 'normal', 'hard', 'extreme'];
        return validDifficulties.includes(value.toLowerCase());
    }

    /**
     * Validate reward mode (for leveling)
     */
    static validateRewardMode(value: string): boolean {
        return ['stack', 'replace'].includes(value.toLowerCase());
    }

    /**
     * Validate message content length
     */
    static validateMessageLength(value: string, maxLength: number = 2000): boolean {
        return value.length > 0 && value.length <= maxLength;
    }

    /**
     * Validate URL format
     */
    static validateUrl(value: string): boolean {
        try {
            new URL(value);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate hex color code
     */
    static validateColor(value: string): boolean {
        return /^#([A-Fa-f0-9]{6})$/.test(value);
    }

    /**
     * Validate JSON string
     */
    static validateJson(value: string): boolean {
        try {
            JSON.parse(value);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Validate array of channel IDs
     */
    static async validateChannelArray(values: string[], guild: Guild): Promise<boolean> {
        for (const value of values) {
            if (!await this.validateChannel(value, guild)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Validate array of role IDs
     */
    static async validateRoleArray(values: string[], guild: Guild): Promise<boolean> {
        for (const value of values) {
            if (!await this.validateRole(value, guild)) {
                return false;
            }
        }
        return true;
    }

    /**
     * Get validation error message
     */
    static getValidationError(type: string, constraint?: string): string {
        const errors: Record<string, string> = {
            channel: 'Le salon spécifié n\'existe pas ou n\'est pas accessible.',
            role: 'Le rôle spécifié n\'existe pas ou n\'est pas accessible.',
            number: `La valeur doit être un nombre${constraint ? ` ${constraint}` : ''}.`,
            percentage: 'La valeur doit être un pourcentage entre 0 et 100.',
            float01: 'La valeur doit être un nombre décimal entre 0.0 et 1.0.',
            boolean: 'La valeur doit être on/off, true/false, yes/no ou 1/0.',
            timezone: 'Le fuseau horaire spécifié n\'est pas valide.',
            language: 'La langue spécifiée n\'est pas supportée.',
            action: 'L\'action doit être: mute, kick, ban ou warn.',
            difficulty: 'La difficulté doit être: easy, normal, hard ou extreme.',
            rewardMode: 'Le mode doit être: stack ou replace.',
            messageLength: 'Le message est trop long (max 2000 caractères).',
            url: 'L\'URL spécifiée n\'est pas valide.',
            color: 'Le code couleur doit être au format #RRGGBB.',
            json: 'Le JSON fourni n\'est pas valide.'
        };

        return errors[type] || 'Valeur invalide.';
    }
}
