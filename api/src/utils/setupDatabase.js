import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const schema = `
-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method VARCHAR(50),
  payment_status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
`;

const seedData = `
-- Seed users
INSERT INTO users (email, name) VALUES
  ('john@example.com', 'John Doe'),
  ('jane@example.com', 'Jane Smith'),
  ('bob@example.com', 'Bob Johnson')
ON CONFLICT (email) DO NOTHING;

-- Seed products
INSERT INTO products (sku, name, description, price, stock_quantity) VALUES
  ('LAPTOP-001', 'Premium Laptop', 'High-performance laptop with 16GB RAM', 1299.99, 50),
  ('PHONE-001', 'Smartphone Pro', 'Latest smartphone with 5G capability', 899.99, 100),
  ('TABLET-001', 'Tablet Plus', '10-inch tablet with stylus support', 599.99, 75),
  ('HEADPHONE-001', 'Wireless Headphones', 'Noise-canceling over-ear headphones', 249.99, 200),
  ('WATCH-001', 'Smart Watch', 'Fitness tracking smartwatch', 349.99, 150),
  ('KEYBOARD-001', 'Mechanical Keyboard', 'RGB backlit mechanical keyboard', 129.99, 80),
  ('MOUSE-001', 'Gaming Mouse', 'Wireless gaming mouse with RGB', 79.99, 120),
  ('MONITOR-001', '4K Monitor', '27-inch 4K IPS display', 499.99, 40),
  ('SPEAKER-001', 'Bluetooth Speaker', 'Portable waterproof speaker', 89.99, 180),
  ('CAMERA-001', 'Digital Camera', 'Mirrorless camera with 24MP sensor', 1499.99, 30)
ON CONFLICT (sku) DO NOTHING;
`;

async function setupDatabase() {
  const client = await pool.connect();

  try {
    console.log('🗄️  Setting up database schema...');
    await client.query(schema);
    console.log('✅ Schema created successfully');

    console.log('🌱 Seeding database with sample data...');
    await client.query(seedData);
    console.log('✅ Database seeded successfully');

  } catch (error) {
    console.error('❌ Error setting up database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

setupDatabase()
  .then(() => {
    console.log('✨ Database setup complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to setup database:', error);
    process.exit(1);
  });
