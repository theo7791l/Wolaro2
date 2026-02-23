import { DatabaseManager } from '../src/database/manager';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = new DatabaseManager();
    await db.connect();
    // Insert a test guild to satisfy guild_economy FK constraint
    await db.query(
      `INSERT INTO guilds (guild_id, owner_id) VALUES ('test_guild', 'test_owner') ON CONFLICT (guild_id) DO NOTHING`
    );
  });

  afterAll(async () => {
    // Clean up test data
    await db.query(`DELETE FROM guild_economy WHERE guild_id = 'test_guild'`);
    await db.query(`DELETE FROM guilds WHERE guild_id = 'test_guild'`);
    await db.disconnect();
  });

  describe('getBalance', () => {
    it('should return 0 for new users', async () => {
      const balance = await db.getBalance('test_guild', 'test_user');
      expect(balance).toBe(0);
    });
  });

  describe('addBalance', () => {
    it('should add balance to user', async () => {
      await db.addBalance('test_guild', 'test_user', 100);
      const balance = await db.getBalance('test_guild', 'test_user');
      expect(balance).toBeGreaterThanOrEqual(100);
    });
  });
});
