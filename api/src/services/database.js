import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Increase max listeners to accommodate OpenTelemetry instrumentation
// OTEL adds listeners for monitoring, so we need more than the default 10
pool.setMaxListeners(20);

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

/**
 * Execute a query with automatic connection handling
 */
export async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log slow queries
  if (duration > 1000) {
    console.warn('⚠️  Slow query detected:', { text, duration, rows: res.rowCount });
  }

  return res;
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient() {
  return await pool.connect();
}

/**
 * Check database connection health
 */
export async function checkHealth() {
  try {
    const result = await query('SELECT NOW() as now');
    return {
      status: 'healthy',
      timestamp: result.rows[0].now,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Close the pool
 */
export async function close() {
  await pool.end();
}

export default {
  query,
  getClient,
  checkHealth,
  close,
};
