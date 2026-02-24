// Validation utilities
export const isValidWalletAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const isValidPrice = (price: number): boolean => {
  return price >= 0 && price <= 1;
};

export const isValidQuantity = (quantity: number): boolean => {
  return quantity > 0;
};

// Date utilities
export const isValidFutureDate = (date: string | Date): boolean => {
  const targetDate = new Date(date);
  const now = new Date();
  return targetDate > now;
};

// Market utilities
export const calculateSpread = (bestBid: number, bestAsk: number): number => {
  return bestAsk - bestBid;
};

export const calculateMidPrice = (bestBid: number, bestAsk: number): number => {
  return (bestBid + bestAsk) / 2;
};

// Trading utilities
export const calculateTradeFee = (tradeValue: number, feeRate: number = 0.01): number => {
  return tradeValue * feeRate;
};

export const calculatePnL = (
  quantity: number,
  entryPrice: number,
  currentPrice: number,
  isLong: boolean = true
): number => {
  const priceDiff = currentPrice - entryPrice;
  return quantity * (isLong ? priceDiff : -priceDiff);
};

// Format utilities
export const formatPrice = (price: number, decimals: number = 4): string => {
  return price.toFixed(decimals);
};

export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};