// Trading constants
export const DEFAULT_FEE_RATE = 0.01; // 1%
export const MIN_ORDER_SIZE = 0.01;
export const MAX_ORDER_SIZE = 1000000;
export const MIN_PRICE = 0.01;
export const MAX_PRICE = 0.99;

// Market constants
export const MIN_MARKET_OUTCOMES = 2;
export const MAX_MARKET_OUTCOMES = 10;
export const MIN_MARKET_DURATION_HOURS = 1;
export const MAX_MARKET_DURATION_DAYS = 365;

// API constants
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// WebSocket events
export const WS_EVENTS = {
  MARKET_UPDATE: 'market_update',
  ORDERBOOK_UPDATE: 'orderbook_update',
  TRADE_EXECUTED: 'trade_executed',
  USER_ORDER_UPDATE: 'user_order_update',
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  JOIN_MARKET: 'join_market',
  LEAVE_MARKET: 'leave_market',
} as const;

// Error codes
export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  MARKET_CLOSED: 'MARKET_CLOSED',
  INVALID_ORDER: 'INVALID_ORDER',
} as const;