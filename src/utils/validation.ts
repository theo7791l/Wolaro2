/**
 * Utilitaires de validation pour sécuriser les inputs utilisateur
 */

export class ValidationUtils {
  /**
   * Valide qu'un montant est sûr pour les opérations économiques
   * @param amount - Le montant à valider
   * @returns true si le montant est valide
   */
  static validateAmount(amount: number): boolean {
    return (
      Number.isInteger(amount) &&
      amount > 0 &&
      amount <= Number.MAX_SAFE_INTEGER &&
      !isNaN(amount) &&
      isFinite(amount)
    );
  }

  /**
   * Valide un montant et lance une erreur si invalide
   * @param amount - Le montant à valider
   * @param fieldName - Nom du champ pour le message d'erreur
   * @throws Error si le montant est invalide
   */
  static requireValidAmount(amount: number, fieldName: string = 'montant'): void {
    if (!this.validateAmount(amount)) {
      throw new Error(
        `Le ${fieldName} doit être un nombre entier positif valide (max: ${Number.MAX_SAFE_INTEGER})`
      );
    }
  }

  /**
   * Valide qu'un montant ne dépasse pas le solde disponible
   * @param amount - Montant à dépenser
   * @param balance - Solde disponible
   * @returns true si le solde est suffisant
   */
  static hasSufficientBalance(amount: number, balance: number): boolean {
    return this.validateAmount(amount) && balance >= amount;
  }

  /**
   * Sécurise une chaîne de caractères contre les injections
   * @param input - Chaîne à sécuriser
   * @param maxLength - Longueur maximale
   * @returns Chaîne sécurisée
   */
  static sanitizeString(input: string, maxLength: number = 2000): string {
    return input
      .trim()
      .substring(0, maxLength)
      .replace(/[<>]/g, ''); // Supprimer les caractères dangereux
  }

  /**
   * Valide un ID Discord (Snowflake)
   * @param id - ID à valider
   * @returns true si l'ID est valide
   */
  static isValidDiscordId(id: string): boolean {
    return /^\d{17,19}$/.test(id);
  }

  /**
   * Valide un pourcentage (0-100)
   * @param value - Valeur à valider
   * @returns true si valide
   */
  static isValidPercentage(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= 100;
  }

  /**
   * Sécurise un montant en le limitant à une valeur maximale
   * @param amount - Montant à limiter
   * @param max - Valeur maximale
   * @returns Montant limité
   */
  static clampAmount(amount: number, max: number = Number.MAX_SAFE_INTEGER): number {
    if (!this.validateAmount(amount)) {
      return 0;
    }
    return Math.min(amount, max);
  }
}
