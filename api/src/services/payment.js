import axios from 'axios';
import { withSpan, addEvent } from '../utils/tracer.js';

/**
 * Process payment through external payment gateway
 * This simulates an external HTTP call that would be auto-instrumented
 */
export async function processPayment(orderId, amount, paymentMethod) {
  return withSpan(
    'payment.process',
    async (span) => {
      span.setAttributes({
        'payment.order_id': orderId,
        'payment.amount': amount,
        'payment.method': paymentMethod,
        'payment.currency': 'USD',
      });

      addEvent('payment.initiated', {
        order_id: orderId,
        amount,
        method: paymentMethod,
      });

      // Simulate payment processing
      // In a real application, this would call an external payment API
      try {
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 400));

        // Simulate random failures (10% failure rate)
        const shouldFail = Math.random() < 0.1;

        if (shouldFail) {
          const errorReasons = [
            'insufficient_funds',
            'card_declined',
            'expired_card',
            'invalid_cvv',
          ];
          const errorReason = errorReasons[Math.floor(Math.random() * errorReasons.length)];

          addEvent('payment.failed', {
            order_id: orderId,
            reason: errorReason,
          });

          span.setAttribute('payment.status', 'failed');
          span.setAttribute('payment.error_reason', errorReason);

          const error = new Error(`Payment failed: ${errorReason}`);
          error.code = 'PAYMENT_FAILED';
          error.reason = errorReason;
          throw error;
        }

        // Simulate successful payment
        const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        addEvent('payment.succeeded', {
          order_id: orderId,
          transaction_id: transactionId,
        });

        span.setAttribute('payment.status', 'success');
        span.setAttribute('payment.transaction_id', transactionId);

        return {
          success: true,
          transactionId,
          amount,
          paymentMethod,
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        span.setAttribute('payment.status', 'error');

        // Re-throw to let the span handler catch it
        throw error;
      }
    }
  );
}

/**
 * Verify payment status
 */
export async function verifyPayment(transactionId) {
  return withSpan(
    'payment.verify',
    async (span) => {
      span.setAttribute('payment.transaction_id', transactionId);

      // Simulate verification check
      await new Promise((resolve) => setTimeout(resolve, 50 + Math.random() * 100));

      addEvent('payment.verified', { transaction_id: transactionId });

      return {
        verified: true,
        transactionId,
        timestamp: new Date().toISOString(),
      };
    }
  );
}

/**
 * Refund a payment
 */
export async function refundPayment(transactionId, amount) {
  return withSpan(
    'payment.refund',
    async (span) => {
      span.setAttributes({
        'payment.transaction_id': transactionId,
        'payment.refund_amount': amount,
      });

      // Simulate refund processing
      await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 300));

      const refundId = `ref_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      addEvent('payment.refunded', {
        transaction_id: transactionId,
        refund_id: refundId,
        amount,
      });

      span.setAttribute('payment.refund_id', refundId);

      return {
        success: true,
        refundId,
        transactionId,
        amount,
        timestamp: new Date().toISOString(),
      };
    }
  );
}

export default {
  processPayment,
  verifyPayment,
  refundPayment,
};
