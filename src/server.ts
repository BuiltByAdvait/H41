import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './utils/response';
import apiRouter from './routes/api';
import { env } from './config';
import { prisma } from './config/prisma';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.app.frontendUrl,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  maxAge: 86400,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Routes
app.use('/api/v1', apiRouter);

// Health check at root
app.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'CEMS API is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.app.env,
  });
});

// Error handlers
app.use(errorHandler);
app.use(notFoundHandler);

// Start server
async function startServer() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    app.listen(env.app.port, () => {
      console.log(`🚀 CEMS API server running on port ${env.app.port}`);
      console.log(`📖 API docs available at http://localhost:${env.app.port}/api/v1/health`);
      console.log(`🌐 Environment: ${env.app.env}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:');
    console.error(error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();