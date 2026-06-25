const express = require('express');
const cookieParser = require('cookie-parser');
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

// Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ status: "error", message: "Internal Server Error" });
});

app.listen(PORT, () => {
  console.log(`Server executing cleanly on port ${PORT}`);
});