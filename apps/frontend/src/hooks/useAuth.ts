/**
 * Authentication Hook
 * Manages wallet authentication and session state
 * 
 * Requirements: 3.1, 3.4, 3.5
 */

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useSignMessage, useDisconnect } from 'wagmi';
import axios from 'axios';

interface AuthState {
  isAuthenticated: boolean;
  token: string | null;
  user: any | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();

  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    token: null,
    user: null,
    isLoading: false,
    error: null,
  });

  // Load token from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('auth_user');
    
    if (token && user && isConnected) {
      setAuthState({
        isAuthenticated: true,
        token,
        user: JSON.parse(user),
        isLoading: false,
        error: null,
      });
    }
  }, [isConnected]);

  // Clear session when wallet disconnects
  useEffect(() => {
    if (!isConnected && authState.isAuthenticated) {
      handleLogout();
    }
  }, [isConnected]);

  const authenticate = useCallback(async () => {
    if (!address || !isConnected) {
      setAuthState(prev => ({
        ...prev,
        error: 'Wallet not connected',
      }));
      return false;
    }

    setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Request nonce from backend
      const nonceResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/nonce`,
        { walletAddress: address }
      );

      const { nonce } = nonceResponse.data;

      // Sign message with wallet
      const message = `Sign this message to authenticate with Prediction Market Platform.\n\nNonce: ${nonce}`;
      const signature = await signMessageAsync({ message });

      // Verify signature and get JWT token
      const authResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`,
        {
          walletAddress: address,
          signature,
          message,
        }
      );

      const { token, user } = authResponse.data;

      // Store token and user data
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_user', JSON.stringify(user));

      setAuthState({
        isAuthenticated: true,
        token,
        user,
        isLoading: false,
        error: null,
      });

      return true;
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Authentication failed';
      
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));

      return false;
    }
  }, [address, isConnected, signMessageAsync]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    setAuthState({
      isAuthenticated: false,
      token: null,
      user: null,
      isLoading: false,
      error: null,
    });

    disconnect();
  }, [disconnect]);

  return {
    ...authState,
    address,
    isConnected,
    authenticate,
    logout: handleLogout,
  };
}
