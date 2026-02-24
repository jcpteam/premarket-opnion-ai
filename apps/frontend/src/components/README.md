# Frontend Components Documentation

## Authentication and Wallet Connection Components

This directory contains the core authentication and wallet connection components for the Prediction Market Platform.

### Components

#### WalletConnector
Multi-wallet connection interface supporting MetaMask, WalletConnect, and Coinbase Wallet.

**Features:**
- Modal-based wallet selection
- Connection status indicators
- Auto-authentication after wallet connection
- Disconnect functionality
- Loading states and error handling

**Requirements:** 3.1, 3.4, 3.5

**Usage:**
```tsx
import { WalletConnector } from '@/components/WalletConnector';

<WalletConnector 
  onConnect={() => console.log('Connected')}
  onDisconnect={() => console.log('Disconnected')}
/>
```

#### AuthGuard
Route protection component that requires wallet authentication.

**Features:**
- Redirects unauthenticated users
- Loading states during authentication check
- Customizable redirect paths
- User-friendly prompts for connection/authentication

**Requirements:** 3.1, 3.5

**Usage:**
```tsx
import { AuthGuard } from '@/components/AuthGuard';

<AuthGuard requireAuth={true} redirectTo="/">
  <ProtectedContent />
</AuthGuard>
```

#### WalletStatus
Displays current wallet connection and authentication status.

**Features:**
- Authentication status indicator
- Network information display
- Wallet balance display
- Color-coded status badges

**Requirements:** 3.1, 3.4, 3.5

**Usage:**
```tsx
import { WalletStatus } from '@/components/WalletStatus';

<WalletStatus />
```

#### Providers
Root-level provider wrapper for Wagmi, React Query, and Toast notifications.

**Features:**
- Wagmi configuration for Web3 wallets
- React Query setup for data fetching
- Toast notifications for user feedback

**Requirements:** 3.1, 3.4

**Usage:**
```tsx
import { Providers } from '@/components/Providers';

<Providers>
  <App />
</Providers>
```

### Hooks

#### useAuth
Custom hook for authentication state management.

**Features:**
- Wallet signature-based authentication
- JWT token management
- Session persistence with localStorage
- Auto-logout on wallet disconnect
- Error handling

**Requirements:** 3.1, 3.4, 3.5

**Usage:**
```tsx
import { useAuth } from '@/hooks/useAuth';

const { 
  isAuthenticated, 
  token, 
  user, 
  authenticate, 
  logout,
  isLoading,
  error 
} = useAuth();
```

### Configuration

#### Wagmi Setup
Located in `src/lib/wagmi.ts`, configures Web3 wallet connections.

**Supported Wallets:**
- MetaMask
- WalletConnect
- Coinbase Wallet

**Supported Networks:**
- Polygon Mainnet (137)
- Polygon Mumbai Testnet (80001)

**Requirements:** 3.1, 3.4, 3.5

### Environment Variables

Required environment variables in `.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
```

### Authentication Flow

1. **Wallet Connection**
   - User clicks "Connect Wallet"
   - Selects preferred wallet (MetaMask, WalletConnect, or Coinbase)
   - Wallet connection established

2. **Authentication**
   - Backend generates a nonce
   - User signs message with wallet
   - Backend verifies signature
   - JWT token issued and stored

3. **Session Management**
   - Token stored in localStorage
   - Auto-reconnect on page refresh
   - Auto-logout on wallet disconnect

4. **Protected Routes**
   - AuthGuard checks authentication status
   - Redirects if not authenticated
   - Shows loading state during check

### Testing

Tests are located in `src/__tests__/`:
- `WalletConnector.test.tsx` - Component tests
- `useAuth.test.ts` - Hook tests

Run tests with:
```bash
npm test
```

### Styling

Components use Tailwind CSS for styling with:
- Responsive design
- Color-coded status indicators
- Smooth transitions and animations
- Accessible UI elements

### Error Handling

All components include comprehensive error handling:
- Network errors
- Wallet connection failures
- Authentication failures
- Session expiration

Errors are displayed via toast notifications for user feedback.


## Market Display and Navigation Components

### Components

#### MarketCard
Displays individual market information with real-time price updates.

**Features:**
- Market title, description, and status
- Real-time outcome prices with bid/ask spreads
- Volume and category display
- Tags and metadata
- Responsive card layout
- Status-based color coding
- Links to market detail pages

**Requirements:** 6.2, 6.3, 10.1

