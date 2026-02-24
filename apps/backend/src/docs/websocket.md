# WebSocket API Documentation

## Connection

Connect to: `ws://localhost:3001` or `wss://api.predictionmarket.com`

## Authentication

Send authentication token after connection:
```json
{
  "type": "auth",
  "token": "your-jwt-token"
}
```

## Events

### Subscribe to Market Updates
```json
{
  "type": "subscribe",
  "channel": "market:${marketId}"
}
```

### Market Price Update
```json
{
  "type": "market:priceUpdate",
  "marketId": "market-123",
  "outcomeId": "outcome-456",
  "price": 0.65
}
```

### Order Book Update
```json
{
  "type": "orderbook:update",
  "marketId": "market-123",
  "bids": [...],
  "asks": [...]
}
```

### Trade Executed
```json
{
  "type": "trade:executed",
  "tradeId": "trade-789",
  "marketId": "market-123",
  "price": 0.65,
  "quantity": 100
}
```
