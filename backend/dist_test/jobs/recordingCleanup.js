"use strict";
/**
 * Recording Cleanup Job Worker
 *
 * Background worker for cleaning up old call recordings using Bull queue.
 * Handles:
 * - Detecting old recordings based on retention policy
 * - Archiving recordings to Glacier storage (optional)
 * - Deleting recordings from S3
 * - Updating database records
 * - Scheduled execution via cron
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordingCleanupQueue = void 0;
exports.addRecordingCleanupJob = addRecordingCleanupJob;
exports.scheduleRecordingCleanup = scheduleRecordingCleanup;
exports.removeScheduledCleanup = removeScheduledCleanup;
exports.getCleanupJobStatus = getCleanupJobStatus;
exports.getCleanupQueueStats = getCleanupQueueStats;
exports.runCleanupNow = runCleanupNow;
exports.shutdownRecordingCleanupWorker = shutdownRecordingCleanupWorker;
const bull_1 = __importDefault(require("bull"));
const RecordingService_1 = require("../services/RecordingService");
const supabase_1 = require("../config/supabase");
const logger_1 = __importDefault(require("../utils/logger"));
// Queue configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const QUEUE_NAME = 'recording-cleanup-jobs';
// Default configuration
const DEFAULT_RETENTION_DAYS = 90; // 90日間保持
const DEFAULT_ARCHIVE_DAYS = 30; // 30日後にアーカイブ
const DEFAULT_BATCH_SIZE = 100; // 一度に処理する件数
const ARCHIVE_BUCKET = process.env.S3_ARCHIVE_BUCKET || 'seller-system-call-recordings-archive';
// Create Bull queue
exports.recordingCleanupQueue = new bull_1.default(QUEUE_NAME, REDIS_URL, {
    defaultJobOptions: {
        attempts: 2, // Retry once on failure
        backoff: {
            type: 'exponential',
            delay: 300000, // 5 minutes
        },
        removeOnComplete: 50,
        removeOnFail: 100,
    },
});
// Initialize services
const recordingService = new RecordingService_1.RecordingService();
/**
 * Process recording cleanup job
 */
