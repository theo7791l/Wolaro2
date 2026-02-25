# 🐛 Corrections de Bugs - Wolaro2

## ✅ Corrections Appliquées

### 1. Sécurité - Commande `/eval` (CRITIQUE)
**Commit**: [305e412](https://github.com/theo7791l/Wolaro2/commit/305e412aa9fd8b6a9138fcdc58300514b1f1c667)

- ✅ Ajout d'une sandbox VM avec timeout de 5 secondes
- ✅ Filtrage automatique des tokens Discord, secrets et URLs de BDD
- ✅ Isolation du contexte d'exécution (pas d'accès à `process`, `require`, etc.)

### 2. Timeout Discord - Gestion automatique (IMPORTANT)
**Commit**: [767c5f9](https://github.com/theo7791l/Wolaro2/commit/767c5f924b838d77fefb28ca951fab8bd46f4872)

- ✅ Auto-defer après 2 secondes si la commande n'a pas encore répondu
- ✅ Évite les erreurs "Interaction has already been acknowledged" 
- ✅ Amélioration des logs d'erreurs avec stack traces

### 3. Utilitaires de Validation (IMPORTANT)
**Commit**: [055a3bc](https://github.com/theo7791l/Wolaro2/commit/055a3bcdecdfaa2612d8d479dd1d7b704e1474e9)

- ✅ Validation stricte des montants (entiers positifs, < MAX_SAFE_INTEGER)
- ✅ Sanitization des chaînes de caractères
- ✅ Validation des IDs Discord (Snowflakes)
- ✅ Utilitaires pour pourcentages et clamping

---

## 🚧 Corrections À Appliquer Manuellement

### 4. Transactions PostgreSQL pour l'économie (CRITIQUE)

**Fichiers concernés**: 
- `src/modules/economy/commands/*.ts`
- `src/modules/rpg/commands/buy.ts`
- Toute opération modifiant des balances

**Problème**: Race conditions possibles lors de transactions concurrentes

**Solution**: Utiliser des transactions PostgreSQL

```typescript
// Exemple pour un transfert d'argent
import { ValidationUtils } from '../../../utils/validation';

// Valider le montant
ValidationUtils.requireValidAmount(amount, 'montant');

// Transaction atomique
const client = await context.database.pool.connect();
try {
  await client.query('BEGIN');
  
  // Débiter l'expéditeur
  const debit = await client.query(
    'UPDATE guild_economy SET balance = balance - $1 WHERE guild_id = $2 AND user_id = $3 AND balance >= $1 RETURNING balance',
    [amount, guildId, senderId]
  );
  
  if (debit.rowCount === 0) {
    throw new Error('Solde insuffisant');
  }
  
  // Créditer le destinataire
  await client.query(
    'UPDATE guild_economy SET balance = balance + $1 WHERE guild_id = $2 AND user_id = $3',
    [amount, guildId, receiverId]
  );
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 5. Validation dans les commandes économie

**Fichiers à modifier**:
- `src/modules/economy/commands/daily.ts`
- `src/modules/economy/commands/work.ts`  
- `src/modules/rpg/commands/buy.ts`
- Toute commande acceptant un montant en paramètre

**Ajouter avant toute opération**:
```typescript
import { ValidationUtils } from '../../../utils/validation';

try {
  ValidationUtils.requireValidAmount(amount, 'montant');
  
  // Vérifier le solde
  if (!ValidationUtils.hasSufficientBalance(amount, userBalance)) {
    await interaction.reply({
      content: '❌ Solde insuffisant !',
      flags: MessageFlags.Ephemeral
    });
    return;
  }
  
  // Continue avec l'opération...
} catch (error) {
  await interaction.reply({
    content: `❌ ${error.message}`,
    flags: MessageFlags.Ephemeral
  });
  return;
}
```

### 6. Retirer `ephemeral` des commandes publiques

**Fichiers à modifier**:
- `src/modules/economy/commands/balance.ts` - Ligne 56
- `src/modules/economy/commands/leaderboard.ts` - Vérifier
- `src/modules/leveling/commands/rank.ts` - Vérifier
- `src/modules/leveling/commands/leaderboard.ts` - Vérifier

**Changement**:
```typescript
// AVANT
await interaction.reply({ 
  embeds: [embed],
  flags: MessageFlags.Ephemeral // ❌ À RETIRER
});

// APRÈS
await interaction.reply({ 
  embeds: [embed]
  // Les résultats publics ne doivent pas être éphémères
});
```

### 7. Gestion de la concurrence musicale

**Fichier**: `src/modules/music/commands/*.ts`

**Problème**: Plusieurs utilisateurs peuvent modifier la queue simultanément

**Solution**: Utiliser Redis pour les locks

```typescript
const lockKey = `music:queue:${guildId}`;
const acquired = await context.redis.acquireLock(lockKey, 5000); // 5s timeout

if (!acquired) {
  await interaction.reply({
    content: '⏳ La queue musicale est en cours de modification, réessayez...',
    flags: MessageFlags.Ephemeral
  });
  return;
}

try {
  // Modifier la queue
} finally {
  await context.redis.releaseLock(lockKey);
}
```

---

## 📝 Notes Importantes

### Package.json - Ajouter la dépendance `vm`

Le module `vm` est intégré à Node.js, mais assurez-vous d'avoir les types :

```bash
npm install --save-dev @types/node
```

### Tests Recommandés

1. **Test de la commande eval**:
   ```
   /eval code: console.log("test")
   /eval code: process.env.TOKEN (doit être filtré)
   ```

2. **Test du timeout Discord**:
   - Exécuter une commande qui prend > 2s
   - Vérifier qu'elle est auto-deferée

3. **Test de validation**:
   ```typescript
   ValidationUtils.validateAmount(-100) // false
   ValidationUtils.validateAmount(0) // false  
   ValidationUtils.validateAmount(1.5) // false
   ValidationUtils.validateAmount(100) // true
   ```

### Priorité des Corrections Restantes

1. 🔴 **URGENT**: Transactions PostgreSQL (point 4)
2. 🟠 **IMPORTANT**: Validation des montants (point 5)
3. 🟡 **MOYEN**: Retirer ephemeral (point 6)
4. 🟢 **FAIBLE**: Locks musicaux (point 7)

---

## 🔗 Liens Utiles

- [Documentation VM Node.js](https://nodejs.org/api/vm.html)
- [Transactions PostgreSQL](https://node-postgres.com/features/transactions)
- [Discord.js Interactions](https://discord.js.org/#/docs/discord.js/main/class/CommandInteraction)

---

**Date de création**: 25 février 2026  
**Dernière mise à jour**: 25 février 2026
