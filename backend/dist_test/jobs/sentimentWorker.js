"use strict";
/**
 * Sentiment Analysis Job Worker
 *
 * Background worker for processing sentiment analysis jobs using Bull queue.
 * Handles:
 * - Analyzing sentiment of transcribed text
 * - Detecting keywords based on configured rules
 * - Executing auto-actions based on detected keywords
 * - Retry logic for failed jobs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sentimentQueue = void 0;
exports.addSentimentJob = addSentimentJob;
exports.getSentimentJobStatus = getSentimentJobStatus;
exports.retrySentimentJob = retrySentimentJob;
exports.cleanupOldSentimentJobs = cleanupOldSentimentJobs;
exports.getSentimentQueueStats = getSentimentQueueStats;
exports.shutdownSentimentWorker = shutdownSentimentWorker;
const bull_1 = __importDefault(require("bull"));
const SentimentAnalysisService_1 = require("../services/SentimentAnalysisService");
const supabase_1 = require("../config/supabase");
// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'sentiment-jobs';
// Create Bull queue
exports.sentimentQueue = new bull_1.default(QUEUE_NAME, REDIS_URL, {
    defaultJobOptions: {
        attempts: 3, // Retry up to 3 times
        backoff: {
            type: 'exponential',
            delay: 30000, // Start with 30 seconds delay
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500, // Keep last 500 failed jobs
    },
});
// Initialize service
const sentimentAnalysisService = new SentimentAnalysisService_1.SentimentAnalysisService();
/**
 * Process sentiment analysis job
 */
exports.sentimentQueue.process(async (job) => {
    const { transcriptionId, transcriptionText } = job.data;
    console.log(`[SentimentWorker] Processing job ${job.id} for transcription ${transcriptionId}`);
    try {
        // Step 1: Analyze sentiment
        console.log(`[SentimentWorker] Analyzing sentiment for transcription ${transcriptionId}`);
        await job.progress(25);
        const result = await sentimentAnalysisService.analyzeSentiment({
            transcriptionId,
            text: transcriptionText,
            detectKeywords: true,
            executeAutoActions: true,
        });
        await job.progress(100);
        console.log(`[SentimentWorker] Successfully completed job ${job.id} for transcription ${transcriptionId}`);
        return {
            transcriptionId,
            sentiment: result.sentiment,
            detectedKeywords: result.detectedKeywords,
            success: true,
        };
    }
    catch (error) {
        console.error(`[SentimentWorker] Job ${job.id} failed:`, error);
        // Update transcription status to indicate sentiment analysis failed
        try {
            await supabase_1.supabase
                .from('call_transcriptions')
                .update({
                updated_at: new Date().toISOString(),
            })
                .eq('id', transcriptionId);
        }
        catch (updateError) {
            console.error(`[SentimentWorker] Failed to update transcription:`, updateError);
        }
        return {
            transcriptionId,
            sentiment: '',
            detectedKeywords: [],
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
});
/**
 * Event handlers
 */
// Job completed successfully
exports.sentimentQueue.on('completed', (job, result) => {
    console.log(`[SentimentWorker] Job ${job.id} completed successfully:`, result);
});
// Job failed after all retries
exports.sentimentQueue.on('failed', (job, error) => {
    console.error(`[SentimentWorker] Job ${job.id} failed after all retries:`, error.message);
});
// Job is active (started processing)
exports.sentimentQueue.on('active', (job) => {
    console.log(`[SentimentWorker] Job ${job.id} started processing for transcription ${job.data.transcriptionId}`);
});
// Job is waiting in queue
exports.sentimentQueue.on('waiting', (jobId) => {
    console.log(`[SentimentWorker] Job ${jobId} is waiting in queue`);
});
// Job progress updated
exports.sentimentQueue.on('progress', (job, progress) => {
    console.log(`[SentimentWorker] Job ${job.id} progress: ${progress}%`);
});
/**
 * Helper function to add a sentiment analysis job to the queue
 */
async function addSentimentJob(transcriptionId, transcriptionText, callLogId) {
    console.log(`[SentimentWorker] Adding sentiment job for transcription ${transcriptionId}`);
    const job = await exports.sentimentQueue.add({
        transcriptionId,
        transcriptionText,
        callLogId,
    }, {
        jobId: `sentiment-${transcriptionId}-${Date.now()}`,
    });
    console.log(`[SentimentWorker] Job ${job.id} added to queue`);
    return job;
}
/**
 * Get job status
 */
async function getSentimentJobStatus(jobId) {
    const job = await exports.sentimentQueue.getJob(jobId);
    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }
    const state = await job.getState();
    const progress = job.progress() || 0;
    let result;
    let error;
    if (state === 'completed') {
        result = job.returnvalue;
    }
    else if (state === 'failed') {
        error = job.failedReason;
    }
    return {
        state,
        progress,
        result,
        error,
    };
}
/**
 * Retry a failed job
 */
async function retrySentimentJob(jobId) {
    const job = await exports.sentimentQueue.getJob(jobId);
    if (!job) {
        throw new Error(`Job ${jobId} not found`);
    }
    await job.retry();
    console.log(`[SentimentWorker] Job ${jobId} retried`);
}
/**
 * Clean up old jobs
 */
async function cleanupOldSentimentJobs(olderThanMs = 7 * 24 * 60 * 60 * 1000) {
    console.log(`[SentimentWorker] Cleaning up jobs older than ${olderThanMs}ms`);
    await exports.sentimentQueue.clean(olderThanMs, 'completed');
    await exports.sentimentQueue.clean(olderThanMs, 'failed');
    console.log(`[SentimentWorker] Cleanup completed`);
}
/**
 * Get queue statistics
 */
async function getSentimentQueueStats() {
    const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        exports.sentimentQueue.getWaitingCount(),
        exports.sentimentQueue.getActiveCount(),
        exports.sentimentQueue.getCompletedCount(),
        exports.sentimentQueue.getFailedCount(),
        exports.sentimentQueue.getDelayedCount(),
        exports.sentimentQueue.getPausedCount(),
    ]);
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
    };
}
/**
 * Graceful shutdown
 */
async function shutdownSentimentWorker() {
    console.log('[SentimentWorker] Shutting down gracefully...');
    await exports.sentimentQueue.close();
    console.log('[SentimentWorker] Shutdown complete');
}
// Handle process termination
process.on('SIGTERM', async () => {
    await shutdownSentimentWorker();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await shutdownSentimentWorker();
    process.exit(0);
});
console.log('[SentimentWorker] Worker initialized and ready to process jobs');
