const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 7002; // Binds to Render's port dynamically
const apiRouter = require('./routes');

// Standard Middlewares
app.use(express.json());
app.use(cookieParser());

// 1. Root-level Health Check (Put this BEFORE app.use('/rest'))
app.get('/health', (req, res) => {
  res.status(200).json({ status: "healthy", timestamp: new Date() });
});

// 2. Mount API specification prefix
app.use('/rest', apiRouter);

// 3. Serve Frontend static files
app.use(express.static(path.join(__dirname, '../Frontend')));

// 4. Client SPA route fallback - serve index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server executing cleanly on port ${PORT}`);
});