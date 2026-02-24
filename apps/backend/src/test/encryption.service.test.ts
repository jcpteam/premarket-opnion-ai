import { EncryptionService } from '../services/encryption.service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const testMasterKey = 'test-master-key-for-encryption-service-testing-only';

  beforeEach(() => {
    encryptionService = new EncryptionService(testMasterKey);
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt text correctly', () => {
      const plaintext = 'sensitive data';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
      expect(encrypted).not.toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test data';
      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
      expect(encryptionService.decrypt(encrypted1)).toBe(plaintext);
      expect(encryptionService.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle empty strings', () => {
      const plaintext = '';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = '你好世界 🌍 مرحبا';
      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error on invalid encrypted data', () => {
      expect(() => {
        encryptionService.decrypt('invalid-data');
      }).toThrow();
    });
  });

  describe('hash and verifyHash', () => {
    it('should hash data correctly', () => {
      const data = 'password123';
      const { hash, salt } = encryptionService.hash(data);

      expect(hash).toBeTruthy();
      expect(salt).toBeTruthy();
      expect(hash).not.toBe(data);
    });

    it('should verify correct hash', () => {
      const data = 'password123';
      const { hash, salt } = encryptionService.hash(data);
      const isValid = encryptionService.verifyHash(data, hash, salt);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect hash', () => {
      const data = 'password123';
      const { hash, salt } = encryptionService.hash(data);
      const isValid = encryptionService.verifyHash('wrong-password', hash, salt);

      expect(isValid).toBe(false);
    });

    it('should produce different hashes with different salts', () => {
      const data = 'password123';
      const result1 = encryptionService.hash(data);
      const result2 = encryptionService.hash(data);

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should produce same hash with same salt', () => {
      const data = 'password123';
      const { salt } = encryptionService.hash(data);
      const result1 = encryptionService.hash(data, salt);
      const result2 = encryptionService.hash(data, salt);

      expect(result1.hash).toBe(result2.hash);
    });
  });

  describe('encryptObject and decryptObject', () => {
    it('should encrypt and decrypt objects', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 30,
        nested: {
          value: 'test',
        },
      };

      const encrypted = encryptionService.encryptObject(obj);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(obj);
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3, 'test', { key: 'value' }];
      const encrypted = encryptionService.encryptObject(arr);
      const decrypted = encryptionService.decryptObject(encrypted);

      expect(decrypted).toEqual(arr);
    });
  });

  describe('generateToken', () => {
    it('should generate random tokens', () => {
      const token1 = encryptionService.generateToken();
      const token2 = encryptionService.generateToken();

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
    });

    it('should generate tokens of specified length', () => {
      const token = encryptionService.generateToken(16);
      expect(token.length).toBe(32); // 16 bytes = 32 hex chars
    });
  });

  describe('generateSecureString', () => {
    it('should generate URL-safe random strings', () => {
      const str1 = encryptionService.generateSecureString();
      const str2 = encryptionService.generateSecureString();

      expect(str1).toBeTruthy();
      expect(str2).toBeTruthy();
      expect(str1).not.toBe(str2);
      expect(str1).toMatch(/^[A-Za-z0-9_-]+$/);
    });
  });

  describe('createSignature and verifySignature', () => {
    it('should create and verify signatures', () => {
      const data = 'important data';
      const signature = encryptionService.createSignature(data);
      const isValid = encryptionService.verifySignature(data, signature);

      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const data = 'important data';
      const signature = encryptionService.createSignature(data);
      const isValid = encryptionService.verifySignature('tampered data', signature);

      expect(isValid).toBe(false);
    });

    it('should reject modified signatures', () => {
      const data = 'important data';
      const signature = encryptionService.createSignature(data);
      const tamperedSignature = signature.substring(0, signature.length - 1) + 'x';
      const isValid = encryptionService.verifySignature(data, tamperedSignature);

      expect(isValid).toBe(false);
    });
  });

  describe('encryptField and decryptField', () => {
    it('should encrypt and decrypt fields', () => {
      const value = 'sensitive field value';
      const encrypted = encryptionService.encryptField(value);
      const decrypted = encryptionService.decryptField(encrypted);

      expect(decrypted).toBe(value);
      expect(encrypted).not.toBe(value);
    });

    it('should handle null values', () => {
      const encrypted = encryptionService.encryptField(null);
      const decrypted = encryptionService.decryptField(null);

      expect(encrypted).toBeNull();
      expect(decrypted).toBeNull();
    });

    it('should handle undefined values', () => {
      const encrypted = encryptionService.encryptField(undefined);
      const decrypted = encryptionService.decryptField(undefined);

      expect(encrypted).toBeNull();
      expect(decrypted).toBeNull();
    });

    it('should handle empty strings', () => {
      const encrypted = encryptionService.encryptField('');
      expect(encrypted).toBeNull();
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask data correctly', () => {
      const data = '1234567890';
      const masked = encryptionService.maskSensitiveData(data);

      expect(masked).toBe('1234**7890');
      expect(masked.length).toBe(data.length);
    });

    it('should mask short data completely', () => {
      const data = '123';
      const masked = encryptionService.maskSensitiveData(data);

      expect(masked).toBe('***');
    });

    it('should handle custom visible characters', () => {
      const data = '1234567890';
      const masked = encryptionService.maskSensitiveData(data, 2);

      expect(masked).toBe('12******90');
    });
  });
});
