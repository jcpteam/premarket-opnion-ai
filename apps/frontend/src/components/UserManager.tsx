'use client';

import { useState } from 'react';
import { useUserManagement } from '@/hooks/useAdminData';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  MagnifyingGlassIcon,
  FlagIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * UserManager Component
 * User account management and moderation tools
 * 
 * Requirements: 7.3
 */
export function UserManager() {
  const [search, setSearch] = useState('');
  const [flaggedFilter, setFlaggedFilter] = useState<boolean | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { users, totalPages, isLoading, error, refetch } = useUserManagement({
    flagged: flaggedFilter,
    search: search || undefined,
    page,
    limit: 10,
  });

  const handleFlagUser = async (userId: string) => {
    const reason = prompt('Enter reason for flagging this user:');
    if (!reason) return;

    try {
      setActionLoading(userId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/flag`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('User flagged successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to flag user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnflagUser = async (userId: string) => {
    try {
      setActionLoading(userId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/unflag`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('User unflagged successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to unflag user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerifyUser = async (userId: string) => {
    try {
      setActionLoading(userId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/verify`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('User verified successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to verify user');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMakeAdmin = async (userId: string) => {
    if (!confirm('Are you sure you want to grant admin privileges to this user?')) {
      return;
    }

    try {
      setActionLoading(userId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/make-admin`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('User granted admin privileges');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to grant admin privileges');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    const reason = prompt('Enter reason for suspending this user:');
    if (!reason) return;

    if (!confirm('Are you sure you want to suspend this user? They will not be able to trade.')) {
      return;
    }

    try {
      setActionLoading(userId);
      const token = localStorage.getItem('authToken');
      await axios.post(
        `${API_URL}/api/admin/users/${userId}/suspend`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('User suspended successfully');
      refetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || 'Failed to suspend user');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage user accounts, verify users, and moderate activity
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
              placeholder="Search by wallet address or username..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Flagged Filter */}
          <select
            value={flaggedFilter === undefined ? '' : flaggedFilter.toString()}
            onChange={(e) => setFlaggedFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Users</option>
            <option value="true">Flagged Only</option>
            <option value="false">Not Flagged</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-800">Failed to load users. Please try again.</p>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading users...</p>
          </div>
        ) : users && users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
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
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {user.username || 'Anonymous'}
                            {user.isAdmin && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                Admin
                              </span>
                            )}
                            {user.isVerified && (
                              <CheckBadgeIcon className="ml-1 h-4 w-4 inline text-blue-500" title="Verified" />
                            )}
                          </div>
                          <div className="text-xs text-gray-500">
                            {user.walletAddress.slice(0, 6)}...{user.walletAddress.slice(-4)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {user.isFlagged ? (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          <FlagIcon className="h-3 w-3 mr-1" />
                          Flagged
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${user.totalVolume.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {user.totalTrades}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      {user.isFlagged ? (
                        <button
                          onClick={() => handleUnflagUser(user.id)}
                          disabled={actionLoading === user.id}
                          className="text-green-600 hover:text-green-900 disabled:opacity-50"
                          title="Unflag User"
                        >
                          <ShieldCheckIcon className="h-5 w-5 inline" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleFlagUser(user.id)}
                          disabled={actionLoading === user.id}
                          className="text-yellow-600 hover:text-yellow-900 disabled:opacity-50"
                          title="Flag User"
                        >
                          <FlagIcon className="h-5 w-5 inline" />
                        </button>
                      )}
                      
                      {!user.isVerified && (
                        <button
                          onClick={() => handleVerifyUser(user.id)}
                          disabled={actionLoading === user.id}
                          className="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                          title="Verify User"
                        >
                          <CheckBadgeIcon className="h-5 w-5 inline" />
                        </button>
                      )}
                      
                      {!user.isAdmin && (
                        <button
                          onClick={() => handleMakeAdmin(user.id)}
                          disabled={actionLoading === user.id}
                          className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                          title="Make Admin"
                        >
                          <ShieldCheckIcon className="h-5 w-5 inline" />
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleSuspendUser(user.id)}
                        disabled={actionLoading === user.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        title="Suspend User"
                      >
                        <UserMinusIcon className="h-5 w-5 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No users found matching your criteria.
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
