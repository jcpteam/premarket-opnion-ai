/**
 * Trading Interface Component
 * Order placement interface for buying and selling market shares
 * 
 * Requirements: 2.1, 2.2, 6.4, 10.3
 */

'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import toast from 'react-hot-toast';

interface TradingInterfaceProps {
  marketId: string;
  outcomeId: string;
  outcomeName: string;
  currentPrice: number;
  bestBid: number;
  bestAsk: number;
}

type OrderType = 'BUY' | 'SELL';
type OrderSubType = 'MARKET' | 'LIMIT';

export function TradingInterface({
  marketId,
  outcomeId,
  outcomeName,
  currentPrice,
  bestBid,
  bestAsk,
}: TradingInterfaceProps) {
  const { isAuthenticated, token } = useAuth();
  const [orderType, setOrderType] = useState<OrderType>('BUY');
  const [orderSubType, setOrderSubType] = useState<OrderSubType>('MARKET');
  const [quantity, setQuantity] = useState<string>('');
  const [price, setPrice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      toast.error('Please connect and authenticate your wallet');
      return;
    }

    if (!quantity || parseFloat(quantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    if (orderSubType === 'LIMIT' && (!price || parseFloat(price) <= 0 || parseFloat(price) > 1)) {
      toast.error('Please enter a valid price between 0 and 1');
      return;
    }

    setIsSubmitting(true);

    try {
      const orderData = {
        marketId,
        outcomeId,
        type: orderType,
        orderType: orderSubType,
        quantity: parseFloat(quantity),
        ...(orderSubType === 'LIMIT' && { price: parseFloat(price) }),
      };

      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/orders`,
        orderData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      toast.success(`${orderType} order placed successfully!`);
      
      // Reset form
      setQuantity('');
      setPrice('');
      
      // Emit event for order book update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('orderPlaced', { detail: response.data }));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to place order';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateTotal = () => {
    const qty = parseFloat(quantity) || 0;
    let orderPrice = currentPrice;

    if (orderSubType === 'LIMIT' && price) {
      orderPrice = parseFloat(price);
    } else if (orderType === 'BUY') {
      orderPrice = bestAsk;
    } else {
      orderPrice = bestBid;
    }

    return (qty * orderPrice).toFixed(2);
  };

  const suggestedPrice = orderType === 'BUY' ? bestAsk : bestBid;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <h3 className="text-xl font-bold text-gray-900 mb-4">
        Trade: {outcomeName}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Order Type Tabs */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOrderType('BUY')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              orderType === 'BUY'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setOrderType('SELL')}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
              orderType === 'SELL'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Order Sub-Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Order Type
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOrderSubType('MARKET')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                orderSubType === 'MARKET'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Market
            </button>
            <button
              type="button"
              onClick={() => setOrderSubType('LIMIT')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                orderSubType === 'LIMIT'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Quantity Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quantity (shares)
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Enter quantity"
            min="0"
            step="1"
            className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          />
        </div>

        {/* Price Input (for limit orders) */}
        {orderSubType === 'LIMIT' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Price (per share)
            </label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={`Suggested: ${suggestedPrice.toFixed(3)}`}
                min="0"
                max="1"
                step="0.001"
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
              />
              <button
                type="button"
                onClick={() => setPrice(suggestedPrice.toString())}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Use {suggestedPrice.toFixed(3)}
              </button>
            </div>
          </div>
        )}

        {/* Order Summary */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Current Price:</span>
            <span className="font-medium text-gray-900">${currentPrice.toFixed(3)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Best {orderType === 'BUY' ? 'Ask' : 'Bid'}:</span>
            <span className="font-medium text-gray-900">
              ${(orderType === 'BUY' ? bestAsk : bestBid).toFixed(3)}
            </span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-gray-200">
            <span className="font-medium text-gray-900">Estimated Total:</span>
            <span className="font-bold text-gray-900">${calculateTotal()}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!isAuthenticated || isSubmitting}
          className={`w-full py-3 px-4 rounded-lg font-medium text-white transition-colors ${
            orderType === 'BUY'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isSubmitting ? 'Placing Order...' : `${orderType} ${outcomeName}`}
        </button>

        {!isAuthenticated && (
          <p className="text-sm text-center text-gray-600">
            Connect your wallet to start trading
          </p>
        )}
      </form>
    </div>
  );
}
