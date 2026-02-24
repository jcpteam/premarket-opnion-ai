/**
 * Markets Page
 * Main market discovery and browsing interface
 * 
 * Requirements: 6.2, 6.3, 10.1
 */

'use client';

import { useState } from 'react';
import { useMarkets } from '@/hooks/useMarkets';
import { MarketSearch } from '@/components/MarketSearch';
import { MarketFilters } from '@/components/MarketFilters';
import { MarketList } from '@/components/MarketList';
import { CategoryNav } from '@/components/CategoryNav';
import { WalletConnector } from '@/components/WalletConnector';
import Link from 'next/link';

export default function MarketsPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [sortBy, setSortBy] = useState('createdAt');
  const [page, setPage] = useState(1);

  const { markets, totalCount, totalPages, currentPage, isLoading, error, refetch } = useMarkets({
    search,
    category,
    status,
    sortBy,
    page,
    limit: 12,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
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
        {/* Page Title and Stats */}
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Explore Markets
          </h2>
          <p className="text-gray-600">
            {totalCount > 0 ? (
              <>
                Showing {markets.length} of {totalCount} markets
              </>
            ) : (
              'Browse and trade on prediction markets'
            )}
          </p>
        </div>

        {/* Category Navigation */}
        <div className="mb-6">
          <CategoryNav
            selectedCategory={category}
            onCategorySelect={(cat) => {
              setCategory(cat);
              setPage(1);
            }}
          />
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <MarketSearch
            onSearch={(query) => {
              setSearch(query);
              setPage(1);
            }}
            placeholder="Search markets by title, description, or tags..."
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <MarketFilters
            selectedCategory={category}
            selectedStatus={status}
            selectedSort={sortBy}
            onCategoryChange={(cat) => {
              setCategory(cat);
              setPage(1);
            }}
            onStatusChange={(stat) => {
              setStatus(stat);
              setPage(1);
            }}
            onSortChange={(sort) => {
              setSortBy(sort);
              setPage(1);
            }}
          />
        </div>

        {/* Market List */}
        <MarketList
          markets={markets}
          isLoading={isLoading}
          error={error}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
