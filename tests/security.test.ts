import { SecurityManager } from '../src/utils/security';

describe('SecurityManager', () => {
  describe('isMaster', () => {
    it('should return false for non-master users', () => {
      const result = SecurityManager.isMaster('123456789');
      expect(result).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      const input = '<script>alert("XSS")</script>';
      const result = SecurityManager.sanitizeInput(input);
      expect(result).not.toContain('<script>');
    });

    it('should preserve safe text', () => {
      const input = 'Hello world 123';
      const result = SecurityManager.sanitizeInput(input);
      expect(result).toBe(input);
    });
  });

  describe('detectSuspiciousPattern', () => {
    it('should detect SQL injection attempts', () => {
      const input = "SELECT * FROM users WHERE id = '1' OR '1'='1'";
      const result = SecurityManager.detectSuspiciousPattern(input);
      expect(result).toBe(true);
    });

    it('should detect XSS attempts', () => {
      const input = '<img src=x onerror=alert(1)>';
      const result = SecurityManager.detectSuspiciousPattern(input);
      expect(result).toBe(true);
    });

    it('should allow normal messages', () => {
      const input = 'Hello, how are you today?';
      const result = SecurityManager.detectSuspiciousPattern(input);
      expect(result).toBe(false);
    });
  });
});
