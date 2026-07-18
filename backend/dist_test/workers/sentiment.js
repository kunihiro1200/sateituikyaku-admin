#!/usr/bin/env node
"use strict";
/**
 * Sentiment Analysis Worker Process
 *
 * Standalone worker process for processing sentiment analysis jobs.
 * Run this as a separate process from the main API server.
 *
 * Usage:
 *   npm run worker:sentiment
 *   or
 *   ts-node src/workers/sentiment.ts
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
require("../jobs/sentimentWorker");
const logger_1 = __importDefault(require("../utils/logger"));
// Load environment variables
dotenv_1.default.config();
console.log('='.repeat(60));
console.log('Sentiment Analysis Worker Process');
console.log('='.repeat(60));
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Redis URL: ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
console.log(`AWS Region: ${process.env.AWS_REGION || 'ap-northeast-1'}`);
console.log(`AWS Mock Mode: ${process.env.USE_AWS_MOCK || 'auto-detect'}`);
console.log('='.repeat(60));
console.log('Worker is now listening for sentiment analysis jobs...');
console.log('Press Ctrl+C to stop');
console.log('='.repeat(60));
// Keep the process alive
process.stdin.resume();
// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger_1.default.info('SIGTERM received, shutting down gracefully...');
    process.exit(0);
});
process.on('SIGINT', () => {
    logger_1.default.info('SIGINT received, shutting down gracefully...');
    process.exit(0);
});
// Handle uncaught errors
process.on('uncaughtException', (error) => {
    logger_1.default.error('Uncaught exception in worker process:', error);
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error('Unhandled rejection in worker process:', { reason, promise });
    process.exit(1);
});