exports.recordingCleanupQueue.process(async (job) => {
    const { retentionDays = DEFAULT_RETENTION_DAYS, archiveDays = DEFAULT_ARCHIVE_DAYS, dryRun = false, batchSize = DEFAULT_BATCH_SIZE, } = job.data;
    logger_1.default.info(`[RecordingCleanup] Starting cleanup job ${job.id}`, {
        retentionDays,
        archiveDays,
        dryRun,
        batchSize,
    });
    const result = {
        success: true,
        recordingsProcessed: 0,
        recordingsArchived: 0,
        recordingsDeleted: 0,
        errors: [],
        dryRun,
    };
    try {
        // Calculate cutoff dates
        const deleteCutoffDate = new Date();
        deleteCutoffDate.setDate(deleteCutoffDate.getDate() - retentionDays);
        const archiveCutoffDate = new Date();
        archiveCutoffDate.setDate(archiveCutoffDate.getDate() - archiveDays);
        logger_1.default.info(`[RecordingCleanup] Cutoff dates calculated`, {
            deleteCutoff: deleteCutoffDate.toISOString(),
            archiveCutoff: archiveCutoffDate.toISOString(),
        });
        // Step 1: Find recordings to delete (older than retention period)
        const { data: recordingsToDelete, error: deleteQueryError } = await supabase_1.supabase
            .from('call_recordings')
            .select('id, call_log_id, s3_bucket, s3_key, created_at')
            .lt('created_at', deleteCutoffDate.toISOString())
            .limit(batchSize);
        if (deleteQueryError) {
            throw deleteQueryError;
        }
        logger_1.default.info(`[RecordingCleanup] Found ${recordingsToDelete?.length || 0} recordings to delete`);
        // Step 2: Find recordings to archive (older than archive period but newer than retention period)
        const { data: recordingsToArchive, error: archiveQueryError } = await supabase_1.supabase
            .from('call_recordings')
            .select('id, call_log_id, s3_bucket, s3_key, created_at')
            .lt('created_at', archiveCutoffDate.toISOString())
            .gte('created_at', deleteCutoffDate.toISOString())
            .is('s3_bucket', ARCHIVE_BUCKET) // Only archive if not already archived
            .limit(batchSize);
        if (archiveQueryError) {
            throw archiveQueryError;
        }
        logger_1.default.info(`[RecordingCleanup] Found ${recordingsToArchive?.length || 0} recordings to archive`);
        await job.progress(10);
        // Step 3: Archive recordings
        if (recordingsToArchive && recordingsToArchive.length > 0) {
            for (let i = 0; i < recordingsToArchive.length; i++) {
                const recording = recordingsToArchive[i];
                result.recordingsProcessed++;
                try {
                    if (!dryRun) {
                        await recordingService.archiveRecording(recording.id, ARCHIVE_BUCKET);
                    }
                    result.recordingsArchived++;
                    logger_1.default.info(`[RecordingCleanup] ${dryRun ? '[DRY RUN] ' : ''}Archived recording ${recording.id}`);
                }
                catch (error) {
                    const errorMsg = `Failed to archive recording ${recording.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    logger_1.default.error(`[RecordingCleanup] ${errorMsg}`, { error, recording });
                    result.errors.push(errorMsg);
                }
                // Update progress (10% to 50% for archiving)
                const progress = 10 + Math.floor((i / recordingsToArchive.length) * 40);
                await job.progress(progress);
            }
        }
        await job.progress(50);
        // Step 4: Delete old recordings
        if (recordingsToDelete && recordingsToDelete.length > 0) {
            for (let i = 0; i < recordingsToDelete.length; i++) {
                const recording = recordingsToDelete[i];
                result.recordingsProcessed++;
                try {
                    if (!dryRun) {
                        await recordingService.deleteRecording(recording.id);
                    }
                    result.recordingsDeleted++;
                    logger_1.default.info(`[RecordingCleanup] ${dryRun ? '[DRY RUN] ' : ''}Deleted recording ${recording.id}`);
                }
                catch (error) {
                    const errorMsg = `Failed to delete recording ${recording.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
                    logger_1.default.error(`[RecordingCleanup] ${errorMsg}`, { error, recording });
                    result.errors.push(errorMsg);
                }
                // Update progress (50% to 90% for deletion)
                const progress = 50 + Math.floor((i / recordingsToDelete.length) * 40);
                await job.progress(progress);
            }
        }
        await job.progress(100);
        logger_1.default.info(`[RecordingCleanup] Job ${job.id} completed successfully`, result);
        return result;
    }
    catch (error) {
        logger_1.default.error(`[RecordingCleanup] Job ${job.id} failed:`, error);
        result.success = false;
        result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        return result;
    }
});
/**
 * Event handlers
 */
// Job completed successfully
exports.recordingCleanupQueue.on('completed', (job, result) => {
    logger_1.default.info(`[RecordingCleanup] Job ${job.id} completed`, {
        processed: result.recordingsProcessed,
        archived: result.recordingsArchived,
        deleted: result.recordingsDeleted,
        errors: result.errors.length,
    });
});
// Job failed after all retries
exports.recordingCleanupQueue.on('failed', (job, error) => {
    logger_1.default.error(`[RecordingCleanup] Job ${job.id} failed after all retries:`, { error: error.message });
});
// Job is active (started processing)
exports.recordingCleanupQueue.on('active', (job) => {
    logger_1.default.info(`[RecordingCleanup] Job ${job.id} started processing`);
});
/**
 * Helper function to add a cleanup job to the queue
 */
async function addRecordingCleanupJob(options = {}) {
    logger_1.default.info('[RecordingCleanup] Adding cleanup job to queue', options);
    const job = await exports.recordingCleanupQueue.add({
        retentionDays: options.retentionDays || DEFAULT_RETENTION_DAYS,
        archiveDays: options.archiveDays || DEFAULT_ARCHIVE_DAYS,
        dryRun: options.dryRun || false,
        batchSize: options.batchSize || DEFAULT_BATCH_SIZE,
    }, {
        jobId: `cleanup-${Date.now()}`,
    });
    logger_1.default.info(`[RecordingCleanup] Job ${job.id} added to queue`);
    return job;
}
/**
 * Schedule recurring cleanup job (cron)
 * Default: Run daily at 2:00 AM
 */
async function scheduleRecordingCleanup(cronExpression = '0 2 * * *', // Daily at 2:00 AM
options = {}) {
    logger_1.default.info('[RecordingCleanup] Scheduling recurring cleanup job', {
        cron: cronExpression,
        options,
    });
    const job = await exports.recordingCleanupQueue.add({
        retentionDays: options.retentionDays || DEFAULT_RETENTION_DAYS,
        archiveDays: options.archiveDays || DEFAULT_ARCHIVE_DAYS,
        dryRun: options.dryRun || false,
        batchSize: options.batchSize || DEFAULT_BATCH_SIZE,
    }, {
        jobId: 'scheduled-cleanup',
        repeat: {
            cron: cronExpression,
            tz: 'Asia/Tokyo',
        },
    });
    logger_1.default.info(`[RecordingCleanup] Scheduled job created with ID: ${job.id}`);
    return job.id;
}
/**
 * Remove scheduled cleanup job
 */
async function removeScheduledCleanup() {
    logger_1.default.info('[RecordingCleanup] Removing scheduled cleanup job');
    const repeatableJobs = await exports.recordingCleanupQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
        if (job.id === 'scheduled-cleanup') {
            await exports.recordingCleanupQueue.removeRepeatableByKey(job.key);
            logger_1.default.info('[RecordingCleanup] Scheduled job removed');
        }
    }
}
/**
 * Get job status
 */
