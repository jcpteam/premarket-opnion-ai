# Web3 Wallet Authentication Service

This service provides comprehensive Web3 wallet authentication for the Prediction Market Platform, supporting MetaMask, WalletConnect, and Coinbase Wallet integration.

## Features

- **Wallet Signature Verification**: Authenticate users using wallet signatures
- **JWT Token Management**: Generate and validate access/refresh tokens
- **Session Management**: Redis-based session storage with automatic cleanup
- **Multi-Wallet Support**: MetaMask, WalletConnect, Coinbase Wallet
- **Security Features**: Nonce-based replay protection, token blacklisting
- **Role-Based Access Control**: Admin and user role management

## Requirements Fulfilled

- **Requirement 3.1**: Wallet signature verification for authentication
- **Requirement 3.4**: Support for MetaMask, WalletConnect, and Coinbase Wallet
- **Requirement 3.5**: Session management with Redis storage

## Security Features

### Nonce-Based Protection
- Each authentication request requires a unique nonce
- Nonces expire after 5 minutes
- Prevents replay attacks

### Token Security
- Access tokens expire after 15 minutes
- Refresh tokens expire after 7 days
- Tokens can be blacklisted for immediate revocation
- httpOnly cookies for refresh tokens

### Session Management
- Redis-based session storage
- Automatic cleanup of expired sessions
- Multi-device session support

## Configuration

Required environment variables:
```
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://...
```

## Testing

Run the test suite:
```bash
npm test -- --testPathPattern=auth.service.test.ts
```

All tests validate:
- Wallet signature verification
- Token generation and validation
- Session management
- Error handling
- Security features