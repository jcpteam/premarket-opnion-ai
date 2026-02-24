import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001';

export interface PlatformMetrics {
  totalUsers: number;
  activeUsers: number;
  totalMarkets: number;
  activeMarkets: number;
  totalVolume: number;
  totalTrades: number;
  averageTradeSize: number;
  platformFees: number;
}

export interface MarketManagement {
  id: string;
  title: string;
  status: 'active' | 'closed' | 'resolved' | 'disputed';
  totalVolume: number;
  totalTrades: number;
  createdAt: string;
  endDate: string;
  creatorId: string;
}

export interface UserAccount {
  id: string;
  walletAddress: string;
  username?: string;
  isVerified: boolean;
  isAdmin: boolean;
  isFlagged: boolean;
  totalVolume: number;
  totalTrades: number;
  createdAt: string;
  lastActive: string;
}

export interface AdminAction {
  id: string;
  adminId: string;
  adminUsername: string;
  action: string;
  targetType: 'market' | 'user' | 'system';
  targetId?: string;
  details: string;
  timestamp: string;
}

/**
 * Hook for fetching platform metrics
 * Requirements: 7.1
 */
export function usePlatformMetrics() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<Partial<PlatformMetrics>>({});

  const { data, isLoading, error, refetch } = useQuery<PlatformMetrics>({
    queryKey: ['admin', 'metrics'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const response = await axios.get(`${API_URL}/api/admin/metrics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      console.log('Admin WebSocket connected');
      newSocket.emit('subscribe', { channel: 'admin:metrics' });
    });

    newSocket.on('admin:metricsUpdate', (update: Partial<PlatformMetrics>) => {
      setRealtimeMetrics(update);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Merge fetched data with real-time updates
  const metrics = data ? { ...data, ...realtimeMetrics } : undefined;

  return { metrics, isLoading, error, refetch };
}

/**
 * Hook for fetching markets for management
 * Requirements: 7.2
 */
export function useMarketManagement(filters?: {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'markets', filters],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await axios.get(`${API_URL}/api/admin/markets?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    staleTime: 30000,
  });

  return {
    markets: data?.markets as MarketManagement[] | undefined,
    totalCount: data?.totalCount as number | undefined,
    totalPages: data?.totalPages as number | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching user accounts for management
 * Requirements: 7.3
 */
export function useUserManagement(filters?: {
  flagged?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'users', filters],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (filters?.flagged !== undefined) params.append('flagged', filters.flagged.toString());
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await axios.get(`${API_URL}/api/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    staleTime: 30000,
  });

  return {
    users: data?.users as UserAccount[] | undefined,
    totalCount: data?.totalCount as number | undefined,
    totalPages: data?.totalPages as number | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook for fetching admin action audit trail
 * Requirements: 7.5
 */
export function useAdminAuditTrail(filters?: {
  adminId?: string;
  targetType?: string;
  page?: number;
  limit?: number;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', filters],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      const params = new URLSearchParams();
      if (filters?.adminId) params.append('adminId', filters.adminId);
      if (filters?.targetType) params.append('targetType', filters.targetType);
      if (filters?.page) params.append('page', filters.page.toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());

      const response = await axios.get(`${API_URL}/api/admin/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return response.data;
    },
    staleTime: 30000,
  });

  return {
    actions: data?.actions as AdminAction[] | undefined,
    totalCount: data?.totalCount as number | undefined,
    totalPages: data?.totalPages as number | undefined,
    isLoading,
    error,
    refetch,
  };
}
