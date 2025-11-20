# Mode Switching

Switch between direct export to Sentry and using an OpenTelemetry Collector.

## Commands

```bash
# Switch to direct mode (App → Sentry)
npm run mode:direct

# Switch to collector mode (App → Collector → Sentry)
npm run mode:collector

# Check current mode
npm run mode:status
```

## Direct Mode Setup

1. Switch mode:

   ```bash
   npm run mode:direct
   ```

2. Start app:
   ```bash
   npm start
   ```

Look for: `"📡 Mode: DIRECT"`

## Collector Mode Setup

1. Switch mode:

   ```bash
   npm run mode:collector
   ```

2. Add to `.env`:

   ```bash
   OTEL_EXPORTER_OTLP_ENDPOINT=https://YOUR-ORG-ID.ingest.us.sentry.io
   SENTRY_AUTH_HEADER=sentry_key=YOUR_PUBLIC_KEY,sentry_version=7
   ```

3. Start collector:

   ```bash
   npm run collector:start
   ```

4. Start app:
   ```bash
   npm start
   ```

Look for: `"📡 Mode: COLLECTOR"`

View collector telemetry: http://localhost:55679/debug/tracez

## Collector Commands

```bash
npm run collector:start    # Start collector
npm run collector:stop     # Stop collector
npm run collector:logs     # View logs
npm run collector:health   # Health check
```

## How It Works

The app reads `OTEL_MODE` from your `.env` file and configures the OTLP exporters accordingly:

- `OTEL_MODE=direct` → exports to Sentry OTLP endpoint
- `OTEL_MODE=collector` → exports to localhost:4318 (collector)

The mode switching scripts (`npm run mode:*`) simply update this variable in your `.env` file.
