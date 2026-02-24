/**
 * useAuth Hook Tests
 * Tests authentication logic and session management
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import axios from 'axios';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useAccount: jest.fn(),
  useSignMessage: jest.fn(),
  useDisconnect: jest.fn(),
}));

// Mock axios
jest.mock('axios');

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useAuth', () => {
  const mockSignMessageAsync = jest.fn();
  const mockDisconnect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.clear();

    (useAccount as jest.Mock).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    });

    (useSignMessage as jest.Mock).mockReturnValue({
      signMessageAsync: mockSignMessageAsync,
    });

    (useDisconnect as jest.Mock).mockReturnValue({
      disconnect: mockDisconnect,
    });
  });

  it('should initialize with unauthenticated state', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('should load token from localStorage on mount', () => {
    localStorageMock.setItem('auth_token', 'test-token');
    localStorageMock.setItem('auth_user', JSON.stringify({ id: '1', walletAddress: '0x123' }));

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe('test-token');
    expect(result.current.user).toEqual({ id: '1', walletAddress: '0x123' });
  });

  it('should authenticate successfully', async () => {
    const mockNonce = 'test-nonce-123';
    const mockToken = 'jwt-token-123';
    const mockUser = { id: '1', walletAddress: '0x1234567890123456789012345678901234567890' };

    (axios.post as jest.Mock)
      .mockResolvedValueOnce({ data: { nonce: mockNonce } })
      .mockResolvedValueOnce({ data: { token: mockToken, user: mockUser } });

    mockSignMessageAsync.mockResolvedValue('signature-123');

    const { result } = renderHook(() => useAuth());

    let authResult: boolean = false;
    await act(async () => {
      authResult = await result.current.authenticate();
    });

    expect(authResult).toBe(true);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.user).toEqual(mockUser);
    expect(localStorageMock.getItem('auth_token')).toBe(mockToken);
  });

  it('should handle authentication failure', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Invalid signature' } },
    });

    const { result } = renderHook(() => useAuth());

    let authResult: boolean = true;
    await act(async () => {
      authResult = await result.current.authenticate();
    });

    expect(authResult).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Invalid signature');
  });

  it('should logout and clear session', () => {
    localStorageMock.setItem('auth_token', 'test-token');
    localStorageMock.setItem('auth_user', JSON.stringify({ id: '1' }));

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorageMock.getItem('auth_token')).toBeNull();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should clear session when wallet disconnects', () => {
    localStorageMock.setItem('auth_token', 'test-token');
    localStorageMock.setItem('auth_user', JSON.stringify({ id: '1' }));

    const { rerender } = renderHook(() => useAuth());

    // Simulate wallet disconnect
    (useAccount as jest.Mock).mockReturnValue({
      address: null,
      isConnected: false,
    });

    rerender();

    expect(localStorageMock.getItem('auth_token')).toBeNull();
  });

  it('should handle authentication without wallet connection', async () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: null,
      isConnected: false,
    });

    const { result } = renderHook(() => useAuth());

    let authResult: boolean = true;
    await act(async () => {
      authResult = await result.current.authenticate();
    });

    expect(authResult).toBe(false);
    expect(result.current.error).toBe('Wallet not connected');
  });
});
