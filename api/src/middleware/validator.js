import { validationResult } from 'express-validator';
import { trace } from '@opentelemetry/api';

/**
 * Validation error handler middleware
 */
export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttribute('validation.failed', true);
      span.setAttribute('validation.errors_count', errors.array().length);
      span.addEvent('validation.failed', {
        errors: JSON.stringify(errors.array()),
      });
    }

    const error = new Error('Validation failed');
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    error.details = errors.array();

    return res.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array(),
      },
    });
  }

  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute('validation.passed', true);
  }

  next();
}

export default {
  handleValidationErrors,
};
