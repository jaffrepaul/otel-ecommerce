import { trace, context, SpanStatusCode } from '@opentelemetry/api';

// Get the tracer for manual instrumentation
const tracer = trace.getTracer('otel-ecommerce-api', '1.0.0');

/**
 * Helper function to create and execute a span with automatic error handling
 * @param {string} name - Span name
 * @param {Function} fn - Function to execute within the span
 * @param {Object} attributes - Additional span attributes
 * @returns {Promise<*>} - Result of the function
 */
export async function withSpan(name, fn, attributes = {}) {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Add an event to the current active span
 * @param {string} name - Event name
 * @param {Object} attributes - Event attributes
 */
export function addEvent(name, attributes = {}) {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Set attributes on the current active span
 * @param {Object} attributes - Attributes to set
 */
export function setAttributes(attributes) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Get the current active span
 * @returns {Span|undefined}
 */
export function getActiveSpan() {
  return trace.getActiveSpan();
}

export { tracer };
