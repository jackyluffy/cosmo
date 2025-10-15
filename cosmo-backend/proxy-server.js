const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Proxy to Cloud Run via gcloud proxy
app.use('/', createProxyMiddleware({
  target: 'http://127.0.0.1:8080',
  changeOrigin: true,
  logLevel: 'debug'
}));

const PORT = 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌉 Proxy bridge running on http://0.0.0.0:${PORT}`);
  console.log(`📱 iOS Simulator can access via http://192.168.1.68:${PORT}`);
});