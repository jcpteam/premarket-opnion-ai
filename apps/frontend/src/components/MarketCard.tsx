/**
 * Market Card Component
 * Displays market information with real-time price updates
 * 
 * Requirements: 6.2, 6.3, 10.1
 */

'use client';

import { Market } from '@/hooks/useMarkets';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
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

  const formatPrice = (price: number) => {
    return `${(price * 100).toFixed(1)}¢`;
  };

  return (
    <Link href={`/markets/${market.id}`}>
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 cursor-pointer border border-gray-200">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
              {market.title}
            </h3>
            <p className="text-sm text-gray-600 line-clamp-2">
              {market.description}
            </p>
          </div>
          <div className={`ml-3 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(market.status)}`}>
            {market.status}
          </div>
        </div>

        {/* Outcomes */}
        <div className="space-y-2 mb-4">
          {market.outcomes.slice(0, 2).map((outcome) => (
            <div key={outcome.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <span className="font-medium text-gray-900">{outcome.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-blue-600">
                  {formatPrice(outcome.currentPrice)}
                </span>
                <div className="text-xs text-gray-500">
                  <div>Bid: {formatPrice(outcome.bestBid)}</div>
                  <div>Ask: {formatPrice(outcome.bestAsk)}</div>
                </div>
              </div>
            </div>
          ))}
          {market.outcomes.length > 2 && (
            <div className="text-sm text-gray-500 text-center">
              +{market.outcomes.length - 2} more outcomes
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <span className="font-medium">Volume:</span>
              <span>{formatVolume(market.totalVolume)}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-medium">Category:</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded">
                {market.category}
              </span>
            </div>
          </div>
          <div className="text-xs text-gray-500">
            Ends {formatDistanceToNow(new Date(market.endDate), { addSuffix: true })}
          </div>
        </div>

        {/* Tags */}
        {market.tags && market.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {market.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
