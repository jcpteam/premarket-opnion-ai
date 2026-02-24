'use client';

import { useState } from 'react';
import { useAdminAuditTrail } from '@/hooks/useAdminData';
import { ClockIcon, UserIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

/**
 * AuditTrail Component
 * Displays audit trail of administrative actions
 * 
 * Requirements: 7.5
 */
export function AuditTrail() {
  const [targetTypeFilter, setTargetTypeFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  const { actions, totalPages, isLoading, error } = useAdminAuditTrail({
    targetType: targetTypeFilter || undefined,
    page,
    limit: 20,
  });

  const getActionIcon = (targetType: string) => {
    switch (targetType) {
      case 'market':
        return <DocumentTextIcon className="h-5 w-5 text-blue-500" />;
      case 'user':
        return <UserIcon className="h-5 w-5 text-purple-500" />;
      case 'system':
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
      default:
        return <DocumentTextIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('delete') || action.includes('suspend') || action.includes('flag')) {
      return 'text-red-600';
    }
    if (action.includes('create') || action.includes('verify') || action.includes('approve')) {
      return 'text-green-600';
    }
    if (action.includes('pause') || action.includes('update')) {
      return 'text-yellow-600';
    }
    return 'text-blue-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Audit Trail</h2>
        <p className="mt-1 text-sm text-gray-500">
          Complete log of all administrative actions with timestamps
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by type:</label>
          <select
            value={targetTypeFilter}
            onChange={(e) => setTargetTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Actions</option>
            <option value="market">Market Actions</option>
            <option value="user">User Actions</option>
            <option value="system">System Actions</option>
          </select>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {error && (
          <div className="p-4 bg-red-50 border-b border-red-200">
            <p className="text-red-800">Failed to load audit trail. Please try again.</p>
          </div>
        )}

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading audit trail...</p>
          </div>
        ) : actions && actions.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {actions.map((action) => (
              <div key={action.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start space-x-4">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getActionIcon(action.targetType)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">
                        {action.adminUsername}
                        <span className={`ml-2 ${getActionColor(action.action)}`}>
                          {action.action}
                        </span>
                      </p>
                      <div className="flex items-center text-sm text-gray-500">
                        <ClockIcon className="h-4 w-4 mr-1" />
                        {new Date(action.timestamp).toLocaleString()}
                      </div>
                    </div>
                    
                    <p className="mt-1 text-sm text-gray-600">{action.details}</p>
                    
                    {action.targetId && (
                      <p className="mt-1 text-xs text-gray-500">
                        Target ID: {action.targetId}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No audit trail entries found.
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
