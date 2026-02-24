import crypto from 'crypto';
import { logger } from '../config/logger';

/**
 * Encryption Service
 * Provides data encryption and decryption using industry-standard algorithms
 * 
 * Requirements: 8.1
 * - Encrypt sensitive user data using industry-standard encryption
 * - Secure key management
 * - Data integrity verification
 */

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
  saltLength: number;
  iterations: number;
  digest: string;
}

export class EncryptionService {
  private readonly config: EncryptionConfig;
  private readonly masterKey: Buffer;

  constructor(masterKey?: string) {
    this.config = {
      algorithm: 'aes-256-gcm',
      keyLength: 32, // 256 bits
      ivLength: 16, // 128 bits
      saltLength: 64,
      iterations: 100000,
      digest: 'sha512',
    };

    // Use provided master key or generate from environment
    const keySource = masterKey || process.env.ENCRYPTION_MASTER_KEY;
    
    if (!keySource) {
      throw new Error('ENCRYPTION_MASTER_KEY must be set');
    }

    // Derive a proper key from the master key
    this.masterKey = crypto.scryptSync(keySource, 'salt', this.config.keyLength);
  }

  /**
   * Encrypt sensitive data
   * Returns base64-encoded encrypted data with IV and auth tag
   */
  encrypt(plaintext: string): string {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.config.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(
        this.config.algorithm,
        this.masterKey,
        iv
      ) as crypto.CipherGCM;

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag for GCM mode
      const authTag = cipher.getAuthTag();

      // Combine IV + authTag + encrypted data
      const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
      ]);

      // Return as base64
      return combined.toString('base64');
    } catch (error) {
      logger.error('Encryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt encrypted data
   * Expects base64-encoded data with IV and auth tag
   */
  decrypt(encryptedData: string): string {
    try {
      // Decode from base64
      const combined = Buffer.from(encryptedData, 'base64');

      // Extract IV, auth tag, and encrypted data
      const iv = combined.subarray(0, this.config.ivLength);
      const authTag = combined.subarray(
        this.config.ivLength,
        this.config.ivLength + 16
      );
      const encrypted = combined.subarray(this.config.ivLength + 16);

      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.config.algorithm,
        this.masterKey,
        iv
      ) as crypto.DecipherGCM;

      // Set authentication tag
      decipher.setAuthTag(authTag);

      // Decrypt data
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash sensitive data (one-way)
   * Useful for passwords, API keys, etc.
   */
  hash(data: string, salt?: string): { hash: string; salt: string } {
    try {
      // Generate salt if not provided
      const actualSalt = salt || crypto.randomBytes(this.config.saltLength).toString('hex');

      // Hash the data
      const hash = crypto.pbkdf2Sync(
        data,
        actualSalt,
        this.config.iterations,
        this.config.keyLength,
        this.config.digest
      ).toString('hex');

      return { hash, salt: actualSalt };
    } catch (error) {
      logger.error('Hashing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to hash data');
    }
  }

  /**
   * Verify hashed data
   */
  verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const { hash: computedHash } = this.hash(data, salt);
      return crypto.timingSafeEqual(
        Buffer.from(hash, 'hex'),
        Buffer.from(computedHash, 'hex')
      );
    } catch (error) {
      logger.error('Hash verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Generate secure random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Generate secure random string (URL-safe)
   */
  generateSecureString(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  /**
   * Encrypt object (converts to JSON first)
   */
  encryptObject(obj: any): string {
    const json = JSON.stringify(obj);
    return this.encrypt(json);
  }

  /**
   * Decrypt object (parses JSON after decryption)
   */
  decryptObject<T = any>(encryptedData: string): T {
    const json = this.decrypt(encryptedData);
    return JSON.parse(json);
  }

  /**
   * Create HMAC signature for data integrity
   */
  createSignature(data: string): string {
    const hmac = crypto.createHmac('sha256', this.masterKey);
    hmac.update(data);
    return hmac.digest('hex');
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(data: string, signature: string): boolean {
    try {
      const expectedSignature = this.createSignature(data);
      
      // Ensure both buffers have the same length
      if (signature.length !== expectedSignature.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt field in database model
   * Useful for encrypting specific sensitive fields
   */
  encryptField(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.encrypt(value);
  }

  /**
   * Decrypt field from database model
   */
  decryptField(encryptedValue: string | null | undefined): string | null {
    if (encryptedValue === null || encryptedValue === undefined || encryptedValue === '') {
      return null;
    }
    try {
      return this.decrypt(encryptedValue);
    } catch (error) {
      logger.warn('Failed to decrypt field, returning null', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Mask sensitive data for logging
   * Shows only first and last few characters
   */
  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const masked = '*'.repeat(data.length - visibleChars * 2);
    return `${start}${masked}${end}`;
  }
}

// Singleton instance
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get encryption service instance
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

/**
 * Initialize encryption service with custom key
 */
export function initializeEncryptionService(masterKey: string): EncryptionService {
  encryptionServiceInstance = new EncryptionService(masterKey);
  return encryptionServiceInstance;
}
