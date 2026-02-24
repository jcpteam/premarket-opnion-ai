/**
 * Markets Hook
 * Manages market data fetching and real-time updates
 * 
 * Requirements: 6.2, 6.3, 10.1
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

export interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  type: 'BINARY' | 'MULTI_OUTCOME';
  status: 'ACTIVE' | 'CLOSED' | 'RESOLVED' | 'DISPUTED';
  endDate: string;
  totalVolume: number;
  totalShares: number;
  outcomes: Outcome[];
  creator: {
    id: string;
    username: string;
    walletAddress: string;
  };
  createdAt: string;
}

export interface Outcome {
  id: string;
  name: string;
  currentPrice: number;
  totalShares: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
}

interface UseMarketsOptions {
  search?: string;
  category?: string;
  status?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}

export function useMarkets(options: UseMarketsOptions = {}) {
  const {
    search = '',
    category = '',
    status = 'ACTIVE',
    sortBy = 'createdAt',
    page = 1,
    limit = 20,
  } = options;

  const [socket, setSocket] = useState<Socket | null>(null);
  const [realtimeUpdates, setRealtimeUpdates] = useState<Record<string, Partial<Market>>>({});

  // Fetch markets from API
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['markets', search, category, status, sortBy, page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        ...(search && { search }),
        ...(category && { category }),
        ...(status && { status }),
        sortBy,
        page: page.toString(),
        limit: limit.toString(),
      });

      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/markets?${params}`
      );
      return response.data;
    },
    staleTime: 30000, // 30 seconds
  });

  // Setup WebSocket for real-time updates
  useEffect(() => {
    const ws = io(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001', {
      transports: ['websocket'],
    });

    ws.on('connect', () => {
      console.log('Connected to market updates');
    });

    ws.on('market:priceUpdate', (update: { marketId: string; outcomeId: string; price: number }) => {
      setRealtimeUpdates(prev => ({
        ...prev,
        [update.marketId]: {
          ...prev[update.marketId],
          outcomes: prev[update.marketId]?.outcomes?.map(o =>
            o.id === update.outcomeId ? { ...o, currentPrice: update.price } : o
          ),
        },
      }));
    });

    ws.on('market:volumeUpdate', (update: { marketId: string; totalVolume: number }) => {
      setRealtimeUpdates(prev => ({
        ...prev,
        [update.marketId]: {
          ...prev[update.marketId],
          totalVolume: update.totalVolume,
        },
      }));
    });

    setSocket(ws);

    return () => {
      ws.disconnect();
    };
  }, []);

  // Merge real-time updates with fetched data
  const markets = data?.markets?.map((market: Market) => ({
    ...market,
    ...realtimeUpdates[market.id],
  })) || [];

  return {
    markets,
    totalCount: data?.totalCount || 0,
    totalPages: data?.totalPages || 0,
    currentPage: page,
    isLoading,
    error,
    refetch,
  };
}
