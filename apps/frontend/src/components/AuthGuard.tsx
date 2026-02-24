/**
 * Auth Guard Component
 * Protects routes requiring authentication
 * 
 * Requirements: 3.1, 3.5
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
}

export function AuthGuard({ 
  children, 
  requireAuth = true,
  redirectTo = '/'
}: AuthGuardProps) {
  const { isAuthenticated, isConnected, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (requireAuth && !isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, requireAuth, redirectTo, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show connect prompt if wallet not connected
  if (requireAuth && !isConnected) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to access this page
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Show authentication prompt if connected but not authenticated
  if (requireAuth && isConnected && !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="text-6xl mb-4">✍️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Sign to Continue
          </h2>
          <p className="text-gray-600 mb-6">
            Please sign the message with your wallet to authenticate
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
