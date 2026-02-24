/**
 * Order Book Component
 * Visualization of buy and sell orders with depth display
 * 
 * Requirements: 2.1, 2.2, 6.4, 10.3
 */

'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface Order {
  price: number;
  quantity: number;
  total: number;
}

interface OrderBookProps {
  marketId: string;
  outcomeId: string;
}

export function OrderBook({ marketId, outcomeId }: OrderBookProps) {
  const [buyOrders, setBuyOrders] = useState<Order[]>([]);
  const [sellOrders, setSellOrders] = useState<Order[]>([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [spread, setSpread] = useState<number>(0);

  useEffect(() => {
    // Fetch initial order book data
    fetchOrderBook();

    // Setup WebSocket for real-time updates
    const ws = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      transports: ['websocket'],
    });

    ws.on('connect', () => {
      ws.emit('subscribeOrderBook', { marketId, outcomeId });
    });

    ws.on('orderBook:update', (data: { buyOrders: Order[]; sellOrders: Order[] }) => {
      setBuyOrders(data.buyOrders);
      setSellOrders(data.sellOrders);
      calculateSpread(data.buyOrders, data.sellOrders);
    });

    setSocket(ws);

    return () => {
      ws.emit('unsubscribeOrderBook', { marketId, outcomeId });
      ws.disconnect();
    };
  }, [marketId, outcomeId]);

  const fetchOrderBook = async () => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/markets/${marketId}/outcomes/${outcomeId}/orderbook`
      );
      const data = await response.json();
      setBuyOrders(data.buyOrders || []);
      setSellOrders(data.sellOrders || []);
      calculateSpread(data.buyOrders || [], data.sellOrders || []);
    } catch (error) {
      console.error('Failed to fetch order book:', error);
    }
  };

  const calculateSpread = (buys: Order[], sells: Order[]) => {
    if (buys.length > 0 && sells.length > 0) {
      const bestBid = buys[0].price;
      const bestAsk = sells[0].price;
      setSpread(bestAsk - bestBid);
    } else {
      setSpread(0);
    }
  };

  const getDepthPercentage = (orders: Order[], currentTotal: number) => {
    if (orders.length === 0) return 0;
    const maxTotal = Math.max(...orders.map(o => o.total));
    return (currentTotal / maxTotal) * 100;
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(3)}`;
  };

  const formatQuantity = (quantity: number) => {
    return quantity.toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Order Book</h3>
          {spread > 0 && (
            <div className="text-sm">
              <span className="text-gray-600">Spread: </span>
              <span className="font-medium text-gray-900">{formatPrice(spread)}</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50">
        <div>Price</div>
        <div className="text-right">Quantity</div>
        <div className="text-right">Total</div>
      </div>

      {/* Sell Orders (Asks) */}
      <div className="px-4 py-2 space-y-1">
        {sellOrders.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No sell orders
          </div>
        ) : (
          sellOrders.slice(0, 10).reverse().map((order, index) => (
            <div
              key={`sell-${index}`}
              className="relative grid grid-cols-3 gap-2 text-sm py-1"
            >
              <div
                className="absolute inset-0 bg-red-50"
                style={{ width: `${getDepthPercentage(sellOrders, order.total)}%` }}
              />
              <div className="relative text-red-600 font-medium">
                {formatPrice(order.price)}
              </div>
              <div className="relative text-right text-gray-900">
                {formatQuantity(order.quantity)}
              </div>
              <div className="relative text-right text-gray-600">
                {formatQuantity(order.total)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Spread Indicator */}
      <div className="px-4 py-3 bg-gray-100 border-y border-gray-200">
        <div className="flex items-center justify-center gap-2 text-sm">
          {buyOrders.length > 0 && sellOrders.length > 0 ? (
            <>
              <span className="text-green-600 font-bold">
                {formatPrice(buyOrders[0].price)}
              </span>
              <span className="text-gray-400">↔</span>
              <span className="text-red-600 font-bold">
                {formatPrice(sellOrders[0].price)}
              </span>
            </>
          ) : (
            <span className="text-gray-500">No spread</span>
          )}
        </div>
      </div>

      {/* Buy Orders (Bids) */}
      <div className="px-4 py-2 space-y-1">
        {buyOrders.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500">
            No buy orders
          </div>
        ) : (
          buyOrders.slice(0, 10).map((order, index) => (
            <div
              key={`buy-${index}`}
              className="relative grid grid-cols-3 gap-2 text-sm py-1"
            >
              <div
                className="absolute inset-0 bg-green-50"
                style={{ width: `${getDepthPercentage(buyOrders, order.total)}%` }}
              />
              <div className="relative text-green-600 font-medium">
                {formatPrice(order.price)}
              </div>
              <div className="relative text-right text-gray-900">
                {formatQuantity(order.quantity)}
              </div>
              <div className="relative text-right text-gray-600">
                {formatQuantity(order.total)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
