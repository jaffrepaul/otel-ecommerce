# OpenTelemetry E-commerce API

A robust Node.js e-commerce API fully instrumented with OpenTelemetry, designed to send telemetry data to Sentry via OTLP (OpenTelemetry Protocol).

## Features

- **Full OpenTelemetry Instrumentation**: Automatic and manual instrumentation for traces
- **Sentry Integration**: OTLP traces and logs sent directly to Sentry
- **Real-world E-commerce Logic**: Products, orders, inventory management, and payment processing
- **Database Operations**: PostgreSQL with connection pooling and transactions
- **Caching Layer**: Redis with cache hit/miss tracking
- **External API Simulation**: Payment gateway simulation with random failures
- **Error Handling**: Comprehensive error scenarios for testing
- **Custom Spans & Events**: Manual instrumentation examples throughout
- **Load Testing**: Built-in load test script to generate traffic

## Architecture

```
┌─────────────────┐
│   Express API   │
└────────┬────────┘
         │
    ┌────┴────┐
    │  OTEL   │ (Auto + Manual Instrumentation)
    │   SDK   │
    └────┬────┘
         │
    ┌────┴────┐
    │  OTLP   │ (HTTP Exporter)
    │ Exporter│
    └────┬────┘
         │
    ┌────┴────┐
    │ Sentry  │
    │ Platform│
    └─────────┘
```

This application supports two export modes:
- **Direct**: App → Sentry (default)
- **Collector**: App → OpenTelemetry Collector → Sentry

## Prerequisites

- Node.js 18+ (with ES modules support)
- Docker and Docker Compose
- Sentry account with OTLP enabled

## Quick Start

### 1. Clone and Install

```bash
cd otel-ecommerce-api
npm install
```

### 2. Start Infrastructure

```bash
docker compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379

**Note:** If you have an older Docker installation, use `docker-compose up -d` instead.

### 3. Configure Sentry

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` and configure your Sentry OTLP endpoints:

```bash
# Get these from Sentry: Project Settings > Client Keys (DSN)
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://YOUR-ORG.ingest.sentry.io/api/YOUR-PROJECT-ID/otlp/v1/traces
OTEL_EXPORTER_OTLP_TRACES_HEADERS="x-sentry-auth=sentry sentry_key=YOUR_PUBLIC_KEY"
```

**How to get Sentry OTLP credentials:**
1. Go to your Sentry project
2. Navigate to **Settings > Client Keys (DSN)**
3. Find your **Public Key** and **Project ID**
4. Construct the endpoint URL: `https://{ORG}.ingest.sentry.io/api/{PROJECT_ID}/otlp/v1/traces`
5. Format the auth header: `"x-sentry-auth=sentry sentry_key={PUBLIC_KEY}"`

### 4. Setup Database

```bash
npm run db:setup
```

This creates tables and seeds sample data (users, products).

### 5. Start the Application

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Health Check
```bash
GET /health
```

### Products
```bash
# Get all products
GET /api/products

# Get product by ID
GET /api/products/:id

# Search products
GET /api/products/search?q=laptop
```

### Orders
```bash
# Create order
POST /api/orders
Body: {
  "userId": 1,
  "items": [
    { "productId": 1, "quantity": 2 }
  ],
  "paymentMethod": "credit_card"
}

# Get order by ID
GET /api/orders/:id

# Get user orders
GET /api/orders/user/:userId
```

## Testing

### Manual Testing

```bash
# Health check
curl http://localhost:3000/health

# Get products
curl http://localhost:3000/api/products

# Create order
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "items": [{"productId": 1, "quantity": 1}],
    "paymentMethod": "credit_card"
  }'
```

### Load Testing

Run the built-in load test to generate realistic traffic:

```bash
npm test
```

This will:
- Fetch products (testing cache)
- Create orders (testing transactions)
- Trigger various error scenarios
- Generate concurrent requests
- Display statistics

## OpenTelemetry Features Demonstrated

### Auto-Instrumentation
- ✅ HTTP requests (incoming/outgoing)
- ✅ Express routes
- ✅ PostgreSQL queries
- ✅ Redis operations

### Manual Instrumentation
- ✅ Custom spans for business logic
- ✅ Custom attributes (user IDs, order IDs, SKUs)
- ✅ Events (cache hits, payment failures)
- ✅ Error recording
- ✅ Span status tracking

### Example Traces in Sentry