async function getCleanupJobStatus(jobId) {
    const job = await exports.recordingCleanupQueue.getJob(jobId);
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
 * Get queue statistics
 */
async function getCleanupQueueStats() {
    const [waiting, active, completed, failed, delayed, paused, repeatableJobs] = await Promise.all([
        exports.recordingCleanupQueue.getWaitingCount(),
        exports.recordingCleanupQueue.getActiveCount(),
        exports.recordingCleanupQueue.getCompletedCount(),
        exports.recordingCleanupQueue.getFailedCount(),
        exports.recordingCleanupQueue.getDelayedCount(),
        exports.recordingCleanupQueue.getPausedCount(),
        exports.recordingCleanupQueue.getRepeatableJobs(),
    ]);
    return {
        waiting,
        active,
        completed,
        failed,
        delayed,
        paused,
        repeatable: repeatableJobs.length,
    };
}
/**
 * Run cleanup immediately (for testing or manual execution)
 */
async function runCleanupNow(options = {}) {
    logger_1.default.info('[RecordingCleanup] Running cleanup immediately', options);
    const job = await addRecordingCleanupJob(options);
    // Wait for job to complete
    return new Promise((resolve, reject) => {
        job.finished()
            .then((result) => {
            logger_1.default.info('[RecordingCleanup] Immediate cleanup completed', result);
            resolve(result);
        })
            .catch((error) => {
            logger_1.default.error('[RecordingCleanup] Immediate cleanup failed', error);
            reject(error);
        });
    });
}
/**
 * Graceful shutdown
 */
async function shutdownRecordingCleanupWorker() {
    logger_1.default.info('[RecordingCleanup] Shutting down gracefully...');
    await exports.recordingCleanupQueue.close();
    logger_1.default.info('[RecordingCleanup] Shutdown complete');
}
// Handle process termination
process.on('SIGTERM', async () => {
    await shutdownRecordingCleanupWorker();
    process.exit(0);
});
process.on('SIGINT', async () => {
    await shutdownRecordingCleanupWorker();
    process.exit(0);
});
logger_1.default.info('[RecordingCleanup] Worker initialized and ready to process jobs');
