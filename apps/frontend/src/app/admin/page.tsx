'use client';

import { useState } from 'react';
import { AuthGuard } from '@/components/AuthGuard';
import { AdminDashboard } from '@/components/AdminDashboard';
import { MarketManager } from '@/components/MarketManager';
import { UserManager } from '@/components/UserManager';
import { AuditTrail } from '@/components/AuditTrail';
import { 
  ChartBarIcon, 
  CubeIcon, 
  UsersIcon, 
  ClipboardDocumentListIcon 
} from '@heroicons/react/24/outline';

type TabType = 'dashboard' | 'markets' | 'users' | 'audit';

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

/**
 * Admin Page
 * Complete administrative interface with dashboard, market management, user management, and audit trail
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.5
 */
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');

  const tabs: TabConfig[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <ChartBarIcon className="h-5 w-5" />,
      component: <AdminDashboard />,
    },
    {
      id: 'markets',
      label: 'Markets',
      icon: <CubeIcon className="h-5 w-5" />,
      component: <MarketManager />,
    },
    {
      id: 'users',
      label: 'Users',
      icon: <UsersIcon className="h-5 w-5" />,
      component: <UserManager />,
    },
    {
      id: 'audit',
      label: 'Audit Trail',
      icon: <ClipboardDocumentListIcon className="h-5 w-5" />,
      component: <AuditTrail />,
    },
  ];

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab);

  return (
    <AuthGuard requireAuth={true} redirectTo="/">
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                  Administrator
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-8" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTabConfig?.component}
        </div>
      </div>
    </AuthGuard>
  );
}
