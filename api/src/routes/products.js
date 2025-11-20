import express from 'express';
import { query } from '../services/database.js';
import * as cache from '../services/cache.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { withSpan, addEvent } from '../utils/tracer.js';

const router = express.Router();

/**
 * Get all products
 * GET /api/products
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cacheKey = 'products:all';

    // Try to get from cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      addEvent('products.served_from_cache', { count: cached.length });
      return res.json({
        products: cached,
        cached: true,
      });
    }

    // Cache miss - fetch from database
    const result = await query(`
      SELECT id, sku, name, description, price, stock_quantity, created_at
      FROM products
      ORDER BY name
    `);

    const products = result.rows;

    // Store in cache for 5 minutes
    await cache.set(cacheKey, products, 300);

    addEvent('products.served_from_database', { count: products.length });

    res.json({
      products,
      cached: false,
    });
  })
);

/**
 * Get a single product by ID
 * GET /api/products/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const productId = parseInt(req.params.id, 10);

    if (isNaN(productId)) {
      const error = new Error('Invalid product ID');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }

    const cacheKey = `product:${productId}`;

    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      addEvent('product.served_from_cache', { product_id: productId });
      return res.json({
        product: cached,
        cached: true,
      });
    }

    // Fetch from database
    const result = await query(
      `SELECT id, sku, name, description, price, stock_quantity, created_at
       FROM products
       WHERE id = $1`,
      [productId]
    );

    if (result.rows.length === 0) {
      const error = new Error('Product not found');
      error.code = 'NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    const product = result.rows[0];

    // Cache for 5 minutes
    await cache.set(cacheKey, product, 300);

    addEvent('product.served_from_database', { product_id: productId });

    res.json({
      product,
      cached: false,
    });
  })
);

/**
 * Search products by name
 * GET /api/products/search?q=laptop
 */
router.get(
  '/search/query',
  asyncHandler(async (req, res) => {
    const searchQuery = req.query.q;

    if (!searchQuery) {
      const error = new Error('Search query is required');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }

    return withSpan(
      'products.search',
      async (span) => {
        span.setAttribute('search.query', searchQuery);

        const result = await query(
          `SELECT id, sku, name, description, price, stock_quantity
           FROM products
           WHERE name ILIKE $1 OR description ILIKE $1
           ORDER BY name`,
          [`%${searchQuery}%`]
        );

        span.setAttribute('search.results_count', result.rows.length);
        addEvent('products.searched', {
          query: searchQuery,
          count: result.rows.length,
        });

        res.json({
          products: result.rows,
          count: result.rows.length,
          query: searchQuery,
        });
      }
    );
  })
);

export default router;
