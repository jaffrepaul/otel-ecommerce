import { config } from 'dotenv';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const packageJson = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8'));

// Parse header string format: "key1=value1,key2=value2"
function parseHeaders(headerString) {
  if (!headerString) return {};
  
  const headers = {};
  headerString.split(',').forEach(pair => {
    const [key, ...valueParts] = pair.trim().split('=');
    if (key && valueParts.length > 0) {
      headers[key] = valueParts.join('=').trim();
    }
  });
  return headers;
}

const resource = new Resource({
  [SEMRESATTRS_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'otel-ecommerce-api',
  [SEMRESATTRS_SERVICE_VERSION]: packageJson.version,
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

// Export mode selection (set OTEL_MODE in .env)
// direct    = App → Sentry (default)
// collector = App → Collector → Sentry

const OTEL_MODE = process.env.OTEL_MODE || 'direct';

let traceExporter;
let logExporter;

if (OTEL_MODE === 'collector') {
  // Send to local collector (collector forwards to Sentry)
  traceExporter = new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces',
  });

  logExporter = new OTLPLogExporter({
    url: 'http://localhost:4318/v1/logs',
  });

  console.log('📡 Mode: COLLECTOR');
  console.log('📡 Exporting to: http://localhost:4318');
  
} else {
  // Send directly to Sentry
  traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_TRACES_HEADERS),
  });

  logExporter = new OTLPLogExporter({
    url: process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT,
    headers: parseHeaders(process.env.OTEL_EXPORTER_OTLP_LOGS_HEADERS),
  });

  console.log('📡 Mode: DIRECT');
  console.log('📡 Exporting to:', process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT);
}

// Initialize OpenTelemetry SDK
const sdk = new NodeSDK({
  resource,
  traceExporter,
  logRecordProcessors: [new BatchLogRecordProcessor(logExporter)],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': {
        enabled: false, // Too noisy
      },
      '@opentelemetry/instrumentation-http': {
        enabled: true,
        ignoreIncomingPaths: ['/health'],
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
        enhancedDatabaseReporting: true,
      },
      '@opentelemetry/instrumentation-redis-4': {
        enabled: true,
      },
    }),
  ],
});

sdk.start();

// Uncomment for debug logging:
// diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

console.log('🔭 OpenTelemetry instrumentation initialized');
console.log(`📊 Service: ${resource.attributes[SEMRESATTRS_SERVICE_NAME]}`);
console.log(`🏷️  Version: ${resource.attributes[SEMRESATTRS_SERVICE_VERSION]}`);
console.log(`🌍 Environment: ${resource.attributes[SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]}`);

// Graceful shutdown
process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('🛑 OpenTelemetry SDK shut down successfully'))
    .catch((error) => console.error('❌ Error shutting down OpenTelemetry SDK', error))
    .finally(() => process.exit(0));
});
