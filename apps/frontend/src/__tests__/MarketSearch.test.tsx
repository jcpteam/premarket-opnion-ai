/**
 * Market Search Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarketSearch } from '@/components/MarketSearch';

// Mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  MagnifyingGlassIcon: () => <div>SearchIcon</div>,
}));

describe('MarketSearch', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render search input', () => {
    render(<MarketSearch onSearch={mockOnSearch} />);

    expect(screen.getByPlaceholderText('Search markets...')).toBeInTheDocument();
  });

  it('should use custom placeholder', () => {
    render(<MarketSearch onSearch={mockOnSearch} placeholder="Find markets..." />);

    expect(screen.getByPlaceholderText('Find markets...')).toBeInTheDocument();
  });

  it('should debounce search input', async () => {
    render(<MarketSearch onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search markets...');

    fireEvent.change(input, { target: { value: 'bitcoin' } });

    // Should not call immediately
    expect(mockOnSearch).not.toHaveBeenCalled();

    // Fast-forward time
    jest.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith('bitcoin');
    });
  });

  it('should show clear button when input has value', () => {
    render(<MarketSearch onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search markets...');

    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should clear input when clear button clicked', () => {
    render(<MarketSearch onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search markets...') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'test' } });
    expect(input.value).toBe('test');

    const clearButton = screen.getByRole('button');
    fireEvent.click(clearButton);

    expect(input.value).toBe('');
  });

  it('should use initial value', () => {
    render(<MarketSearch onSearch={mockOnSearch} initialValue="crypto" />);

    const input = screen.getByPlaceholderText('Search markets...') as HTMLInputElement;
    expect(input.value).toBe('crypto');
  });

  it('should handle multiple rapid changes', async () => {
    render(<MarketSearch onSearch={mockOnSearch} />);

    const input = screen.getByPlaceholderText('Search markets...');

    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.change(input, { target: { value: 'bi' } });
    fireEvent.change(input, { target: { value: 'bit' } });
    fireEvent.change(input, { target: { value: 'bitcoin' } });

    jest.advanceTimersByTime(300);

    await waitFor(() => {
      // Should only call once with final value
      expect(mockOnSearch).toHaveBeenCalledTimes(1);
      expect(mockOnSearch).toHaveBeenCalledWith('bitcoin');
    });
  });
});
