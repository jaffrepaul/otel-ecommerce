# Quick Start Guide

Get the OpenTelemetry E-commerce API running in 5 minutes!

## Prerequisites

- Node.js 18+
- Free Neon account (sign up at https://neon.tech)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Setup Database with Neon

Create a free PostgreSQL database:

```bash
npx neondb -y
```

This will:
- Prompt you to login/signup to Neon (opens browser)
- Create a new Neon project
- Display a connection string

**Copy the connection string** - it looks like:
```
postgresql://user:password@ep-xyz-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

## Step 3: Configure Environment

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Edit `.env` and add your **Neon connection string** from Step 2:

```bash
DATABASE_URL=postgresql://user:password@ep-xyz-123.us-east-2.aws.neon.tech/neondb?sslmode=require
```

3. Add your Sentry OTLP endpoints to `.env`:

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=<your-traces-endpoint>
OTEL_EXPORTER_OTLP_TRACES_HEADERS="<your-auth-header>"
```

**Note:** Your instructor will show you where to get these values from your Sentry project.

## Step 4: Initialize Database Schema

```bash
npm run db:setup
```

This creates tables and seeds sample data (products, users) in your Neon database.

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
✅ In-memory cache initialized
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

**"Database connection error"**
→ Double-check your DATABASE_URL in .env - make sure it includes `?sslmode=require`

**"Not seeing traces in Sentry"**
→ Double-check your OTLP endpoint URL and auth header in .env

**"neondb command asks for login"**
→ This is expected - you need a free Neon account. It will open a browser to login/signup

**"Can't create Neon project"**
→ Make sure you completed the Neon signup/login in the browser

## Switching Export Modes

You can send telemetry directly to Sentry, or through an OpenTelemetry Collector.

**Check current mode:**

```bash
npm run mode:status
```

### Switch to Collector Mode

Send telemetry through an OpenTelemetry Collector instead of directly to Sentry. The collector will be automatically downloaded and run without Docker.

**Prerequisites:** Same as Steps 1-4 above (database must be configured).

```bash
# 1. Add to .env (if not already present):
#    OTEL_EXPORTER_OTLP_ENDPOINT=https://YOUR-ORG-ID.ingest.us.sentry.io
#    SENTRY_AUTH_HEADER=sentry_key=YOUR_PUBLIC_KEY,sentry_version=7

# 2. Switch mode
npm run mode:collector

# 3. Start collector (downloads binary automatically on first run)
npm run collector:start

# 4. Start app
npm start
```

Look for: `"📡 Mode: COLLECTOR"`

The first time you run `npm run collector:start`, it will download the OpenTelemetry Collector binary (~100MB). This is a one-time download.

**Collector Management:**

```bash
# Start collector
npm run collector:start

# Stop collector
npm run collector:stop

# Check collector health
npm run collector:health

# View collector logs
npm run collector:logs
```

**Test it:** Use the same commands from Step 6:

```bash
npm run test:api
npm test
```

Traces now flow: App → Collector (localhost:4318) → Sentry

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
