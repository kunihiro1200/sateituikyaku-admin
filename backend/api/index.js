// Vercel serverless function entry point
// This file imports the compiled Express app from dist/index.js

module.exports = require('../dist/index.js').default;
