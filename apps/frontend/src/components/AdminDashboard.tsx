'use client';

import { useState } from 'react';
import { usePlatformMetrics } from '@/hooks/useAdminData';
import { 
  ChartBarIcon, 
  UsersIcon, 
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  loading?: boolean;
}

function MetricCard({ title, value, change, icon, loading }: MetricCardProps) {
  const isPositive = change !== undefined && change >= 0;
  
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 bg-gray-200 animate-pulse rounded"></div>
          ) : (
            <p className="mt-2 text-3xl font-semibold text-gray-900">{value}</p>
          )}
          {change !== undefined && !loading && (
            <div className="mt-2 flex items-center text-sm">
              {isPositive ? (
                <ArrowTrendingUpIcon className="h-4 w-4 text-green-500 mr-1" />
              ) : (
                <ArrowTrendingDownIcon className="h-4 w-4 text-red-500 mr-1" />
              )}
              <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
                {Math.abs(change)}%
              </span>
              <span className="text-gray-500 ml-1">vs last period</span>
            </div>
          )}
        </div>
        <div className="ml-4 flex-shrink-0">
          <div className="p-3 bg-blue-100 rounded-lg">
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AdminDashboard Component
 * Displays platform metrics and system health monitoring
 * 
 * Requirements: 7.1
 */
export function AdminDashboard() {
  const { metrics, isLoading, error } = usePlatformMetrics();
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('24h');

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Failed to load platform metrics. Please try again.</p>
      </div>
    );
  }

  const formatNumber = (num: number | undefined) => {
    if (num === undefined) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toLocaleString();
  };

  const formatCurrency = (num: number | undefined) => {
    if (num === undefined) return '$0';
    return `$${formatNumber(num)}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Platform metrics and system health monitoring
          </p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex space-x-2">
          {(['24h', '7d', '30d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Users"
          value={formatNumber(metrics?.totalUsers)}
          icon={<UsersIcon className="h-6 w-6 text-blue-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Active Users"
          value={formatNumber(metrics?.activeUsers)}
          icon={<UsersIcon className="h-6 w-6 text-green-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Total Markets"
          value={formatNumber(metrics?.totalMarkets)}
          icon={<ChartBarIcon className="h-6 w-6 text-purple-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Active Markets"
          value={formatNumber(metrics?.activeMarkets)}
          icon={<ChartBarIcon className="h-6 w-6 text-indigo-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Total Volume"
          value={formatCurrency(metrics?.totalVolume)}
          icon={<CurrencyDollarIcon className="h-6 w-6 text-emerald-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Total Trades"
          value={formatNumber(metrics?.totalTrades)}
          icon={<ShoppingCartIcon className="h-6 w-6 text-orange-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Avg Trade Size"
          value={formatCurrency(metrics?.averageTradeSize)}
          icon={<CurrencyDollarIcon className="h-6 w-6 text-teal-600" />}
          loading={isLoading}
        />
        
        <MetricCard
          title="Platform Fees"
          value={formatCurrency(metrics?.platformFees)}
          icon={<CurrencyDollarIcon className="h-6 w-6 text-yellow-600" />}
          loading={isLoading}
        />
      </div>

      {/* System Health Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">API Status</p>
              <p className="text-xs text-gray-500">Operational</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">Database</p>
              <p className="text-xs text-gray-500">Healthy</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
            <div>
              <p className="text-sm font-medium text-gray-900">WebSocket</p>
              <p className="text-xs text-gray-500">Connected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
            Create Market
          </button>
          <button className="px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium">
            Resolve Market
          </button>
          <button className="px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium">
            Flag User
          </button>
        </div>
      </div>
    </div>
  );
}