**Usage:**
```tsx
import { MarketCard } from '@/components/MarketCard';

<MarketCard market={marketData} />
```

#### MarketSearch
Search interface with debounced input for finding markets.

**Features:**
- Debounced search (300ms delay)
- Clear button when input has value
- Customizable placeholder
- Initial value support
- Search icon indicator

**Requirements:** 6.2

**Usage:**
```tsx
import { MarketSearch } from '@/components/MarketSearch';

<MarketSearch 
  onSearch={(query) => console.log(query)}
  placeholder="Search markets..."
/>
```

#### MarketFilters
Category, status, and sort filtering interface.

**Features:**
- Category filtering (Politics, Sports, Crypto, etc.)
- Status filtering (Active, Closed, Resolved, Disputed)
- Sort options (Newest, Volume, Ending Soon, Alphabetical)
- Responsive grid layout
- Dropdown selects

**Requirements:** 6.3

**Usage:**
```tsx
import { MarketFilters } from '@/components/MarketFilters';

<MarketFilters
  selectedCategory={category}
  selectedStatus={status}
  selectedSort={sortBy}
  onCategoryChange={setCategory}
  onStatusChange={setStatus}
  onSortChange={setSortBy}
/>
```

#### CategoryNav
Quick navigation between market categories with icons.

**Features:**
- Icon-based category buttons
- Horizontal scrollable layout
- Active category highlighting
- 8 predefined categories
- Mobile-friendly

**Requirements:** 6.3

**Usage:**
```tsx
import { CategoryNav } from '@/components/CategoryNav';

<CategoryNav
  selectedCategory={category}
  onCategorySelect={setCategory}
/>
```

#### MarketList
Grid display of market cards with pagination.

**Features:**
- Responsive grid layout (1-3 columns)
- Loading skeleton states
- Error handling with user-friendly messages
- Empty state display
- Pagination controls
- Smart page number display

**Requirements:** 6.2, 6.3, 10.1

**Usage:**
```tsx
import { MarketList } from '@/components/MarketList';

<MarketList
  markets={markets}
  isLoading={isLoading}
  error={error}
  currentPage={page}
  totalPages={totalPages}
  onPageChange={setPage}
/>
```

### Hooks

#### useMarkets
Custom hook for fetching and managing market data with real-time updates.

**Features:**
- React Query integration for data fetching
- WebSocket connection for real-time price updates
- Search, filter, and sort support
- Pagination support
- Automatic refetching
- Real-time price and volume updates
- Stale-time caching (30 seconds)

**Requirements:** 6.2, 6.3, 10.1

**Usage:**
```tsx
import { useMarkets } from '@/hooks/useMarkets';

const { 
  markets, 
  totalCount, 
  totalPages, 
  currentPage, 
  isLoading, 
  error, 
  refetch 
} = useMarkets({
  search: 'bitcoin',
  category: 'Crypto',
  status: 'ACTIVE',
  sortBy: 'totalVolume',
  page: 1,
  limit: 12,
});
```

### Pages

#### Markets Page
Main market discovery and browsing interface at `/markets`.

**Features:**
- Full-page market browsing experience
- Integrated search, filters, and category navigation
- Real-time market updates
- Pagination
- Wallet connection in header
- Responsive layout

**Requirements:** 6.2, 6.3, 10.1

### Real-Time Updates

The market components integrate with WebSocket for live updates:

**Events:**
- `market:priceUpdate` - Outcome price changes
- `market:volumeUpdate` - Market volume changes

Updates are automatically merged with fetched data for seamless real-time experience.

### Performance

**Search Optimization:**
- 300ms debounce on search input
- Prevents excessive API calls
- Smooth user experience

**Data Caching:**
- 30-second stale time for market data
- Reduces unnecessary API requests
- Background refetching for fresh data

**Pagination:**
- Configurable page size (default 12)
- Smart page number display
- Efficient data loading

### Testing

Tests are located in `src/__tests__/`:
- `MarketCard.test.tsx` - Market card component tests
- `MarketSearch.test.tsx` - Search component tests

Run tests with:
```bash
npm test
```

### Styling

All components use Tailwind CSS with:
- Responsive breakpoints (mobile, tablet, desktop)
- Consistent color scheme
- Hover and focus states
- Loading animations
- Status-based color coding


## Administrative Dashboard Components

### Components

#### AdminDashboard
Main dashboard displaying platform metrics and system health monitoring.

