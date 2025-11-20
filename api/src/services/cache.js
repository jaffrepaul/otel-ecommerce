import { createClient } from 'redis';
import { withSpan, addEvent } from '../utils/tracer.js';

let redisClient = null;

/**
 * Initialize Redis client
 */
export async function initializeRedis() {
  if (redisClient) {
    return redisClient;
  }

  redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error', err);
  });

  redisClient.on('connect', () => {
    console.log('✅ Redis connected');
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * Get value from cache with instrumentation
 */
export async function get(key) {
  return withSpan(
    'cache.get',
    async (span) => {
      span.setAttributes({
        'cache.key': key,
        'cache.operation': 'get',
      });

      const value = await redisClient.get(key);

      if (value) {
        addEvent('cache.hit', { key });
        span.setAttribute('cache.hit', true);
      } else {
        addEvent('cache.miss', { key });
        span.setAttribute('cache.hit', false);
      }

      return value ? JSON.parse(value) : null;
    }
  );
}

/**
 * Set value in cache with TTL
 */
export async function set(key, value, ttlSeconds = 300) {
  return withSpan(
    'cache.set',
    async (span) => {
      span.setAttributes({
        'cache.key': key,
        'cache.operation': 'set',
        'cache.ttl': ttlSeconds,
      });

      const serialized = JSON.stringify(value);
      await redisClient.setEx(key, ttlSeconds, serialized);

      addEvent('cache.stored', { key, ttl: ttlSeconds });
      return true;
    }
  );
}

/**
 * Delete value from cache
 */
export async function del(key) {
  return withSpan(
    'cache.delete',
    async (span) => {
      span.setAttributes({
        'cache.key': key,
        'cache.operation': 'delete',
      });

      const result = await redisClient.del(key);
      addEvent('cache.deleted', { key, existed: result > 0 });
      return result;
    }
  );
}

/**
 * Delete all keys matching a pattern
 */
export async function deletePattern(pattern) {
  return withSpan(
    'cache.delete_pattern',
    async (span) => {
      span.setAttributes({
        'cache.pattern': pattern,
        'cache.operation': 'delete_pattern',
      });

      const keys = await redisClient.keys(pattern);

      if (keys.length > 0) {
        const result = await redisClient.del(keys);
        addEvent('cache.pattern_deleted', { pattern, count: result });
        return result;
      }

      return 0;
    }
  );
}

/**
 * Check Redis connection health
 */
export async function checkHealth() {
  try {
    if (!redisClient || !redisClient.isOpen) {
      return {
        status: 'unhealthy',
        error: 'Redis client not connected',
      };
    }

    await redisClient.ping();
    return {
      status: 'healthy',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
    };
  }
}

/**
 * Close Redis connection
 */
export async function close() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}

export default {
  initializeRedis,
  get,
  set,
  del,
  deletePattern,
  checkHealth,
  close,
};
