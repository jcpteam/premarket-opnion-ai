"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Starting database seeding...');
    if (process.env.NODE_ENV !== 'production') {
        console.log('🧹 Cleaning existing data...');
        await prisma.trade.deleteMany();
        await prisma.order.deleteMany();
        await prisma.position.deleteMany();
        await prisma.resolution.deleteMany();
        await prisma.outcome.deleteMany();
        await prisma.market.deleteMany();
        await prisma.user.deleteMany();
    }
    console.log('👥 Creating test users...');
    const admin = await prisma.user.create({
        data: {
            walletAddress: '0x1234567890123456789012345678901234567890',
            username: 'admin',
            email: 'admin@example.com',
            isVerified: true,
            isAdmin: true,
            totalVolume: 0,
            totalTrades: 0,
            winRate: 0,
            profitLoss: 0,
        },
    });
    const trader1 = await prisma.user.create({
        data: {
            walletAddress: '0x2345678901234567890123456789012345678901',
            username: 'trader1',
            email: 'trader1@example.com',
            isVerified: true,
            isAdmin: false,
            totalVolume: 1500.50,
            totalTrades: 25,
            winRate: 0.68,
            profitLoss: 234.75,
        },
    });
    const trader2 = await prisma.user.create({
        data: {
            walletAddress: '0x3456789012345678901234567890123456789012',
            username: 'trader2',
            email: 'trader2@example.com',
            isVerified: true,
            isAdmin: false,
            totalVolume: 2300.25,
            totalTrades: 42,
            winRate: 0.52,
            profitLoss: -125.30,
        },
    });
    const marketCreator = await prisma.user.create({
        data: {
            walletAddress: '0x4567890123456789012345678901234567890123',
            username: 'marketcreator',
            email: 'creator@example.com',
            isVerified: true,
            isAdmin: false,
            totalVolume: 500.00,
            totalTrades: 8,
            winRate: 0.75,
            profitLoss: 89.50,
        },
    });
    console.log('📊 Creating test markets...');
    const binaryMarket = await prisma.market.create({
        data: {
            title: 'Will Bitcoin reach $100,000 by end of 2024?',
            description: 'This market resolves to "Yes" if Bitcoin (BTC) reaches or exceeds $100,000 USD on any major exchange (Coinbase, Binance, Kraken) by December 31, 2024, 11:59 PM UTC.',
            category: 'Cryptocurrency',
            tags: ['Bitcoin', 'Price Prediction', '2024'],
            type: client_1.MarketType.BINARY,
            endDate: new Date('2024-12-31T23:59:59Z'),
            status: client_1.MarketStatus.ACTIVE,
            totalVolume: 15420.75,
            totalShares: 30841.50,
            creatorId: marketCreator.id,
        },
    });
    const yesOutcome = await prisma.outcome.create({
        data: {
            marketId: binaryMarket.id,
            name: 'Yes',
            description: 'Bitcoin will reach $100,000 by end of 2024',
            currentPrice: 0.35,
            totalShares: 15420.75,
            bestBid: 0.34,
            bestAsk: 0.36,
            spread: 0.02,
        },
    });
    const noOutcome = await prisma.outcome.create({
        data: {
            marketId: binaryMarket.id,
            name: 'No',
            description: 'Bitcoin will not reach $100,000 by end of 2024',
            currentPrice: 0.65,
            totalShares: 15420.75,
            bestBid: 0.64,
            bestAsk: 0.66,
            spread: 0.02,
        },
    });
    const multiMarket = await prisma.market.create({
        data: {
            title: 'Which team will win the 2024 World Cup?',
            description: 'This market will resolve to the team that wins the FIFA World Cup 2024. If the tournament is cancelled or postponed, all shares will be refunded.',
            category: 'Sports',
            tags: ['FIFA', 'World Cup', '2024', 'Soccer'],
            type: client_1.MarketType.MULTI_OUTCOME,
            endDate: new Date('2024-07-15T20:00:00Z'),
            status: client_1.MarketStatus.ACTIVE,
            totalVolume: 8750.25,
            totalShares: 17500.50,
            creatorId: admin.id,
        },
    });
    const teams = [
        { name: 'Brazil', price: 0.25 },
        { name: 'Argentina', price: 0.22 },
        { name: 'France', price: 0.18 },
        { name: 'England', price: 0.15 },
        { name: 'Other', price: 0.20 },
    ];
    const teamOutcomes = [];
    for (const team of teams) {
        const outcome = await prisma.outcome.create({
            data: {
                marketId: multiMarket.id,
                name: team.name,
                description: `${team.name} wins the 2024 World Cup`,
                currentPrice: team.price,
                totalShares: 3500.10,
                bestBid: team.price - 0.01,
                bestAsk: team.price + 0.01,
                spread: 0.02,
            },
        });
        teamOutcomes.push(outcome);
    }
    const resolvedMarket = await prisma.market.create({
        data: {
            title: 'Will Ethereum merge to Proof of Stake in 2022?',
            description: 'This market resolved to "Yes" when Ethereum successfully completed The Merge on September 15, 2022.',
            category: 'Cryptocurrency',
            tags: ['Ethereum', 'Proof of Stake', 'The Merge', '2022'],
            type: client_1.MarketType.BINARY,
            endDate: new Date('2022-12-31T23:59:59Z'),
            resolutionDate: new Date('2022-09-15T06:42:42Z'),
            status: client_1.MarketStatus.RESOLVED,
            totalVolume: 45230.80,
            totalShares: 90461.60,
            winningOutcome: 'Yes',
            resolutionSource: 'Ethereum Foundation official announcement',
            creatorId: marketCreator.id,
        },
    });
    const ethYesOutcome = await prisma.outcome.create({
        data: {
            marketId: resolvedMarket.id,
            name: 'Yes',
            description: 'Ethereum will merge to Proof of Stake in 2022',
            currentPrice: 1.0,
            totalShares: 45230.80,
            bestBid: 1.0,
            bestAsk: 1.0,
            spread: 0.0,
        },
    });
    const ethNoOutcome = await prisma.outcome.create({
        data: {
            marketId: resolvedMarket.id,
            name: 'No',
            description: 'Ethereum will not merge to Proof of Stake in 2022',
            currentPrice: 0.0,
            totalShares: 45230.80,
            bestBid: 0.0,
            bestAsk: 0.0,
            spread: 0.0,
        },
    });
    console.log('📋 Creating sample orders...');
    await prisma.order.create({
        data: {
            userId: trader1.id,
            marketId: binaryMarket.id,
            outcomeId: yesOutcome.id,
            type: client_1.OrderType.BUY,
            orderType: client_1.OrderSubType.LIMIT,
            quantity: 100,
            price: 0.34,
            status: client_1.OrderStatus.PENDING,
            filledQuantity: 0,
            remainingQuantity: 100,
        },
    });
    await prisma.order.create({
        data: {
            userId: trader2.id,
            marketId: binaryMarket.id,
            outcomeId: noOutcome.id,
            type: client_1.OrderType.SELL,
            orderType: client_1.OrderSubType.LIMIT,
            quantity: 150,
            price: 0.66,
            status: client_1.OrderStatus.PENDING,
            filledQuantity: 0,
            remainingQuantity: 150,
        },
    });
    await prisma.order.create({
        data: {
            userId: trader1.id,
            marketId: multiMarket.id,
            outcomeId: teamOutcomes[0].id,
            type: client_1.OrderType.BUY,
            orderType: client_1.OrderSubType.LIMIT,
            quantity: 200,
            price: 0.24,
            status: client_1.OrderStatus.PARTIAL,
            filledQuantity: 75,
            remainingQuantity: 125,
        },
    });
    console.log('💱 Creating sample trades...');
    const buyOrder = await prisma.order.create({
        data: {
            userId: trader1.id,
            marketId: binaryMarket.id,
            outcomeId: yesOutcome.id,
            type: client_1.OrderType.BUY,
            orderType: client_1.OrderSubType.LIMIT,
            quantity: 50,
            price: 0.35,
            status: client_1.OrderStatus.FILLED,
            filledQuantity: 50,
            remainingQuantity: 0,
        },
    });
    const sellOrder = await prisma.order.create({
        data: {
            userId: trader2.id,
            marketId: binaryMarket.id,
            outcomeId: yesOutcome.id,
            type: client_1.OrderType.SELL,
            orderType: client_1.OrderSubType.LIMIT,
            quantity: 50,
            price: 0.35,
            status: client_1.OrderStatus.FILLED,
            filledQuantity: 50,
            remainingQuantity: 0,
        },
    });
    await prisma.trade.create({
        data: {
            marketId: binaryMarket.id,
            outcomeId: yesOutcome.id,
            buyerId: trader1.id,
            sellerId: trader2.id,
            buyOrderId: buyOrder.id,
            sellOrderId: sellOrder.id,
            quantity: 50,
            price: 0.35,
            totalValue: 17.50,
            buyerFee: 0.18,
            sellerFee: 0.18,
        },
    });
    console.log('📈 Creating sample positions...');
    await prisma.position.create({
        data: {
            userId: trader1.id,
            marketId: binaryMarket.id,
            outcomeId: yesOutcome.id,
            quantity: 250,
            averagePrice: 0.33,
            totalCost: 82.50,
            currentValue: 87.50,
            unrealizedPnL: 5.00,
        },
    });
    await prisma.position.create({
        data: {
            userId: trader2.id,
            marketId: binaryMarket.id,
            outcomeId: noOutcome.id,
            quantity: 180,
            averagePrice: 0.67,
            totalCost: 120.60,
            currentValue: 117.00,
            unrealizedPnL: -3.60,
        },
    });
    await prisma.position.create({
        data: {
            userId: trader1.id,
            marketId: multiMarket.id,
            outcomeId: teamOutcomes[1].id,
            quantity: 100,
            averagePrice: 0.21,
            totalCost: 21.00,
            currentValue: 22.00,
            unrealizedPnL: 1.00,
        },
    });
    console.log('⚖️ Creating market resolution...');
    await prisma.resolution.create({
        data: {
            marketId: resolvedMarket.id,
            outcome: 'Yes',
            evidence: 'Ethereum successfully completed The Merge on September 15, 2022, transitioning from Proof of Work to Proof of Stake consensus mechanism.',
            status: 'RESOLVED',
            resolvedBy: admin.id,
        },
    });
    console.log('✅ Database seeding completed successfully!');
    console.log(`
📊 Created:
  - ${await prisma.user.count()} users
  - ${await prisma.market.count()} markets
  - ${await prisma.outcome.count()} outcomes
  - ${await prisma.order.count()} orders
  - ${await prisma.trade.count()} trades
  - ${await prisma.position.count()} positions
  - ${await prisma.resolution.count()} resolutions
  `);
}
main()
    .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map