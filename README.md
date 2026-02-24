# Prediction Market Platform

A comprehensive prediction market platform that enables users to create, trade, and resolve binary and multi-outcome prediction markets with Web3 wallet integration.

## Architecture

This is a monorepo containing:

- **Frontend** (`apps/frontend`): Next.js 14 application with React 18 and TypeScript
- **Backend** (`apps/backend`): Node.js API server with Express.js and TypeScript
- **Shared** (`packages/shared`): Shared types, utilities, and constants

## Tech Stack

### Frontend
- Next.js 14 with App Router
- React 18 with TypeScript
- Tailwind CSS for styling
- Web3.js/Ethers.js for blockchain integration
- Socket.io-client for real-time updates
- React Query for data fetching

### Backend
- Node.js with Express.js
- TypeScript for type safety
- Prisma ORM with PostgreSQL
- Redis for caching and sessions
- Socket.io for WebSocket connections
- JWT for authentication

### Infrastructure
- Docker & Docker Compose for development
- PostgreSQL database
- Redis cache
- Turbo for monorepo management

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd prediction-market-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Backend
cp apps/backend/.env.example apps/backend/.env

# Frontend
cp apps/frontend/.env.example apps/frontend/.env
```

4. Start the development environment with Docker:
```bash
npm run docker:up
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379
- Backend API on port 3001
- Frontend web app on port 3000

5. Set up the database:
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### Development

Start all services in development mode:
```bash
npm run dev
```

Or start individual services:
```bash
# Frontend only
cd apps/frontend && npm run dev

# Backend only
cd apps/backend && npm run dev
```

### Testing

Run all tests:
```bash
npm run test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Code Quality

Format code:
```bash
npm run format
```

Lint code:
```bash
npm run lint
npm run lint:fix
```

## Project Structure

```
prediction-market-platform/
├── apps/
│   ├── frontend/          # Next.js frontend application
│   │   ├── src/
│   │   │   ├── app/       # Next.js app router pages
│   │   │   ├── components/ # React components
│   │   │   ├── lib/       # Utility libraries
│   │   │   ├── hooks/     # Custom React hooks
│   │   │   └── types/     # TypeScript type definitions
│   │   └── package.json
│   └── backend/           # Node.js backend API
│       ├── src/
│       │   ├── controllers/ # Route controllers
│       │   ├── services/   # Business logic services
│       │   ├── middleware/ # Express middleware
│       │   ├── config/     # Configuration files
│       │   └── types/      # TypeScript type definitions
│       ├── prisma/         # Database schema and migrations
│       └── package.json
├── packages/
│   └── shared/            # Shared types and utilities
│       ├── src/
│       │   ├── types/     # Shared TypeScript types
│       │   ├── utils/     # Shared utility functions
│       │   └── constants/ # Shared constants
│       └── package.json
├── docker-compose.yml     # Docker services configuration
├── turbo.json            # Turbo monorepo configuration
└── package.json          # Root package.json
```

## Available Scripts

### Root Level
- `npm run dev` - Start all services in development mode
- `npm run build` - Build all applications
- `npm run test` - Run all tests
- `npm run lint` - Lint all code
- `npm run format` - Format all code
- `npm run docker:up` - Start Docker services
- `npm run docker:down` - Stop Docker services

### Database
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with test data

## Environment Variables

### Backend (.env)
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/prediction_market"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:3000"
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

## Features

- **Market Creation**: Create binary and multi-outcome prediction markets
- **Trading System**: Order book-based trading with real-time price updates
- **Web3 Integration**: MetaMask, WalletConnect, and Coinbase Wallet support
- **Real-time Updates**: WebSocket connections for live market data
- **Admin Dashboard**: Comprehensive market and user management
- **Mobile Responsive**: Optimized for all device sizes
- **Type Safety**: Full TypeScript coverage across the stack

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/new-feature`
3. Make your changes and add tests
4. Run tests and linting: `npm run test && npm run lint`
5. Commit your changes: `git commit -am 'Add new feature'`
6. Push to the branch: `git push origin feature/new-feature`
7. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.