**Order Creation Flow:**
```
POST /api/orders
  ├─ order.create
  │   ├─ SELECT users (Postgres)
  │   ├─ SELECT products (Postgres)
  │   ├─ inventory.check
  │   │   └─ SELECT products (Postgres)
  │   ├─ BEGIN/INSERT/COMMIT (Transaction)
  │   ├─ inventory.reserve
  │   │   ├─ UPDATE products (Postgres)
  │   │   └─ cache.delete (Redis)
  │   └─ payment.process
  │       └─ [External API simulation]
```

## Error Scenarios

The application includes realistic error scenarios:

1. **404 Not Found**: Invalid product/order IDs
2. **400 Bad Request**: Validation errors
3. **409 Conflict**: Insufficient inventory
4. **422 Unprocessable**: Payment failures (~10% random rate)
5. **500 Server Error**: Database connection issues

All errors are captured in spans and sent to Sentry with full context.

## Project Structure

```
otel-ecommerce-api/
├── instrumentation.js          # OTEL SDK initialization
├── src/
│   ├── app.js                  # Express app setup
│   ├── server.js               # Server entry point
│   ├── routes/
│   │   ├── health.js           # Health checks
│   │   ├── products.js         # Product endpoints
│   │   └── orders.js           # Order endpoints
│   ├── services/
│   │   ├── database.js         # PostgreSQL client
│   │   ├── cache.js            # Redis client (instrumented)
│   │   ├── payment.js          # Payment simulation (instrumented)
│   │   └── inventory.js        # Inventory management (instrumented)
│   ├── middleware/
│   │   ├── errorHandler.js     # Global error handler
│   │   └── validator.js        # Request validation
│   └── utils/
│       ├── tracer.js           # Manual instrumentation helpers
│       ├── setupDatabase.js    # DB schema & seeds
│       └── loadTest.js         # Load testing script
├── docker-compose.yml          # PostgreSQL + Redis
├── package.json
└── .env                        # Configuration
```

## Configuration

Key environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `DATABASE_URL` | PostgreSQL connection string | See .env.example |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `OTEL_SERVICE_NAME` | Service name in traces | otel-ecommerce-api |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | Sentry OTLP endpoint | (required) |
| `OTEL_EXPORTER_OTLP_TRACES_HEADERS` | Sentry auth header | (required) |

## Observability in Sentry

Once running, you'll see in Sentry:

1. **Transactions**: Full request traces with nested spans
2. **Performance**: Bottleneck identification (slow queries, cache misses)
3. **Errors**: Captured errors with trace context
4. **Service Graph**: Dependencies between database, cache, and external services
5. **Custom Attributes**: Business context (order IDs, user emails, SKUs)

## Development Tips

### Enable OTEL Debug Logs

Uncomment in `instrumentation.js`:

```javascript
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
```

### Trigger Specific Errors

```bash
# 404 - Product not found
curl http://localhost:3000/api/products/99999

# 409 - Insufficient inventory
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "items": [{"productId": 1, "quantity": 99999}],
    "paymentMethod": "credit_card"
  }'

# 422 - Payment failure (10% random chance)
# Just create multiple orders - some will fail
```

### Monitor Slow Queries

Queries taking >1s are logged to console. Check your application logs.

## Troubleshooting

**Can't connect to database:**
```bash
docker compose ps
# Make sure postgres is running
docker compose logs postgres
```

**Redis connection failed:**
```bash
docker compose ps
# Make sure redis is running
docker compose restart redis
```

**Not seeing traces in Sentry:**
1. Verify your OTLP endpoint URL is correct
2. Check that your Sentry public key is valid
3. Ensure the environment variables are properly set (no typos)
4. Enable OTEL debug logging to see export attempts

**Port already in use:**
```bash
# Change PORT in .env
PORT=3001
```

## Cleanup

```bash
# Stop services
docker compose down

# Remove volumes (deletes data)
docker compose down -v
```

## Switching Export Modes

Switch between direct export to Sentry and using an OpenTelemetry Collector:

```bash
# Direct Mode (App → Sentry)
npm run mode:direct
npm start

# Collector Mode (App → Collector → Sentry)  
npm run mode:collector
npm run collector:start
npm start

# Check current mode
npm run mode:status
```

### Collector Commands

```bash
npm run collector:start    # Start collector
npm run collector:stop     # Stop collector
npm run collector:logs     # View logs
npm run collector:health   # Health check
```

## Next Steps

- Try switching between direct and collector modes
- Add more endpoints (PATCH, DELETE)
- Implement authentication/authorization
- Add second microservice for distributed tracing
- Configure custom sampling/filtering in `collector-config.yaml`

## Resources

- [OpenTelemetry Node.js Docs](https://opentelemetry.io/docs/languages/js/)
- [Sentry OTLP Integration](https://docs.sentry.io/concepts/otlp/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/concepts/semantic-conventions/)

## License

MIT