**Features:**
- Real-time platform metrics (users, markets, volume, trades)
- System health status indicators
- Time range selector (24h, 7d, 30d, all time)
- Quick action buttons
- Metric cards with formatted numbers
- WebSocket integration for live updates

**Requirements:** 7.1

**Usage:**
```tsx
import { AdminDashboard } from '@/components/AdminDashboard';

<AdminDashboard />
```

#### MarketManager
Tools for market creation, modification, and resolution.

**Features:**
- Market search and filtering
- Status-based filtering (active, closed, resolved, disputed)
- Pause/resume market trading
- Resolve markets with outcome selection
- Delete markets with confirmation
- Pagination for large datasets
- Real-time action feedback

**Requirements:** 7.2

**Usage:**
```tsx
import { MarketManager } from '@/components/MarketManager';

<MarketManager />
```

#### UserManager
User account management and moderation tools.

**Features:**
- User search by wallet address or username
- Flag/unflag users with reason tracking
- Verify user accounts
- Grant admin privileges
- Suspend user accounts
- Filter by flagged status
- Display user statistics and activity
- Pagination support

**Requirements:** 7.3

**Usage:**
```tsx
import { UserManager } from '@/components/UserManager';

<UserManager />
```

#### AuditTrail
Complete audit trail of administrative actions with timestamps.

**Features:**
- Chronological log of all admin actions
- Filter by action type (market, user, system)
- Display admin username and action details
- Timestamp for each action
- Target ID tracking
- Color-coded action types
- Pagination for historical data

**Requirements:** 7.5

**Usage:**
```tsx
import { AuditTrail } from '@/components/AuditTrail';

<AuditTrail />
```

### Hooks

#### useAdminData
Collection of hooks for fetching administrative data.

**Sub-hooks:**
- `usePlatformMetrics()` - Platform-wide metrics with real-time updates
- `useMarketManagement()` - Market data for admin management
- `useUserManagement()` - User account data for moderation
- `useAdminAuditTrail()` - Audit trail of admin actions

**Requirements:** 7.1, 7.2, 7.3, 7.5

**Usage:**
```tsx
import { 
  usePlatformMetrics, 
  useMarketManagement, 
  useUserManagement,
  useAdminAuditTrail 
} from '@/hooks/useAdminData';

const { metrics, isLoading, error } = usePlatformMetrics();
const { markets, refetch } = useMarketManagement({ status: 'active' });
const { users } = useUserManagement({ flagged: true });
const { actions } = useAdminAuditTrail({ targetType: 'market' });
```

### Pages

#### Admin Page
Complete administrative interface at `/admin`.

**Features:**
- Tab-based navigation (Dashboard, Markets, Users, Audit Trail)
- Authentication guard (admin only)
- Responsive layout
- Integrated components
- Admin badge indicator

**Requirements:** 7.1, 7.2, 7.3, 7.5

### Admin Actions

**Market Actions:**
- Pause market - Stop trading while preserving positions
- Resume market - Restart trading on paused market
- Resolve market - Set winning outcome and distribute payouts
- Delete market - Remove market (with confirmation)

**User Actions:**
- Flag user - Mark user for review with reason
- Unflag user - Remove flag from user account
- Verify user - Grant verified status
- Make admin - Grant administrative privileges
- Suspend user - Prevent user from trading

**Audit Trail:**
- All actions logged with timestamp
- Administrator identification
- Action details and target information
- Immutable audit log

### Real-Time Updates

Admin components integrate with WebSocket for live updates:

**Events:**
- `admin:metricsUpdate` - Platform metrics changes
- Real-time metric updates without page refresh
- Automatic data merging with fetched data

### Security

**Authentication:**
- JWT token required for all admin endpoints
- Admin role verification on backend
- AuthGuard protection on admin routes
- Token stored in localStorage

**Authorization:**
- RBAC checks for admin-only features
- Action confirmation for destructive operations
- Reason tracking for moderation actions
- Complete audit trail of all actions

### Testing

Tests are located in `src/__tests__/`:
- `AdminDashboard.test.tsx` - Dashboard component tests
- `MarketManager.test.tsx` - Market management tests
- `UserManager.test.tsx` - User management tests

Run tests with:
```bash
npm test
```

### Styling

All admin components use Tailwind CSS with:
- Consistent admin theme
- Status-based color coding
- Icon integration (Heroicons)
- Responsive tables
- Loading states
- Error handling displays
- Action button states
