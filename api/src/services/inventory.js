import { query, getClient } from './database.js';
import { withSpan, addEvent } from '../utils/tracer.js';
import * as cache from './cache.js';

/**
 * Check if sufficient inventory is available for an order
 */
export async function checkInventory(items) {
  return withSpan(
    'inventory.check',
    async (span) => {
      span.setAttribute('inventory.items_count', items.length);

      const results = [];

      for (const item of items) {
        const product = await query(
          'SELECT id, sku, name, stock_quantity FROM products WHERE id = $1',
          [item.productId]
        );

        if (product.rows.length === 0) {
          results.push({
            productId: item.productId,
            available: false,
            reason: 'product_not_found',
          });
          continue;
        }

        const { id, sku, name, stock_quantity } = product.rows[0];

        const isAvailable = stock_quantity >= item.quantity;

        results.push({
          productId: id,
          sku,
          name,
          requested: item.quantity,
          available: stock_quantity,
          sufficient: isAvailable,
        });

        if (!isAvailable) {
          addEvent('inventory.insufficient', {
            product_id: id,
            sku,
            requested: item.quantity,
            available: stock_quantity,
          });
        }
      }

      const allAvailable = results.every((r) => r.sufficient);
      span.setAttribute('inventory.all_available', allAvailable);

      if (!allAvailable) {
        addEvent('inventory.check_failed', {
          items_count: items.length,
          unavailable_count: results.filter((r) => !r.sufficient).length,
        });
      } else {
        addEvent('inventory.check_passed', {
          items_count: items.length,
        });
      }

      return {
        available: allAvailable,
        items: results,
      };
    }
  );
}

/**
 * Reserve inventory for an order (decrease stock)
 */
export async function reserveInventory(orderId, items) {
  return withSpan(
    'inventory.reserve',
    async (span) => {
      span.setAttributes({
        'inventory.order_id': orderId,
        'inventory.items_count': items.length,
      });

      const client = await getClient();

      try {
        await client.query('BEGIN');

        for (const item of items) {
          // Update stock quantity
          const result = await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity - $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND stock_quantity >= $1
             RETURNING id, sku, stock_quantity`,
            [item.quantity, item.productId]
          );

          if (result.rows.length === 0) {
            throw new Error(
              `Failed to reserve inventory for product ${item.productId}: insufficient stock`
            );
          }

          const { id, sku, stock_quantity } = result.rows[0];

          addEvent('inventory.reserved', {
            product_id: id,
            sku,
            quantity: item.quantity,
            remaining: stock_quantity,
          });

          // Invalidate cache for this product
          await cache.del(`product:${id}`);
          await cache.deletePattern('products:*');
        }

        await client.query('COMMIT');

        span.setAttribute('inventory.reservation_status', 'success');

        return {
          success: true,
          orderId,
          itemsReserved: items.length,
        };
      } catch (error) {
        await client.query('ROLLBACK');

        addEvent('inventory.reservation_failed', {
          order_id: orderId,
          error: error.message,
        });

        span.setAttribute('inventory.reservation_status', 'failed');
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

/**
 * Release reserved inventory (increase stock back)
 */
export async function releaseInventory(orderId, items) {
  return withSpan(
    'inventory.release',
    async (span) => {
      span.setAttributes({
        'inventory.order_id': orderId,
        'inventory.items_count': items.length,
      });

      const client = await getClient();

      try {
        await client.query('BEGIN');

        for (const item of items) {
          await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity + $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [item.quantity, item.productId]
          );

          addEvent('inventory.released', {
            product_id: item.productId,
            quantity: item.quantity,
          });

          // Invalidate cache
          await cache.del(`product:${item.productId}`);
          await cache.deletePattern('products:*');
        }

        await client.query('COMMIT');

        span.setAttribute('inventory.release_status', 'success');

        return {
          success: true,
          orderId,
          itemsReleased: items.length,
        };
      } catch (error) {
        await client.query('ROLLBACK');
        span.setAttribute('inventory.release_status', 'failed');
        throw error;
      } finally {
        client.release();
      }
    }
  );
}

/**
 * Get current inventory levels for a product
 */
export async function getInventoryLevel(productId) {
  return withSpan(
    'inventory.get_level',
    async (span) => {
      span.setAttribute('inventory.product_id', productId);

      const result = await query(
        'SELECT id, sku, name, stock_quantity FROM products WHERE id = $1',
        [productId]
      );

      if (result.rows.length === 0) {
        throw new Error(`Product ${productId} not found`);
      }

      const product = result.rows[0];
      span.setAttribute('inventory.current_level', product.stock_quantity);

      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        stockQuantity: product.stock_quantity,
      };
    }
  );
}

export default {
  checkInventory,
  reserveInventory,
  releaseInventory,
  getInventoryLevel,
};
