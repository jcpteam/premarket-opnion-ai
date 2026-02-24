/**
 * Wallet Connector Component Tests
 * Tests wallet connection functionality and UI
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletConnector } from '@/components/WalletConnector';
import { useConnect, useAccount, useDisconnect } from 'wagmi';
import { useAuth } from '@/hooks/useAuth';

// Mock wagmi hooks
jest.mock('wagmi', () => ({
  useConnect: jest.fn(),
  useAccount: jest.fn(),
  useDisconnect: jest.fn(),
}));

// Mock useAuth hook
jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
}));

// Mock toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('WalletConnector', () => {
  const mockConnect = jest.fn();
  const mockDisconnect = jest.fn();
  const mockAuthenticate = jest.fn();
  const mockLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useConnect as jest.Mock).mockReturnValue({
      connect: mockConnect,
      connectors: [
        { id: 'metamask', name: 'MetaMask', ready: true },
        { id: 'walletConnect', name: 'WalletConnect', ready: true },
        { id: 'coinbaseWallet', name: 'Coinbase Wallet', ready: true },
      ],
      isLoading: false,
      error: null,
    });

    (useDisconnect as jest.Mock).mockReturnValue({
      disconnect: mockDisconnect,
    });
  });

  it('should render connect button when not connected', () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: null,
      isConnected: false,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: false,
    });

    render(<WalletConnector />);

    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('should show wallet selection modal when connect button clicked', () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: null,
      isConnected: false,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: false,
    });

    render(<WalletConnector />);

    fireEvent.click(screen.getByText('Connect Wallet'));

    expect(screen.getByText('Choose your preferred wallet to connect')).toBeInTheDocument();
    expect(screen.getByText('MetaMask')).toBeInTheDocument();
    expect(screen.getByText('WalletConnect')).toBeInTheDocument();
    expect(screen.getByText('Coinbase Wallet')).toBeInTheDocument();
  });

  it('should show authenticate button when connected but not authenticated', () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: false,
    });

    render(<WalletConnector />);

    expect(screen.getByText('Sign to Authenticate')).toBeInTheDocument();
  });

  it('should show connected state when authenticated', () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: false,
    });

    render(<WalletConnector />);

    expect(screen.getByText('0x1234...7890')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('should call disconnect when disconnect button clicked', () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: false,
    });

    render(<WalletConnector />);

    fireEvent.click(screen.getByText('Disconnect'));

    expect(mockLogout).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('should handle wallet connection', async () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: null,
      isConnected: false,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: false,
    });

    render(<WalletConnector />);

    // Open modal
    fireEvent.click(screen.getByText('Connect Wallet'));

    // Click MetaMask
    fireEvent.click(screen.getByText('MetaMask'));

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  it('should show loading state during authentication', () => {
    (useAccount as jest.Mock).mockReturnValue({
      address: '0x1234567890123456789012345678901234567890',
      isConnected: true,
    });

    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      authenticate: mockAuthenticate,
      logout: mockLogout,
      isLoading: true,
    });

    render(<WalletConnector />);

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
  });
});
