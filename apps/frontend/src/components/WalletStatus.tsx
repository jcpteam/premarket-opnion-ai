/**
 * Wallet Status Component
 * Displays wallet connection status and network information
 * 
 * Requirements: 3.1, 3.4, 3.5
 */

'use client';

import { useAccount, useNetwork, useBalance } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';

export function WalletStatus() {
  const { address, isConnected } = useAccount();
  const { chain } = useNetwork();
  const { data: balance } = useBalance({ address });
  const { isAuthenticated } = useAuth();

  if (!isConnected) {
    return null;
  }

  const getNetworkColor = (chainId?: number) => {
    switch (chainId) {
      case 137: // Polygon Mainnet
        return 'bg-purple-100 text-purple-700 border-purple-200';
      case 80001: // Polygon Mumbai
        return 'bg-orange-100 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      {/* Authentication Status */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${
        isAuthenticated 
          ? 'bg-green-50 text-green-700 border-green-200' 
          : 'bg-yellow-50 text-yellow-700 border-yellow-200'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          isAuthenticated ? 'bg-green-500' : 'bg-yellow-500'
        }`}></div>
        <span className="font-medium">
          {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
        </span>
      </div>

      {/* Network Status */}
      {chain && (
        <div className={`px-3 py-1.5 rounded-lg border ${getNetworkColor(chain.id)}`}>
          <span className="font-medium">{chain.name}</span>
        </div>
      )}

      {/* Balance */}
      {balance && (
        <div className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
          <span className="font-medium">
            {parseFloat(balance.formatted).toFixed(4)} {balance.symbol}
          </span>
        </div>
      )}
    </div>
  );
}
