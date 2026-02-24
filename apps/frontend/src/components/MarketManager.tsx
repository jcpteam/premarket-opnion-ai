'use client';

import { useState } from 'react';
import { useMarketManagement } from '@/hooks/useAdminData';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * MarketManager Component
 * Tools for market creation, modification, and resolution
 * 
 * Requirements: 7.2
 */
export function MarketManager() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { markets, totalPages, isLoading, error, refetch } = useMarketManagement({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
    limit: 10,
  });

  const handlePauseMarket = async (marketId: string) => {
    try {
      setActionLoading(marketId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/markets/${marketId}/pause`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Market paused successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to pause market');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResumeMarket = async (marketId: string) => {
    try {
      setActionLoading(marketId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/markets/${marketId}/resume`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Market resumed successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to resume market');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveMarket = async (marketId: string) => {
    const outcomeId = prompt('Enter the winning outcome ID:');
    if (!outcomeId) return;

    try {
      setActionLoading(marketId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/markets/${marketId}/resolve`,
        { outcomeId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Market resolved successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to resolve market');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteMarket = async (marketId: string) => {
    if (!confirm('Are you sure you want to delete this market? This action cannot be undone.')) {
      return;
    }

    try {
      setActionLoading(marketId);
      const token = localStorage.getItem('authToken');
      await axios.delete(`${API_URL}/api/admin/markets/${marketId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Market deleted successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to delete market');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800',
      resolved: 'bg-blue-100 text-blue-800',
      disputed: 'bg-red-100 text-red-800',
    };
    return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Market Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage markets, pause trading, and resolve outcomes
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search markets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
            <option value="resolved">Resolved</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
      </div>

      {/* Markets Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-800">Failed to load markets. Please try again.</p>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading markets...</p>
          </div>
        ) : markets && markets.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Market
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Volume
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trades
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {markets.map((market) => (
                  <tr key={market.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{market.title}</div>
                      <div className="text-xs text-gray-500">ID: {market.id.slice(0, 8)}...</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(market.status)}`}>
                        {market.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${market.totalVolume.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {market.totalTrades}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(market.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      {market.status === 'active' && (
                        <button
                          onClick={() => handlePauseMarket(market.id)}
                          disabled={actionLoading === market.id}
                          className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                          title="Pause Market"
                        >
                          <PauseIcon className="h-5 w-5 inline" />
                        </button>
                      )}
                      
                      {market.status === 'closed' && (
                        <>
                          <button
                            onClick={() => handleResumeMarket(market.id)}
                            disabled={actionLoading === market.id}
                            className="text-green-600 hover:text-green-900 disabled:opacity-50"
                            title="Resume Market"
                          >
                            <PlayIcon className="h-5 w-5 inline" />
                          </button>
                          <button
                            onClick={() => handleResolveMarket(market.id)}
                            disabled={actionLoading === market.id}
                            className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                            title="Resolve Market"
                          >
                            <CheckCircleIcon className="h-5 w-5 inline" />
                          </button>
                        </>
                      )}
                      
                      <button
                        onClick={() => handleDeleteMarket(market.id)}
                        disabled={actionLoading === market.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Delete Market"
                      >
                        <XCircleIcon className="h-5 w-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No markets found matching your criteria.
          </div>
        )}

        {/* Pagination */}
        {totalPages && totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-700">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
