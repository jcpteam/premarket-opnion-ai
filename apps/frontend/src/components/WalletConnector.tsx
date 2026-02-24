/**
 * Wallet Connector Component
 * Multi-wallet connection interface with status indicators
 * 
 * Requirements: 3.1, 3.4, 3.5
 */

'use client';

import { useState, useEffect } from 'react';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

interface WalletConnectorProps {
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export function WalletConnector({ onConnect, onDisconnect }: WalletConnectorProps) {
  const { connect, connectors, isLoading: isConnecting, error: connectError } = useConnect();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { isAuthenticated, authenticate, logout, isLoading: isAuthenticating } = useAuth();

  const [showModal, setShowModal] = useState(false);

  // Handle connection errors
  useEffect(() => {
    if (connectError) {
      toast.error(connectError.message || 'Failed to connect wallet');
    }
  }, [connectError]);

  // Auto-authenticate after wallet connection
  useEffect(() => {
    if (isConnected && !isAuthenticated && address) {
      handleAuthenticate();
    }
  }, [isConnected, isAuthenticated, address]);

  const handleConnect = async (connectorId: string) => {
    try {
      const connector = connectors.find(c => c.id === connectorId);
      if (connector) {
        await connect({ connector });
        setShowModal(false);
        onConnect?.();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect wallet');
    }
  };

  const handleAuthenticate = async () => {
    const success = await authenticate();
    if (success) {
      toast.success('Successfully authenticated!');
    }
  };

  const handleDisconnect = () => {
    logout();
    disconnect();
    onDisconnect?.();
    toast.success('Wallet disconnected');
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const getConnectorIcon = (connectorName: string) => {
    switch (connectorName.toLowerCase()) {
      case 'metamask':
        return '🦊';
      case 'walletconnect':
        return '🔗';
      case 'coinbase wallet':
        return '🔵';
      default:
        return '👛';
    }
  };

  if (isConnected && isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-green-700">
            {formatAddress(address!)}
          </span>
        </div>
        <button
          onClick={handleDisconnect}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (isConnected && !isAuthenticated) {
    return (
      <button
        onClick={handleAuthenticate}
        disabled={isAuthenticating}
        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isAuthenticating ? 'Authenticating...' : 'Sign to Authenticate'}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-6 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Connect Wallet
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Connect Wallet
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-sm text-gray-600">
                Choose your preferred wallet to connect
              </p>
            </div>

            <div className="p-6 space-y-3">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => handleConnect(connector.id)}
                  disabled={isConnecting || !connector.ready}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-2xl">
                    {getConnectorIcon(connector.name)}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {connector.name}
                    </div>
                    {!connector.ready && (
                      <div className="text-xs text-gray-500">Not installed</div>
                    )}
                  </div>
                  {isConnecting && (
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-6 bg-gray-50 rounded-b-xl">
              <p className="text-xs text-gray-600 text-center">
                By connecting your wallet, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
