import { BlockchainService } from '../services/blockchain.service';

// Mock dependencies
jest.mock('../config/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('BlockchainService', () => {
  let blockchainService: BlockchainService;

  beforeEach(() => {
    blockchainService = new BlockchainService('http://localhost:8545', 'test', 1337);
  });

  describe('utility methods', () => {
    it('should validate addresses', () => {
      expect(blockchainService.isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true);
      expect(blockchainService.isValidAddress('0xinvalid')).toBe(false);
      expect(blockchainService.isValidAddress('not an address')).toBe(false);
    });

    it('should format ether', () => {
      const formatted = blockchainService.formatEther('1000000000000000000');
      expect(formatted).toBe('1.0');
    });

    it('should parse ether', () => {
      const parsed = blockchainService.parseEther('1.0');
      expect(parsed).toBe('1000000000000000000');
    });
  });

  describe('service initialization', () => {
    it('should initialize with default values', () => {
      expect(blockchainService).toBeDefined();
    });

    it('should initialize with custom network', () => {
      const customService = new BlockchainService('http://custom:8545', 'custom', 999);
      expect(customService).toBeDefined();
    });
  });

  describe('transaction validation', () => {
    it('should validate transaction structure', () => {
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        from: '0x0987654321098765432109876543210987654321',
        data: '0x'
      };

      expect(blockchainService.isValidAddress(transaction.to)).toBe(true);
      expect(blockchainService.isValidAddress(transaction.from)).toBe(true);
    });
  });
});

