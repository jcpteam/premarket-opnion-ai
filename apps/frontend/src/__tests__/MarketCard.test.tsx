/**
 * Market Card Component Tests
 */

import { render, screen } from '@testing-library/react';
import { MarketCard } from '@/components/MarketCard';
import { Market } from '@/hooks/useMarkets';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: any) => {
    return <a href={href}>{children}</a>;
  };
});

describe('MarketCard', () => {
  const mockMarket: Market = {
    id: 'market-1',
    title: 'Will Bitcoin reach $100k by end of 2024?',
    description: 'This market resolves to YES if Bitcoin reaches $100,000 by December 31, 2024.',
    category: 'Crypto',
    tags: ['bitcoin', 'crypto', 'price'],
    type: 'BINARY',
    status: 'ACTIVE',
    endDate: '2024-12-31T23:59:59Z',
    totalVolume: 50000,
    totalShares: 100000,
    outcomes: [
      {
        id: 'outcome-1',
        name: 'Yes',
        currentPrice: 0.65,
        totalShares: 60000,
        bestBid: 0.64,
        bestAsk: 0.66,
        spread: 0.02,
      },
      {
        id: 'outcome-2',
        name: 'No',
        currentPrice: 0.35,
        totalShares: 40000,
        bestBid: 0.34,
        bestAsk: 0.36,
        spread: 0.02,
      },
    ],
    creator: {
      id: 'user-1',
      username: 'cryptotrader',
      walletAddress: '0x1234567890123456789012345678901234567890',
    },
    createdAt: '2024-01-01T00:00:00Z',
  };

  it('should render market title and description', () => {
    render(<MarketCard market={mockMarket} />);

    expect(screen.getByText('Will Bitcoin reach $100k by end of 2024?')).toBeInTheDocument();
    expect(screen.getByText(/This market resolves to YES/)).toBeInTheDocument();
  });

  it('should display market status', () => {
    render(<MarketCard market={mockMarket} />);

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
  });

  it('should show outcome prices', () => {
    render(<MarketCard market={mockMarket} />);

    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('65.0¢')).toBeInTheDocument();
    expect(screen.getByText('35.0¢')).toBeInTheDocument();
  });

  it('should display bid and ask prices', () => {
    render(<MarketCard market={mockMarket} />);

    expect(screen.getAllByText(/Bid:/)).toHaveLength(2);
    expect(screen.getAllByText(/Ask:/)).toHaveLength(2);
  });

  it('should show volume and category', () => {
    render(<MarketCard market={mockMarket} />);

    expect(screen.getByText('$50.00K')).toBeInTheDocument();
    expect(screen.getByText('Crypto')).toBeInTheDocument();
  });

  it('should display tags', () => {
    render(<MarketCard market={mockMarket} />);

    expect(screen.getByText('#bitcoin')).toBeInTheDocument();
    expect(screen.getByText('#crypto')).toBeInTheDocument();
    expect(screen.getByText('#price')).toBeInTheDocument();
  });

  it('should link to market detail page', () => {
    render(<MarketCard market={mockMarket} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/markets/market-1');
  });

  it('should show correct status color for ACTIVE markets', () => {
    render(<MarketCard market={mockMarket} />);

    const statusBadge = screen.getByText('ACTIVE');
    expect(statusBadge.className).toContain('bg-green-100');
  });

  it('should show correct status color for RESOLVED markets', () => {
    const resolvedMarket = { ...mockMarket, status: 'RESOLVED' as const };
    render(<MarketCard market={resolvedMarket} />);

    const statusBadge = screen.getByText('RESOLVED');
    expect(statusBadge.className).toContain('bg-blue-100');
  });

  it('should format large volumes correctly', () => {
    const highVolumeMarket = { ...mockMarket, totalVolume: 1500000 };
    render(<MarketCard market={highVolumeMarket} />);

    expect(screen.getByText('$1.50M')).toBeInTheDocument();
  });

  it('should show message when more than 2 outcomes', () => {
    const multiOutcomeMarket = {
      ...mockMarket,
      outcomes: [
        ...mockMarket.outcomes,
        {
          id: 'outcome-3',
          name: 'Maybe',
          currentPrice: 0.1,
          totalShares: 10000,
          bestBid: 0.09,
          bestAsk: 0.11,
          spread: 0.02,
        },
      ],
    };
    render(<MarketCard market={multiOutcomeMarket} />);

    expect(screen.getByText('+1 more outcomes')).toBeInTheDocument();
  });
});
