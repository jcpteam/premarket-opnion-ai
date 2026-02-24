# Prediction Market Platform - Database Schema

This directory contains the Prisma schema and database configuration for the prediction market platform.

## Overview

The database schema supports a comprehensive prediction market platform with the following core entities:

- **Users**: Platform users with wallet integration and trading statistics
- **Markets**: Binary and multi-outcome prediction markets
- **Outcomes**: Individual outcomes within markets (Yes/No for binary, multiple options for multi-outcome)
- **Orders**: Buy and sell orders in the order book system
- **Trades**: Executed trades between users
- **Positions**: User positions in market outcomes
- **Resolutions**: Market resolution data and dispute handling

## Schema Features

### Data Integrity
- **Check Constraints**: Ensures prices are between 0-1, quantities are positive, etc.
- **Foreign Key Constraints**: Maintains referential integrity between related entities
- **Unique Constraints**: Prevents duplicate wallet addresses, usernames, and positions
- **Cascading Deletes**: Properly handles related data when markets are deleted

### Performance Optimizations
- **Comprehensive Indexing**: Optimized for common query patterns
- **Composite Indexes**: Efficient filtering on multiple columns
- **Partial Indexes**: Optimized for active orders and positions
- **Connection Pooling**: Configured for high-concurrency scenarios

### Business Logic Constraints
- Market end dates must be in the future for active markets
- Order quantities and prices must be positive and within valid ranges
- Trade fees and values must be non-negative
- User statistics (win rate) must be between 0 and 1

## Database Setup

### Prerequisites
- PostgreSQL 12+ installed and running
- Node.js 18+ for running Prisma commands

### Environment Configuration
1. Copy `.env.example` to `.env`
2. Update `DATABASE_URL` with your PostgreSQL connection string:
   ```
   DATABASE_URL="postgresql://username:password@localhost:5432/prediction_market"
   ```

### Initial Setup
```bash
# Generate Prisma client
npm run db:generate

# Apply migrations (when database is available)
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### Development Commands
```bash
# Generate Prisma client after schema changes
npm run db:generate

# Push schema changes to database (development only)
npm run db:push

# Create and apply new migration
npm run db:migrate

# Seed database with sample data
npm run db:seed

# Open Prisma Studio for database browsing
npm run db:studio
```

## Schema Details

### Core Entities

#### User
- Stores wallet addresses, profile information, and trading statistics
- Tracks total volume, trades, win rate, and profit/loss
- Supports admin privileges and verification status

#### Market
- Supports both binary (Yes/No) and multi-outcome markets
- Includes metadata like title, description, category, and tags
- Tracks market state (active, closed, resolved, disputed)
- Links to creator and resolution information

#### Outcome
- Represents individual outcomes within markets
- Stores current price, total shares, and order book data
- Maintains best bid/ask prices and spread information

#### Order
- Supports both market and limit orders
- Tracks order state (pending, partial, filled, cancelled)
- Includes quantity, price, and fill information
- Links to user, market, and outcome

#### Trade
- Records executed trades between users
- Includes trade details, fees, and timestamps
- Links to both buy and sell orders
- Maintains audit trail for all transactions

#### Position
- Tracks user positions in market outcomes
- Calculates average price, total cost, and unrealized P&L
- Unique constraint prevents duplicate positions

#### Resolution
- Handles market resolution and dispute processes
- Stores evidence and resolution source
- Tracks resolution status and deadlines

### Relationships

```
User (1) -----> (N) Market [creator]
User (1) -----> (N) Order
User (1) -----> (N) Trade [buyer/seller]
User (1) -----> (N) Position
User (1) -----> (N) Resolution [resolver]

Market (1) ---> (N) Outcome
Market (1) ---> (N) Order
Market (1) ---> (N) Trade
Market (1) ---> (N) Position
Market (1) ---> (N) Resolution

Outcome (1) --> (N) Order
Outcome (1) --> (N) Trade
Outcome (1) --> (N) Position

Order (1) ----> (N) Trade [buy/sell orders]
```

### Indexes

The schema includes comprehensive indexing for optimal query performance:

- **Single Column Indexes**: On frequently queried fields like status, category, prices
- **Composite Indexes**: For complex filtering (market + status, user + market, etc.)
- **Unique Indexes**: For wallet addresses, usernames, and position uniqueness
- **Partial Indexes**: For active orders and open positions

### Data Validation

#### Price Constraints
- All prices must be between 0 and 1 (representing probabilities)
- Best ask must be >= best bid
- Spreads must be non-negative

#### Quantity Constraints
- Order quantities must be positive
- Filled quantity cannot exceed total quantity
- Remaining quantity must be consistent with filled quantity

#### Financial Constraints
- All monetary values (fees, costs, volumes) must be non-negative
- User win rates must be between 0 and 1
- Trade total values must be consistent with quantity × price

## Migration Strategy

### Development
- Use `db:push` for rapid schema iteration
- Create migrations for significant changes
- Reset database as needed with fresh seeds

### Production
- Always use migrations for schema changes
- Test migrations on staging environment first
- Backup database before applying migrations
- Monitor performance after schema changes

### Rollback Strategy
- Keep migration rollback scripts for critical changes
- Test rollback procedures in staging
- Have data recovery plan for failed migrations

## Performance Considerations

### Query Optimization
- Use appropriate indexes for query patterns
- Avoid N+1 queries with proper includes/selects
- Use pagination for large result sets
- Consider read replicas for analytics queries

### Connection Management
- Configure connection pooling based on load
- Monitor connection usage and adjust pool size
- Use connection timeouts to prevent leaks
- Consider connection multiplexing for high concurrency

### Data Growth
- Plan for table partitioning on large tables (trades, orders)
- Archive old resolved markets and trades
- Monitor database size and performance metrics
- Consider data retention policies

## Security

### Data Protection
- Sensitive data is encrypted at rest
- Connection strings use SSL/TLS
- Database access is restricted by IP/network
- Regular security updates and patches

### Access Control
- Database users have minimal required permissions
- Application uses dedicated database user
- Admin access is logged and monitored
- Regular access reviews and cleanup

### Audit Trail
- All trades and resolutions are immutable
- User actions are logged with timestamps
- Administrative actions include user identification
- Financial transactions maintain complete history

## Monitoring

### Key Metrics
- Query performance and slow query logs
- Connection pool utilization
- Database size and growth rate
- Index usage and effectiveness

### Alerts
- High connection usage
- Slow query performance
- Failed transactions
- Unusual data patterns

### Maintenance
- Regular VACUUM and ANALYZE operations
- Index maintenance and optimization
- Statistics updates for query planner
- Backup verification and testing