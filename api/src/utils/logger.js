import * as api from '@opentelemetry/api';
import { logs as logsAPI } from '@opentelemetry/api-logs';

// Severity numbers based on OpenTelemetry spec
const SeverityNumber = {
  TRACE: 1,
  DEBUG: 5,
  INFO: 9,
  WARN: 13,
  ERROR: 17,
  FATAL: 21,
};

/**
 * OpenTelemetry Logger that sends logs to Sentry via OTLP
 * Automatically includes trace context for correlation
 * 
 * IMPORTANT: Trace context (trace_id, span_id) is automatically attached
 * by the OpenTelemetry SDK when logs are emitted within an active span.
 * Do NOT manually add trace IDs as attributes - it will cause duplicates
 * in Sentry. The SDK handles this correlation automatically.
 * 
 * Usage:
 *   logger.info('User logged in', { 'user.id': 123 });
 *   logger.error('Payment failed', { 'order.id': 456 });
 *   logger.exception(error, { 'http.path': '/api/orders' });
 */
class Logger {
  constructor() {
    try {
      this.logger = logsAPI.getLogger('otel-ecommerce-api', '1.0.0');
      console.log('✅ OpenTelemetry Logger initialized');
    } catch (error) {
      console.warn('⚠️  OpenTelemetry Logs API not available:', error.message);
      this.logger = null;
    }
  }

  /**
   * Log with specified severity
   */
  _log(severity, severityNumber, message, attributes = {}) {
    if (!this.logger) {
      // Fallback to console if logger not available
      console.log(`[${severity}] ${message}`, attributes);
      return;
    }
    
    const logRecord = {
      severityNumber,
      severityText: severity,
      body: message,
      attributes: {
        ...attributes,
        'service.name': 'otel-ecommerce-api',
      },
      timestamp: Date.now(),
    };

    // Emit the log - OpenTelemetry SDK will automatically attach trace context
    this.logger.emit(logRecord);
  }

  /**
   * Debug level log
   */
  debug(message, attributes = {}) {
    this._log('DEBUG', SeverityNumber.DEBUG, message, attributes);
  }

  /**
   * Info level log
   */
  info(message, attributes = {}) {
    this._log('INFO', SeverityNumber.INFO, message, attributes);
  }

  /**
   * Warn level log
   */
  warn(message, attributes = {}) {
    this._log('WARN', SeverityNumber.WARN, message, attributes);
  }

  /**
   * Error level log
   */
  error(message, attributes = {}) {
    this._log('ERROR', SeverityNumber.ERROR, message, attributes);
  }

  /**
   * Fatal level log
   */
  fatal(message, attributes = {}) {
    this._log('FATAL', SeverityNumber.FATAL, message, attributes);
  }

  /**
   * Log an exception with full details
   */
  exception(error, attributes = {}) {
    const errorAttributes = {
      ...attributes,
      'exception.type': error.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    };

    if (error.code) {
      errorAttributes['exception.code'] = error.code;
    }

    this._log('ERROR', SeverityNumber.ERROR, error.message, errorAttributes);
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;

