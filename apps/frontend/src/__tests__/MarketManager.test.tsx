import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarketManager } from '@/components/MarketManager';
import { useMarketManagement } from '@/hooks/useAdminData';
import axios from 'axios';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('@/hooks/useAdminData');
jest.mock('axios');
jest.mock('react-hot-toast');

const mockUseMarketManagement = useMarketManagement as jest.MockedFunction<typeof useMarketManagement>;
const mockAxios = axios as jest.Mocked<typeof axios>;
const mockToast = toast as jest.Mocked<typeof toast>;

describe('MarketManager', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
    Storage.prototype.getItem = jest.fn(() => 'mock-token');
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  const mockMarkets = [
    {
      id: 'market-1',
      title: 'Will Bitcoin reach $100k in 2024?',
      status: 'active' as const,
      totalVolume: 50000,
      totalTrades: 250,
      createdAt: '2024-01-01T00:00:00Z',
      endDate: '2024-12-31T23:59:59Z',
      creatorId: 'user-1',
    },
    {
      id: 'market-2',
      title: 'Will Ethereum merge succeed?',
      status: 'closed' as const,
      totalVolume: 30000,
      totalTrades: 150,
      createdAt: '2024-01-15T00:00:00Z',
      endDate: '2024-06-30T23:59:59Z',
      creatorId: 'user-2',
    },
  ];

  it('should render market manager header', () => {
    mockUseMarketManagement.mockReturnValue({
      markets: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    expect(screen.getByText('Market Management')).toBeInTheDocument();
    expect(screen.getByText('Manage markets, pause trading, and resolve outcomes')).toBeInTheDocument();
  });

  it('should display search and filter controls', () => {
    mockUseMarketManagement.mockReturnValue({
      markets: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    expect(screen.getByPlaceholderText('Search markets...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    mockUseMarketManagement.mockReturnValue({
      markets: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    expect(screen.getByText('Loading markets...')).toBeInTheDocument();
  });

  it('should display markets when loaded', async () => {
    mockUseMarketManagement.mockReturnValue({
      markets: mockMarkets,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Will Bitcoin reach $100k in 2024?')).toBeInTheDocument();
      expect(screen.getByText('Will Ethereum merge succeed?')).toBeInTheDocument();
    });
  });

  it('should display market status badges', async () => {
    mockUseMarketManagement.mockReturnValue({
      markets: mockMarkets,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    await waitFor(() => {
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('closed')).toBeInTheDocument();
    });
  });

  it('should handle pause market action', async () => {
    const mockRefetch = jest.fn();
    mockUseMarketManagement.mockReturnValue({
      markets: mockMarkets,
      totalCount: 2,
      totalPages: 1,
      isLoading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockAxios.post.mockResolvedValue({ data: { success: true } });

    renderWithProviders(<MarketManager />);
    
    await waitFor(() => {
      const pauseButtons = screen.getAllByTitle('Pause Market');
      fireEvent.click(pauseButtons[0]);
    });

    await waitFor(() => {
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/admin/markets/market-1/pause'),
        {},
        expect.any(Object)
      );
      expect(mockToast.success).toHaveBeenCalledWith('Market paused successfully');
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('should handle error message when markets fail to load', () => {
    mockUseMarketManagement.mockReturnValue({
      markets: undefined,
      totalCount: undefined,
      totalPages: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    expect(screen.getByText('Failed to load markets. Please try again.')).toBeInTheDocument();
  });

  it('should display empty state when no markets found', () => {
    mockUseMarketManagement.mockReturnValue({
      markets: [],
      totalCount: 0,
      totalPages: 0,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    expect(screen.getByText('No markets found matching your criteria.')).toBeInTheDocument();
  });

  it('should display pagination when multiple pages', async () => {
    mockUseMarketManagement.mockReturnValue({
      markets: mockMarkets,
      totalCount: 20,
      totalPages: 2,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<MarketManager />);
    
    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
      expect(screen.getByText('Next')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    });
  });
});
