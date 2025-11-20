import { trace, SpanStatusCode } from '@opentelemetry/api';
import { logger } from '../utils/logger.js';

/**
 * Global error handling middleware
 * Ensures errors are properly recorded in traces
 */
export function errorHandler(err, req, res, next) {
  // Get the active span and record the error
  const span = trace.getActiveSpan();
  if (span) {
    span.recordException(err);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: err.message,
    });
    span.setAttribute('error.type', err.name);
    if (err.code) {
      span.setAttribute('error.code', err.code);
    }
  }

  // Log the error using OpenTelemetry logger (sends to Sentry)
  logger.exception(err, {
    'http.path': req.path,
    'http.method': req.method,
    'http.url': req.url,
    'user_agent': req.get('user-agent'),
  });

  // Determine status code
  let statusCode = err.statusCode || 500;

  // Handle specific error types
  if (err.code === 'PAYMENT_FAILED') {
    statusCode = 422;
  } else if (err.code === 'INSUFFICIENT_INVENTORY') {
    statusCode = 409;
  } else if (err.code === 'NOT_FOUND') {
    statusCode = 404;
  } else if (err.code === 'VALIDATION_ERROR') {
    statusCode = 400;
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message: err.message,
      code: err.code || 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(req, res) {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('http.status_code', 404);
    span.setAttribute('error.type', 'NotFound');
  }

  res.status(404).json({
    error: {
      message: 'Resource not found',
      code: 'NOT_FOUND',
      path: req.path,
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export default {
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
