'use client';

import { WalletConnector } from '@/components/WalletConnector';
import { WalletStatus } from '@/components/WalletStatus';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">📊</div>
              <h1 className="text-2xl font-bold text-gray-900">
                Prediction Market Platform
              </h1>
            </div>
            <WalletConnector />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Welcome to the Future of Prediction Markets
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Create, trade, and resolve prediction markets with Web3 integration
          </p>
          <WalletStatus />
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-4">🔗</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Web3 Integration
            </h3>
            <p className="text-gray-600">
              Connect with MetaMask, WalletConnect, or Coinbase Wallet for secure authentication
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-4">📈</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Real-Time Trading
            </h3>
            <p className="text-gray-600">
              Trade prediction market shares with live price updates and order book matching
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Market Creation
            </h3>
            <p className="text-gray-600">
              Create binary and multi-outcome markets on any future event
            </p>
          </div>
        </div>

        {/* Getting Started */}
        <div className="mt-16 bg-white rounded-xl shadow-lg p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">
            Getting Started
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Connect Your Wallet</h4>
                <p className="text-gray-600">
                  Click "Connect Wallet" and choose your preferred Web3 wallet
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Sign to Authenticate</h4>
                <p className="text-gray-600">
                  Sign a message with your wallet to verify ownership and authenticate
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h4 className="font-semibold text-gray-900">Start Trading</h4>
                <p className="text-gray-600">
                  Browse markets, place orders, and profit from your predictions
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}