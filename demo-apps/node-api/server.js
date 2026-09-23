const express = require('express');
const cors = require('cors');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'node-api-gateway' });
});

// Normal checkout flow
app.post('/api/checkout', (req, res) => {
  const traceparent = req.headers['traceparent'] || '00-fake-trace-fake-span-01';
  
  // Simulate processing time
  setTimeout(() => {
    res.json({
      success: true,
      order_id: 'ord_' + Math.floor(Math.random() * 100000),
      amount: req.body.amount || 89.99,
      traceparent
    });
  }, 45);
});

// Injected slow query endpoint
app.get('/api/slow-query', (req, res) => {
  const traceparent = req.headers['traceparent'];
  // Forward to python-auth slow endpoint or simulate local bottleneck
  setTimeout(() => {
    res.json({
      status: 'slow_transaction_completed',
      latency_ms: 720,
      bottleneck: 'Postgres DB Index Lock',
      traceparent
    });
  }, 720);
});

// Injected error endpoint
app.post('/api/faulty-endpoint', (req, res) => {
  res.status(500).json({
    error: 'InternalServerError',
    message: 'Database connection pool exhausted on cluster-02',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`Demo Node API Gateway running on port ${PORT}`);
});
