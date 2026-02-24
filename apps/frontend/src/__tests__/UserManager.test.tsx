import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserManager } from '@/components/UserManager';
import { useUserManagement } from '@/hooks/useAdminData';
import axios from 'axios';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('@/hooks/useAdminData');
jest.mock('axios');
jest.mock('react-hot-toast');

const mockUseUserManagement = useUserManagement as jest.MockedFunction<typeof useUserManagement>;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockToast = toast as jest.Mocked<typeof toast>;

describe('UserManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
    Storage.prototype.getItem = jest.fn(() => 'mock-token');
    window.prompt = jest.fn();
    window.confirm = jest.fn();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const mockUsers = [
    {
      id: 'user-1',
      walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
      username: 'trader1',
      isVerified: true,
      isAdmin: false,
      isFlagged: false,
      totalVolume: 50000,
      totalTrades: 250,
      createdAt: '2024-01-01T00:00:00Z',
      lastActive: '2024-02-01T00:00:00Z',
    },
    {
      id: 'user-2',
      walletAddress: '0xabcdef1234567890abcdef1234567890abcdef12',
      username: 'trader2',
      isVerified: false,
      isAdmin: false,
      isFlagged: true,
      totalVolume: 30000,
      totalTrades: 150,
      createdAt: '2024-01-15T00:00:00Z',
      lastActive: '2024-02-05T00:00:00Z',
    },
  ];

  it('should render user manager header', () => {
    mockUseUserManagement.mockReturnValue({
      users: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage user accounts, verify users, and moderate activity')).toBeInTheDocument();
  });

  it('should display search and filter controls', () => {
    mockUseUserManagement.mockReturnValue({
      users: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    expect(screen.getByPlaceholderText('Search by wallet address or username...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    mockUseUserManagement.mockReturnValue({
      users: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('should display users when loaded', async () => {
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      expect(screen.getByText('trader1')).toBeInTheDocument();
      expect(screen.getByText('trader2')).toBeInTheDocument();
    });
  });

  it('should display user status badges', async () => {
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByText('Flagged')).toBeInTheDocument();
    });
  });

  it('should display verified badge for verified users', async () => {
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      const verifiedIcons = screen.getAllByTitle('Verified');
      expect(verifiedIcons.length).toBeGreaterThan(0);
    });
  });

  it('should handle flag user action', async () => {
    const mockRefetch = jest.fn();
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    (window.prompt as jest.Mock).mockReturnValue('Suspicious activity');
    mockAxios.post.mockResolvedValue({ data: { success: true } });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      const flagButtons = screen.getAllByTitle('Flag User');
      fireEvent.click(flagButtons[0]);
    });

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/user-1/flag'),
        { reason: 'Suspicious activity' },
        expect.any(Object)
      );
      expect(mockToast.success).toHaveBeenCalledWith('User flagged successfully');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('should handle unflag user action', async () => {
    const mockRefetch = jest.fn();
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockAxios.post.mockResolvedValue({ data: { success: true } });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      const unflagButtons = screen.getAllByTitle('Unflag User');
      fireEvent.click(unflagButtons[0]);
    });

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/users/user-2/unflag'),
        {},
        expect.any(Object)
      );
      expect(mockToast.success).toHaveBeenCalledWith('User unflagged successfully');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('should handle error message when users fail to load', () => {
    mockUseUserManagement.mockReturnValue({
      users: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    expect(screen.getByText('Failed to load users. Please try again.')).toBeInTheDocument();
  });

  it('should display empty state when no users found', () => {
    mockUseUserManagement.mockReturnValue({
      users: [],
      totalCount: 0,
      totalPages: 0,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    expect(screen.getByText('No users found matching your criteria.')).toBeInTheDocument();
  });

  it('should display pagination when multiple pages', async () => {
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 20,
      totalPages: 2,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });

  it('should display wallet addresses in shortened format', async () => {
    mockUseUserManagement.mockReturnValue({
      users: mockUsers,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<UserManager />);
    
    await waitFor(() => {
      expect(screen.getByText('0x1234...5678')).toBeInTheDocument();
      expect(screen.getByText('0xabcd...ef12')).toBeInTheDocument();
    });
  });
});
