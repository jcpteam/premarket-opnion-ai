import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminDashboard } from '@/components/AdminDashboard';
import { usePlatformMetrics } from '@/hooks/useAdminData';

// Mock the hooks
jest.mock('@/hooks/useAdminData');

const mockUsePlatformMetrics = usePlatformMetrics as jest.MockedFunction<typeof usePlatformMetrics>;

describe('AdminDashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    jest.clearAllMocks();
  });

  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should render dashboard header', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Platform metrics and system health monitoring')).toBeInTheDocument();
  });

  it('should display loading state', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    const loadingElements = screen.getAllByRole('generic').filter(
      el => el.className.includes('animate-pulse')
    );
    expect(loadingElements.length).toBeGreaterThan(0);
  });

  it('should display platform metrics when loaded', async () => {
    const mockMetrics = {
      totalUsers: 1500,
      activeUsers: 450,
      totalMarkets: 120,
      activeMarkets: 85,
      totalVolume: 2500000,
      totalTrades: 8500,
      averageTradeSize: 294.12,
      platformFees: 12500,
    };

    mockUsePlatformMetrics.mockReturnValue({
      metrics: mockMetrics,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('1.50K')).toBeInTheDocument(); // Total Users
      expect(screen.getByText('450')).toBeInTheDocument(); // Active Users
      expect(screen.getByText('120')).toBeInTheDocument(); // Total Markets
      expect(screen.getByText('85')).toBeInTheDocument(); // Active Markets
    });
  });

  it('should format large numbers correctly', async () => {
    const mockMetrics = {
      totalUsers: 1500000,
      activeUsers: 450000,
      totalMarkets: 120,
      activeMarkets: 85,
      totalVolume: 2500000,
      totalTrades: 8500000,
      averageTradeSize: 294.12,
      platformFees: 12500,
    };

    mockUsePlatformMetrics.mockReturnValue({
      metrics: mockMetrics,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    await waitFor(() => {
      expect(screen.getByText('1.50M')).toBeInTheDocument(); // Total Users
      expect(screen.getByText('450.00K')).toBeInTheDocument(); // Active Users
      expect(screen.getByText('8.50M')).toBeInTheDocument(); // Total Trades
    });
  });

  it('should display error message when metrics fail to load', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    expect(screen.getByText('Failed to load platform metrics. Please try again.')).toBeInTheDocument();
  });

  it('should display system health status', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    expect(screen.getByText('System Health')).toBeInTheDocument();
    expect(screen.getByText('API Status')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('WebSocket')).toBeInTheDocument();
  });

  it('should display quick actions', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
    expect(screen.getByText('Create Market')).toBeInTheDocument();
    expect(screen.getByText('Resolve Market')).toBeInTheDocument();
    expect(screen.getByText('Flag User')).toBeInTheDocument();
  });

  it('should have time range selector', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    expect(screen.getByText('24H')).toBeInTheDocument();
    expect(screen.getByText('7D')).toBeInTheDocument();
    expect(screen.getByText('30D')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('should display all metric cards', () => {
    mockUsePlatformMetrics.mockReturnValue({
      metrics: undefined,
      isLoading: true,
      error: null,
      refetch: jest.fn(),
    });

    renderWithProviders(<AdminDashboard />);
    
    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('Total Markets')).toBeInTheDocument();
    expect(screen.getByText('Active Markets')).toBeInTheDocument();
    expect(screen.getByText('Total Volume')).toBeInTheDocument();
    expect(screen.getByText('Total Trades')).toBeInTheDocument();
    expect(screen.getByText('Avg Trade Size')).toBeInTheDocument();
    expect(screen.getByText('Platform Fees')).toBeInTheDocument();
  });
});
