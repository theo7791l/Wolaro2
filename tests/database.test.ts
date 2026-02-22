import { DatabaseManager } from '../src/database/manager';

describe('DatabaseManager', () => {
  let db: DatabaseManager;

  beforeAll(async () => {
    db = new DatabaseManager();
    await db.connect();
  });

  afterAll(async () => {
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
