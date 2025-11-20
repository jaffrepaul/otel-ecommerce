import express from 'express';
import dotenv from 'dotenv';
import { initializeRedis } from './services/cache.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import routes
import healthRouter from './routes/health.js';
import productsRouter from './routes/products.js';
import ordersRouter from './routes/orders.js';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (simple)
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
});

// Routes
app.get('/', (req, res) => {
  res.json({
    name: 'OpenTelemetry E-commerce API',
    version: '1.0.0',
    description: 'A demo API instrumented with OpenTelemetry for Sentry',
    endpoints: {
      health: 'GET /health',
      products: {
        list: 'GET /api/products',
        getById: 'GET /api/products/:id',
        search: 'GET /api/products/search?q=query',
      },
      orders: {
        create: 'POST /api/orders',
        getById: 'GET /api/orders/:id',
        getByUser: 'GET /api/orders/user/:userId',
      },
    },
  });
});

app.use('/health', healthRouter);
app.use('/api/products', productsRouter);
app.use('/api/orders', ordersRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize services
export async function initializeApp() {
  try {
    console.log('🚀 Initializing application services...');

    // Initialize Redis
    await initializeRedis();

    console.log('✅ All services initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    throw error;
  }
}

export default app;
