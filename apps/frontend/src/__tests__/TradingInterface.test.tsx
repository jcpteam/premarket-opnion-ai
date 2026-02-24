/**
 * Trading Interface Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TradingInterface } from '@/components/TradingInterface';
import { useAuth } from '@/hooks/useAuth';
import axios from 'axios';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('@/hooks/useAuth');
jest.mock('axios');
jest.mock('react-hot-toast');

describe('TradingInterface', () => {
  const mockProps = {
    marketId: 'market-1',
    outcomeId: 'outcome-1',
    outcomeName: 'Yes',
    currentPrice: 0.65,
    bestBid: 0.64,
    bestAsk: 0.66,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: true,
      token: 'test-token',
    });
  });

  it('should render trading interface', () => {
    render(<TradingInterface {...mockProps} />);

    expect(screen.getByText('Trade: Yes')).toBeInTheDocument();
    expect(screen.getByText('Buy')).toBeInTheDocument();
    expect(screen.getByText('Sell')).toBeInTheDocument();
  });

  it('should toggle between buy and sell', () => {
    render(<TradingInterface {...mockProps} />);

    const buyButton = screen.getByText('Buy');
    const sellButton = screen.getByText('Sell');

    expect(buyButton.className).toContain('bg-green-600');
    expect(sellButton.className).toContain('bg-gray-100');

    fireEvent.click(sellButton);

    expect(sellButton.className).toContain('bg-red-600');
    expect(buyButton.className).toContain('bg-gray-100');
  });

  it('should toggle between market and limit orders', () => {
    render(<TradingInterface {...mockProps} />);

    const marketButton = screen.getByRole('button', { name: /Market/i });
    const limitButton = screen.getByRole('button', { name: /Limit/i });

    expect(marketButton.className).toContain('bg-blue-600');

    fireEvent.click(limitButton);

    expect(limitButton.className).toContain('bg-blue-600');
    expect(screen.getByPlaceholderText(/Suggested:/)).toBeInTheDocument();
  });

  it('should calculate total correctly', () => {
    render(<TradingInterface {...mockProps} />);

    const quantityInput = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(quantityInput, { target: { value: '100' } });

    expect(screen.getByText('$66.00')).toBeInTheDocument(); // 100 * 0.66 (bestAsk)
  });

  it('should submit buy order successfully', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { id: 'order-1' } });

    render(<TradingInterface {...mockProps} />);

    const quantityInput = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(quantityInput, { target: { value: '100' } });

    const submitButton = screen.getByText('BUY Yes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/orders'),
        expect.objectContaining({
          marketId: 'market-1',
          outcomeId: 'outcome-1',
          type: 'BUY',
          orderType: 'MARKET',
          quantity: 100,
        }),
        expect.any(Object)
      );
    });

    expect(toast.success).toHaveBeenCalledWith('BUY order placed successfully!');
  });

  it('should show error when not authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      isAuthenticated: false,
      token: null,
    });

    render(<TradingInterface {...mockProps} />);

    const quantityInput = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(quantityInput, { target: { value: '100' } });

    const submitButton = screen.getByText('BUY Yes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please connect and authenticate your wallet');
    });
  });

  it('should validate quantity input', async () => {
    render(<TradingInterface {...mockProps} />);

    const submitButton = screen.getByText('BUY Yes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid quantity');
    });
  });

  it('should validate limit order price', async () => {
    render(<TradingInterface {...mockProps} />);

    // Switch to limit order
    const limitButton = screen.getByRole('button', { name: /Limit/i });
    fireEvent.click(limitButton);

    const quantityInput = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(quantityInput, { target: { value: '100' } });

    const submitButton = screen.getByText('BUY Yes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please enter a valid price between 0 and 1');
    });
  });

  it('should handle order submission error', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      response: { data: { message: 'Insufficient balance' } },
    });

    render(<TradingInterface {...mockProps} />);

    const quantityInput = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(quantityInput, { target: { value: '100' } });

    const submitButton = screen.getByText('BUY Yes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Insufficient balance');
    });
  });

  it('should show current price and best bid/ask', () => {
    render(<TradingInterface {...mockProps} />);

    expect(screen.getByText('$0.650')).toBeInTheDocument(); // Current price
    expect(screen.getByText('$0.660')).toBeInTheDocument(); // Best ask
  });

  it('should disable submit button when submitting', async () => {
    (axios.post as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<TradingInterface {...mockProps} />);

    const quantityInput = screen.getByPlaceholderText('Enter quantity');
    fireEvent.change(quantityInput, { target: { value: '100' } });

    const submitButton = screen.getByText('BUY Yes');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Placing Order...')).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });
});
