import app, { initializeApp } from './app.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // Initialize application services
    await initializeApp();

    // Start the Express server
    const server = app.listen(PORT, () => {
      console.log('');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('🚀 OpenTelemetry E-commerce API Server');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`📡 Server listening on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}`);
      console.log(`💚 Health Check: http://localhost:${PORT}/health`);
      console.log('');
      console.log('📊 Available Endpoints:');
      console.log('   GET  /api/products          - List all products');
      console.log('   GET  /api/products/:id      - Get product by ID');
      console.log('   GET  /api/products/search   - Search products');
      console.log('   POST /api/orders            - Create new order');
      console.log('   GET  /api/orders/:id        - Get order by ID');
      console.log('   GET  /api/orders/user/:id   - Get user orders');
      console.log('═══════════════════════════════════════════════════════════');
      console.log('');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n${signal} received. Starting graceful shutdown...`);

      server.close(() => {
        console.log('✅ HTTP server closed');
      });

      // Close database connections, Redis, etc.
      // The instrumentation.js SIGTERM handler will close OTEL SDK

      setTimeout(() => {
        console.error('❌ Forceful shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
