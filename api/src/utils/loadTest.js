import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000';

// Test scenarios
const scenarios = {
  getProducts: async () => {
    const response = await axios.get(`${API_URL}/api/products`);
    return response.data;
  },

  getProductById: async (id) => {
    const response = await axios.get(`${API_URL}/api/products/${id}`);
    return response.data;
  },

  searchProducts: async (query) => {
    const response = await axios.get(`${API_URL}/api/products/search/query?q=${query}`);
    return response.data;
  },

  createOrder: async (userId, items, paymentMethod) => {
    const response = await axios.post(`${API_URL}/api/orders`, {
      userId,
      items,
      paymentMethod,
    });
    return response.data;
  },

  getOrder: async (orderId) => {
    const response = await axios.get(`${API_URL}/api/orders/${orderId}`);
    return response.data;
  },

  getUserOrders: async (userId) => {
    const response = await axios.get(`${API_URL}/api/orders/user/${userId}`);
    return response.data;
  },

  // Intentional error scenarios
  getInvalidProduct: async () => {
    try {
      await axios.get(`${API_URL}/api/products/99999`);
    } catch (error) {
      return { error: error.response?.data };
    }
  },

  createOrderInsufficientInventory: async () => {
    try {
      await axios.post(`${API_URL}/api/orders`, {
        userId: 1,
        items: [
          { productId: 1, quantity: 10000 }, // Way more than available
        ],
        paymentMethod: 'credit_card',
      });
    } catch (error) {
      return { error: error.response?.data };
    }
  },

  createOrderInvalidPayment: async () => {
    // This will randomly fail due to payment simulation
    try {
      const response = await axios.post(`${API_URL}/api/orders`, {
        userId: 1,
        items: [
          { productId: 2, quantity: 1 },
        ],
        paymentMethod: 'credit_card',
      });
      return response.data;
    } catch (error) {
      return { error: error.response?.data };
    }
  },
};

// Utility function to add delay
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Run load test
async function runLoadTest() {
  console.log('🔥 Starting load test...\n');

  const stats = {
    total: 0,
    success: 0,
    errors: 0,
  };

  try {
    // 1. Get all products (cache warming)
    console.log('📦 Fetching all products...');
    const products = await scenarios.getProducts();
    console.log(`   ✅ Found ${products.products.length} products\n`);
    stats.total++;
    stats.success++;

    await delay(500);

    // 2. Get all products again (should be cached)
    console.log('📦 Fetching all products again (should be cached)...');
    const productsCached = await scenarios.getProducts();
    console.log(`   ✅ Cached: ${productsCached.cached}\n`);
    stats.total++;
    stats.success++;

    await delay(500);

    // 3. Get individual products
    console.log('🔍 Fetching individual products...');
    for (let i = 1; i <= 5; i++) {
      const product = await scenarios.getProductById(i);
      console.log(`   ✅ Product ${i}: ${product.product.name}`);
      stats.total++;
      stats.success++;
      await delay(200);
    }
    console.log('');

    await delay(500);

    // 4. Search products
    console.log('🔎 Searching products...');
    const searchResults = await scenarios.searchProducts('laptop');
    console.log(`   ✅ Found ${searchResults.count} results for "laptop"\n`);
    stats.total++;
    stats.success++;

    await delay(500);

    // 5. Create successful orders
    console.log('🛒 Creating orders...');
    const orderScenarios = [
      { userId: 1, items: [{ productId: 1, quantity: 1 }], paymentMethod: 'credit_card' },
      { userId: 2, items: [{ productId: 2, quantity: 2 }, { productId: 3, quantity: 1 }], paymentMethod: 'debit_card' },
      { userId: 3, items: [{ productId: 4, quantity: 1 }], paymentMethod: 'paypal' },
    ];

    for (const orderData of orderScenarios) {
      try {
        const order = await scenarios.createOrder(
          orderData.userId,
          orderData.items,
          orderData.paymentMethod
        );
        console.log(`   ✅ Order ${order.order.id}: $${order.order.total_amount} - ${order.order.status}`);
        stats.total++;
        stats.success++;
      } catch (error) {
        console.log(`   ❌ Order failed: ${error.response?.data?.error?.message || error.message}`);
        stats.total++;
        stats.errors++;
      }
      await delay(300);
    }
    console.log('');

    await delay(500);

    // 6. Retrieve orders
    console.log('📄 Retrieving user orders...');
    for (let userId = 1; userId <= 3; userId++) {
      const userOrders = await scenarios.getUserOrders(userId);
      console.log(`   ✅ User ${userId}: ${userOrders.count} orders`);
      stats.total++;
      stats.success++;
      await delay(200);
    }
    console.log('');

    await delay(500);

    // 7. Test error scenarios
    console.log('⚠️  Testing error scenarios...');

    // Invalid product
    console.log('   → Invalid product ID...');
    const invalidProduct = await scenarios.getInvalidProduct();
    console.log(`   ❌ Expected error: ${invalidProduct.error?.error?.code}`);
    stats.total++;
    stats.errors++;

    await delay(300);

    // Insufficient inventory
    console.log('   → Insufficient inventory...');
    const insufficientInventory = await scenarios.createOrderInsufficientInventory();
    console.log(`   ❌ Expected error: ${insufficientInventory.error?.error?.code}`);
    stats.total++;
    stats.errors++;

    await delay(300);

    // Multiple orders to trigger payment failures
    console.log('   → Creating multiple orders (some may fail due to payment)...');
    for (let i = 0; i < 5; i++) {
      const result = await scenarios.createOrderInvalidPayment();
      if (result.error) {
        console.log(`   ❌ Payment failed: ${result.error?.error?.message}`);
        stats.errors++;
      } else {
        console.log(`   ✅ Order ${result.order.id} succeeded`);
        stats.success++;
      }
      stats.total++;
      await delay(200);
    }
    console.log('');

    // 8. Concurrent requests
    console.log('🚀 Running concurrent requests...');
    const concurrentRequests = [];
    for (let i = 1; i <= 10; i++) {
      concurrentRequests.push(scenarios.getProductById(i % 10 + 1));
    }
    await Promise.all(concurrentRequests);
    console.log(`   ✅ Completed 10 concurrent product fetches\n`);
    stats.total += 10;
    stats.success += 10;

  } catch (error) {
    console.error('❌ Load test error:', error.message);
    stats.errors++;
  }

  // Print summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 Load Test Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`Total Requests:     ${stats.total}`);
  console.log(`Successful:         ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`);
  console.log(`Errors:             ${stats.errors} (${((stats.errors / stats.total) * 100).toFixed(1)}%)`);
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log('✨ Check your Sentry dashboard for traces and logs!');
  console.log('');
}

// Run the test
runLoadTest()
  .then(() => {
    console.log('✅ Load test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  });
