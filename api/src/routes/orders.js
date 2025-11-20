import express from 'express';
import { body } from 'express-validator';
import { query, getClient } from '../services/database.js';
import * as cache from '../services/cache.js';
import * as payment from '../services/payment.js';
import * as inventory from '../services/inventory.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { handleValidationErrors } from '../middleware/validator.js';
import { withSpan, addEvent, setAttributes } from '../utils/tracer.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Create a new order
 * POST /api/orders
 */
router.post(
  '/',
  [
    body('userId').isInt().withMessage('User ID must be an integer'),
    body('items').isArray({ min: 1 }).withMessage('Items must be a non-empty array'),
    body('items.*.productId').isInt().withMessage('Product ID must be an integer'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
    body('paymentMethod')
      .isIn(['credit_card', 'debit_card', 'paypal'])
      .withMessage('Invalid payment method'),
    handleValidationErrors,
  ],
  asyncHandler(async (req, res) => {
    const { userId, items, paymentMethod } = req.body;

    return withSpan(
      'order.create',
      async (span) => {
        span.setAttributes({
          'order.user_id': userId,
          'order.items_count': items.length,
          'order.payment_method': paymentMethod,
        });

        addEvent('order.creation_started', {
          user_id: userId,
          items_count: items.length,
        });

        // Step 1: Validate user exists
        const userResult = await query('SELECT id, email, name FROM users WHERE id = $1', [
          userId,
        ]);

        if (userResult.rows.length === 0) {
          const error = new Error('User not found');
          error.code = 'NOT_FOUND';
          error.statusCode = 404;
          throw error;
        }

        const user = userResult.rows[0];
        span.setAttribute('order.user_email', user.email);

        // Step 2: Calculate total and validate products
        let totalAmount = 0;
        const productDetails = [];

        for (const item of items) {
          const productResult = await query(
            'SELECT id, sku, name, price FROM products WHERE id = $1',
            [item.productId]
          );

          if (productResult.rows.length === 0) {
            const error = new Error(`Product ${item.productId} not found`);
            error.code = 'NOT_FOUND';
            error.statusCode = 404;
            throw error;
          }

          const product = productResult.rows[0];
          const itemTotal = parseFloat(product.price) * item.quantity;
          totalAmount += itemTotal;

          productDetails.push({
            ...item,
            price: product.price,
            name: product.name,
            sku: product.sku,
            itemTotal,
          });
        }

        span.setAttribute('order.total_amount', totalAmount);
        addEvent('order.total_calculated', { total: totalAmount });

        // Step 3: Check inventory availability
        const inventoryCheck = await inventory.checkInventory(items);

        if (!inventoryCheck.available) {
          const unavailableItems = inventoryCheck.items.filter((i) => !i.sufficient);

          addEvent('order.insufficient_inventory', {
            unavailable_count: unavailableItems.length,
          });

          const error = new Error('Insufficient inventory for one or more items');
          error.code = 'INSUFFICIENT_INVENTORY';
          error.statusCode = 409;
          error.details = unavailableItems;
          throw error;
        }

        // Step 4: Create order record
        const client = await getClient();
        let orderId;
        let paymentResult;

        try {
          await client.query('BEGIN');

          // Insert order
          const orderResult = await client.query(
            `INSERT INTO orders (user_id, status, total_amount, payment_method, payment_status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [userId, 'pending', totalAmount, paymentMethod, 'pending']
          );

          orderId = orderResult.rows[0].id;
          span.setAttribute('order.id', orderId);

          addEvent('order.record_created', { order_id: orderId });

          // Insert order items
          for (const item of productDetails) {
            await client.query(
              `INSERT INTO order_items (order_id, product_id, quantity, price)
               VALUES ($1, $2, $3, $4)`,
              [orderId, item.productId, item.quantity, item.price]
            );
          }

          await client.query('COMMIT');

          addEvent('order.items_saved', {
            order_id: orderId,
            items_count: items.length,
          });
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }

        // Step 5: Reserve inventory
        try {
          await inventory.reserveInventory(orderId, items);
          addEvent('order.inventory_reserved', { order_id: orderId });
        } catch (error) {
          // If inventory reservation fails, mark order as failed
          await query(
            `UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
            ['failed', orderId]
          );

          addEvent('order.inventory_reservation_failed', {
            order_id: orderId,
            error: error.message,
          });

          throw error;
        }

        // Step 6: Process payment
        try {
          paymentResult = await payment.processPayment(orderId, totalAmount, paymentMethod);

          // Update order with payment info
          await query(
            `UPDATE orders
             SET payment_status = $1, status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            ['completed', 'confirmed', orderId]
          );

          span.setAttribute('order.payment_transaction_id', paymentResult.transactionId);
          span.setAttribute('order.status', 'confirmed');

          addEvent('order.payment_completed', {
            order_id: orderId,
            transaction_id: paymentResult.transactionId,
          });

          // Log successful order creation
          logger.info('Order created successfully', {
            'order.id': orderId,
            'order.user_id': userId,
            'order.total_amount': totalAmount,
            'order.items_count': items.length,
            'payment.transaction_id': paymentResult.transactionId,
          });
        } catch (error) {
          // Payment failed - release inventory and mark order as failed
          await inventory.releaseInventory(orderId, items);

          await query(
            `UPDATE orders
             SET payment_status = $1, status = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            ['failed', 'cancelled', orderId]
          );

          addEvent('order.payment_failed', {
            order_id: orderId,
            error: error.message,
            reason: error.reason,
          });

          // Log payment failure
          logger.warn('Payment failed for order', {
            'order.id': orderId,
            'order.user_id': userId,
            'payment.error': error.message,
            'payment.reason': error.reason,
          });

          span.setAttribute('order.status', 'cancelled');
          throw error;
        }

        // Step 7: Return success response
        const finalOrder = await query(
          `SELECT o.*, u.email, u.name as user_name
           FROM orders o
           JOIN users u ON o.user_id = u.id
           WHERE o.id = $1`,
          [orderId]
        );

        addEvent('order.creation_completed', {
          order_id: orderId,
          status: 'confirmed',
        });

        res.status(201).json({
          order: {
            ...finalOrder.rows[0],
            items: productDetails,
            payment: paymentResult,
          },
          message: 'Order created successfully',
        });
      }
    );
  })
);

/**
 * Get order by ID
 * GET /api/orders/:id
 */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const orderId = parseInt(req.params.id, 10);

    if (isNaN(orderId)) {
      const error = new Error('Invalid order ID');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }

    const cacheKey = `order:${orderId}`;

    // Try cache first
    const cached = await cache.get(cacheKey);
    if (cached) {
      addEvent('order.served_from_cache', { order_id: orderId });
      return res.json({
        order: cached,
        cached: true,
      });
    }

    // Fetch from database
    const orderResult = await query(
      `SELECT o.*, u.email, u.name as user_name
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderResult.rows.length === 0) {
      const error = new Error('Order not found');
      error.code = 'NOT_FOUND';
      error.statusCode = 404;
      throw error;
    }

    const order = orderResult.rows[0];

    // Fetch order items
    const itemsResult = await query(
      `SELECT oi.*, p.sku, p.name as product_name
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    order.items = itemsResult.rows;

    // Cache for 2 minutes
    await cache.set(cacheKey, order, 120);

    addEvent('order.served_from_database', { order_id: orderId });

    res.json({
      order,
      cached: false,
    });
  })
);

/**
 * Get orders for a user
 * GET /api/orders/user/:userId
 */
router.get(
  '/user/:userId',
  asyncHandler(async (req, res) => {
    const userId = parseInt(req.params.userId, 10);

    if (isNaN(userId)) {
      const error = new Error('Invalid user ID');
      error.code = 'VALIDATION_ERROR';
      error.statusCode = 400;
      throw error;
    }

    const result = await query(
      `SELECT o.*, COUNT(oi.id) as items_count
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 50`,
      [userId]
    );

    addEvent('orders.fetched_for_user', {
      user_id: userId,
      count: result.rows.length,
    });

    res.json({
      orders: result.rows,
      count: result.rows.length,
    });
  })
);

export default router;
