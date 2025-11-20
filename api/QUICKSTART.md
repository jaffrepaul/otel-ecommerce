# Quick Start Guide

Get the OpenTelemetry E-commerce API running in 5 minutes!

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Configure Sentry

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Get your Sentry OTLP credentials:

   - Go to [Sentry](https://sentry.io)
   - Navigate to your project
   - Go to **Settings** → **Client Keys (DSN)**
   - Copy your **Public Key** and **Project ID**

3. Edit `.env` and update these lines:

```bash
# Replace YOUR-ORG-ID, YOUR-PROJECT-ID, and YOUR_PUBLIC_KEY
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://YOUR-ORG-ID.ingest.us.sentry.io/api/YOUR-PROJECT-ID/integration/otlp/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS="x-sentry-auth=sentry sentry_key=YOUR_PUBLIC_KEY"
```

**Example:**

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://o4509013641854976.ingest.us.sentry.io/api/4510366124343296/integration/otlp/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS="x-sentry-auth=sentry sentry_key=abc123def456"
```

## Step 3: Start Infrastructure

```bash
docker compose up -d
```

**Note:** If you have an older Docker installation, use `docker-compose up -d` instead.

Wait 10 seconds for PostgreSQL and Redis to be ready.

## Step 4: Setup Database

```bash
npm run db:setup
```

You should see:

```
✅ Schema created successfully
✅ Database seeded successfully
✨ Database setup complete!
```

## Step 5: Start the Server

```bash
npm start
```

You should see:

```
📡 Mode: DIRECT
📡 Exporting to: https://your-org.ingest.us.sentry.io/...
🔭 OpenTelemetry instrumentation initialized
✅ Redis connected
🚀 OpenTelemetry E-commerce API Server
📡 Server listening on port 3000
```

**Check your current mode anytime:**

```bash
npm run mode:status
```

## Step 6: Test It!

Open a new terminal and run:

```bash
# Quick API test
npm run test:api

# Or manually:
curl http://localhost:3000/api/products

# Run load test (generates ~40 traces with realistic e-commerce scenarios:
# product fetches, order creation, payment failures, inventory errors, etc)
npm test
```

## Step 7: Check Sentry

1. Go to your Sentry project
2. Navigate to **Explore** > **Traces** or **Logs**
3. You should see traces and logs from your API calls!

## Common Issues

**"Docker compose not found"**
→ Install Docker Desktop from https://docker.com/

**"Port 5432 already in use"**
→ You have PostgreSQL running locally. Stop it or change the port in docker-compose.yml

**"Not seeing traces in Sentry"**
→ Double-check your OTLP endpoint URL and auth header in .env

**"Database connection error"**
→ Wait 10-20 seconds after `docker compose up` for PostgreSQL to fully start

## Switching Export Modes

You can send telemetry directly to Sentry, or through an OpenTelemetry Collector.

**Check current mode:**

```bash
npm run mode:status
```

### Switch to Collector Mode

**Prerequisites:** Same as Steps 1-4 above (infrastructure and database must be running)

```bash
# 1. Switch mode
npm run mode:collector

# 2. Add to .env:
#    OTEL_EXPORTER_OTLP_ENDPOINT=https://YOUR-ORG-ID.ingest.us.sentry.io
#    SENTRY_AUTH_HEADER=sentry_key=YOUR_PUBLIC_KEY,sentry_version=7

# 3. Start collector
npm run collector:start

# 4. Start app
npm start
```

Look for: `"📡 Mode: COLLECTOR"`

**Test it:** Use the same commands from Step 6:

```bash
npm run test:api
npm test
```

Traces now flow: App → Collector → Sentry (check both!)

### Switch to Direct Mode

```bash
npm run mode:direct
npm start
```

Look for: `"📡 Mode: DIRECT"`

## What's Next?

- Switch between direct and collector modes
- Explore the API endpoints (see README.md)
- Check out the manual instrumentation in `src/services/`
- Modify the code and see traces update in real-time
- Try triggering errors to see how they appear in Sentry

## Need Help?

Check the full README.md for detailed documentation.
