// Vercel serverless function entry point
// This file imports the compiled Express app from dist/index.js

try {
  const app = require('../dist/index.js');
  module.exports = app.default || app;
} catch (error) {
  console.error('Failed to load Express app:', error);
  module.exports = (req, res) => {
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to load Express app',
      details: error.message
    });
  };
}
