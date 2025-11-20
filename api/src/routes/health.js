import express from 'express';
import { checkHealth as checkDbHealth } from '../services/database.js';
import { checkHealth as checkCacheHealth } from '../services/cache.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

/**
 * Health check endpoint
 * GET /health
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [dbHealth, cacheHealth] = await Promise.all([
      checkDbHealth(),
      checkCacheHealth(),
    ]);

    const isHealthy = dbHealth.status === 'healthy' && cacheHealth.status === 'healthy';

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        cache: cacheHealth,
      },
    });
  })
);

export default router;
