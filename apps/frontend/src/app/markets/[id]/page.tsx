/**
 * Market Detail Page
 * Complete trading interface for a specific market
 * 
 * Requirements: 2.1, 2.2, 6.4, 10.3
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { TradingInterface } from '@/components/TradingInterface';
import { OrderBook } from '@/components/OrderBook';
import { PriceChart } from '@/components/PriceChart';
import { WalletConnector } from '@/components/WalletConnector';
import { Market } from '@/hooks/useMarkets';
import { formatDistanceToNow } from 'date-fns';

export default function MarketDetailPage() {
  const params = useParams();
  const marketId = params.id as string;

  const [market, setMarket] = useState<Market | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMarket();
  }, [marketId]);

  const fetchMarket = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/markets/${marketId}`
      );

      if (!response.ok) {
        throw new Error('Market not found');
      }

      const data = await response.json();
      setMarket(data);
      
      // Select first outcome by default
      if (data.outcomes && data.outcomes.length > 0) {
        setSelectedOutcomeId(data.outcomes[0].id);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'CLOSED':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'RESOLVED':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'DISPUTED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) {
      return `$${(volume / 1000000).toFixed(2)}M`;
    } else if (volume >= 1000) {
      return `$${(volume / 1000).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading market...</p>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Market Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            {error || 'The market you are looking for does not exist.'}
          </p>
          <Link
            href="/markets"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Browse Markets
          </Link>
        </div>
      </div>
    );
  }

  const selectedOutcome = market.outcomes.find(o => o.id === selectedOutcomeId) || market.outcomes[0];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/markets" className="flex items-center gap-3">
              <div className="text-3xl">📊</div>
              <h1 className="text-2xl font-bold text-gray-900">
                Prediction Markets
              </h1>
            </Link>
            <WalletConnector />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Market Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {market.title}
              </h2>
              <p className="text-gray-600 mb-4">
                {market.description}
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className={`px-3 py-1 rounded-full border font-medium ${getStatusColor(market.status)}`}>
                  {market.status}
                </div>
                <div className="text-gray-600">
                  <span className="font-medium">Category:</span>{' '}
                  <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded">{market.category}</span>
                </div>
                <div className="text-gray-600">
                  <span className="font-medium">Volume:</span> {formatVolume(market.totalVolume)}
                </div>
                <div className="text-gray-600">
                  <span className="font-medium">Ends:</span>{' '}
                  {formatDistanceToNow(new Date(market.endDate), { addSuffix: true })}
                </div>
              </div>
            </div>
          </div>

          {/* Outcome Selector */}
          <div className="flex flex-wrap gap-2">
            {market.outcomes.map((outcome) => (
              <button
                key={outcome.id}
                onClick={() => setSelectedOutcomeId(outcome.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedOutcomeId === outcome.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {outcome.name} - ${(outcome.currentPrice * 100).toFixed(1)}¢
              </button>
            ))}
          </div>
        </div>

        {/* Trading Interface Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Trading Form */}
          <div className="lg:col-span-1">
            <TradingInterface
              marketId={market.id}
              outcomeId={selectedOutcome.id}
              outcomeName={selectedOutcome.name}
              currentPrice={selectedOutcome.currentPrice}
              bestBid={selectedOutcome.bestBid}
              bestAsk={selectedOutcome.bestAsk}
            />
          </div>

          {/* Order Book */}
          <div className="lg:col-span-2">
            <OrderBook
              marketId={market.id}
              outcomeId={selectedOutcome.id}
            />
          </div>
        </div>

        {/* Price Chart */}
        <div className="mb-6">
          <PriceChart
            marketId={market.id}
            outcomeId={selectedOutcome.id}
            outcomeName={selectedOutcome.name}
          />
        </div>

        {/* Market Info */}
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Market Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Creator</h4>
              <p className="text-gray-900">{market.creator.username || 'Anonymous'}</p>
              <p className="text-sm text-gray-500 font-mono">
                {market.creator.walletAddress.slice(0, 10)}...{market.creator.walletAddress.slice(-8)}
              </p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Market Type</h4>
              <p className="text-gray-900">{market.type === 'BINARY' ? 'Binary' : 'Multi-Outcome'}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Total Shares</h4>
              <p className="text-gray-900">{market.totalShares.toLocaleString()}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Created</h4>
              <p className="text-gray-900">
                {formatDistanceToNow(new Date(market.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>

          {market.tags && market.tags.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {market.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
