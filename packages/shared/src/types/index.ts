// Market Types
export enum MarketType {
  BINARY = 'BINARY',
  MULTI_OUTCOME = 'MULTI_OUTCOME',
}

export enum MarketStatus {
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  RESOLVED = 'RESOLVED',
  DISPUTED = 'DISPUTED',
}

// Order Types
export enum OrderType {
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderSubType {
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  FILLED = 'FILLED',
  CANCELLED = 'CANCELLED',
}

// Resolution Types
export enum ResolutionStatus {
  PENDING = 'PENDING',
  RESOLVED = 'RESOLVED',
  DISPUTED = 'DISPUTED',
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// User Types
export interface User {
  id: string;
  walletAddress: string;
  username?: string;
  email?: string;
  profileImage?: string;
  isVerified: boolean;
  isAdmin: boolean;
  totalVolume: number;
  totalTrades: number;
  winRate: number;
  profitLoss: number;
  createdAt: string;
  updatedAt: string;
}

// Market Types
export interface Market {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  type: MarketType;
  endDate: string;
  resolutionDate?: string;
  status: MarketStatus;
  totalVolume: number;
  totalShares: number;
  winningOutcome?: string;
  resolutionSource?: string;
  creatorId: string;
  createdAt: string;
  updatedAt: string;
  outcomes: Outcome[];
}

export interface Outcome {
  id: string;
  marketId: string;
  name: string;
  description?: string;
  currentPrice: number;
  totalShares: number;
  bestBid: number;
  bestAsk: number;
  spread: number;
  createdAt: string;
  updatedAt: string;
}

// Order Types
export interface Order {
  id: string;
  userId: string;
  marketId: string;
  outcomeId: string;
  type: OrderType;
  orderType: OrderSubType;
  quantity: number;
  price: number;
  status: OrderStatus;
  filledQuantity: number;
  remainingQuantity: number;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

// Trade Types
export interface Trade {
  id: string;
  marketId: string;
  outcomeId: string;
  buyerId: string;
  sellerId: string;
  buyOrderId: string;
  sellOrderId: string;
  quantity: number;
  price: number;
  totalValue: number;
  buyerFee: number;
  sellerFee: number;
  createdAt: string;
}

// Position Types
export interface Position {
  id: string;
  userId: string;
  marketId: string;
  outcomeId: string;
  quantity: number;
  averagePrice: number;
  totalCost: number;
  currentValue: number;
  unrealizedPnL: number;
  createdAt: string;
  updatedAt: string;
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: string;
  data: any;
  timestamp: string;
}

export interface MarketUpdateEvent extends WebSocketEvent {
  type: 'market_update';
  data: {
    marketId: string;
    outcomeId: string;
    price: number;
    volume: number;
  };
}

export interface OrderBookUpdateEvent extends WebSocketEvent {
  type: 'orderbook_update';
  data: {
    marketId: string;
    outcomeId: string;
    bids: Array<{ price: number; quantity: number }>;
    asks: Array<{ price: number; quantity: number }>;
  };
}

export interface TradeExecutedEvent extends WebSocketEvent {
  type: 'trade_executed';
  data: Trade;
}