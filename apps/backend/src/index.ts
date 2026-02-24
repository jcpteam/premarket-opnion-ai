import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

import { logger } from './config/logger';
import { rateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { WebSocketService } from './services/websocket.service';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
});

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// Initialize WebSocket service
const webSocketService = new WebSocketService(io);

// Health check endpoint
app.get('/health', (req, res) => {
  const connectionStats = webSocketService.getConnectionStats();
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    websocket: {
      connected: connectionStats.totalConnections,
      authenticated: connectionStats.authenticatedConnections,
      marketSubscriptions: connectionStats.totalMarketSubscriptions,
      outcomeSubscriptions: connectionStats.totalOutcomeSubscriptions,
    },
  });
});

// WebSocket stats endpoint
app.get('/api/websocket/stats', (req, res) => {
  const stats = webSocketService.getConnectionStats();
  res.json({
    ...stats,
    timestamp: new Date().toISOString(),
  });
});

// API routes will be added here
app.get('/api', (req, res) => {
  res.json({
    message: 'Prediction Market Platform API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// WebSocket connection handling is now managed by WebSocketService

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('WebSocket service initialized');
});

export { app, io, webSocketService };