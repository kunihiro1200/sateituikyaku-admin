"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const RateLimiter_1 = require("../services/RateLimiter");
const supabase_js_1 = require("@supabase/supabase-js");
const SyncLogger_1 = require("../services/SyncLogger");
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
const SpreadsheetSyncService_1 = require("../services/SpreadsheetSyncService");
const ManualSyncService_1 = require("../services/ManualSyncService");
const RollbackService_1 = require("../services/RollbackService");
const router = express_1.default.Router();
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
// Google Sheets設定（サービスアカウント認証を使用）
const sheetsConfig = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
};
// ManualSyncServiceのインスタンス（シングルトン）
let manualSyncService = null;
async function getManualSyncService() {
    if (!manualSyncService) {
        const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient(sheetsConfig);
        await sheetsClient.authenticate();
        const syncService = new SpreadsheetSyncService_1.SpreadsheetSyncService(sheetsClient, supabase);
        const logger = new SyncLogger_1.SyncLogger(supabase);
        manualSyncService = new ManualSyncService_1.ManualSyncService(syncService, logger, supabase);
    }
    return manualSyncService;
}
// RollbackServiceのインスタンス（シングルトン）
let rollbackService = null;
function getRollbackService() {
    if (!rollbackService) {
        const logger = new SyncLogger_1.SyncLogger(supabase);
        rollbackService = new RollbackService_1.RollbackService(supabase, logger);
    }
    return rollbackService;
}
/**
 * GET /api/sync/rate-limit
 * レート制限の使用状況を取得
 */
router.get('/rate-limit', async (req, res) => {
    try {
        const usage = RateLimiter_1.sheetsRateLimiter.getUsage();
        const isNearLimit = RateLimiter_1.sheetsRateLimiter.isNearLimit(0.8);
        res.json({
            success: true,
            data: {
                ...usage,
                isNearLimit,
                warning: isNearLimit ? 'Rate limit is approaching 80% usage' : null,
            },
        });
    }
    catch (error) {
        console.error('Rate limit check error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/freshness
 * キャッシュの鮮度ステータスを取得
 */
router.get('/freshness', async (req, res) => {
    try {
        const { cacheManager } = await Promise.resolve().then(() => __importStar(require('../services/CacheManager')));
        const cacheKey = 'sellers:list:all';
        const thresholdMinutes = parseInt(req.query.threshold) || 5;
        const freshnessStatus = await cacheManager.checkFreshness(cacheKey, thresholdMinutes);
        res.json({
            success: true,
            data: freshnessStatus,
        });
    }
    catch (error) {
        console.error('Freshness check error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/status
 * 同期ステータスを取得（強化版）
 */
router.get('/status', async (req, res) => {
    try {
        const { getSyncHealthChecker } = await Promise.resolve().then(() => __importStar(require('../services/SyncHealthChecker')));
        const { getEnhancedPeriodicSyncManager, isAutoSyncEnabled } = await Promise.resolve().then(() => __importStar(require('../services/EnhancedAutoSyncService')));
        const logger = new SyncLogger_1.SyncLogger(supabase);
        // ヘルスステータスを取得
        const healthChecker = getSyncHealthChecker();
        const health = await healthChecker.getHealthStatus();
        // 定期同期マネージャーの状態を取得
        const periodicManager = getEnhancedPeriodicSyncManager();
        // 最新の同期ログを取得
        const recentLogs = await logger.getSyncHistory(10);
        // 統計情報を取得
        const stats = await logger.getSyncStats(7);
        // レート制限情報を取得
        const rateLimitUsage = RateLimiter_1.sheetsRateLimiter.getUsage();
        res.json({
            success: true,
            data: {
                health,
                isRunning: periodicManager.isActive(),
                config: {
                    enabled: isAutoSyncEnabled(),
                    intervalMinutes: periodicManager.getIntervalMinutes(),
                },
                recentLogs,
                stats,
                rateLimitUsage,
            },
        });
    }
    catch (error) {
        console.error('Sync status error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/history
 * 同期履歴を取得（強化版）
 */
router.get('/history', async (req, res) => {
    try {
        const { getSyncLogService } = await Promise.resolve().then(() => __importStar(require('../services/SyncLogService')));
        const syncLogService = getSyncLogService();
        const limit = parseInt(req.query.limit) || 100;
        // 強化版ログサービスから履歴を取得
        const entries = await syncLogService.getHistory(limit);
        res.json({
            success: true,
            data: {
                entries,
                total: entries.length,
            },
        });
    }
    catch (error) {
        console.error('Sync history error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/errors
 * エラーログを取得
 */
router.get('/errors', async (req, res) => {
    try {
        const logger = new SyncLogger_1.SyncLogger(supabase);
        const limit = parseInt(req.query.limit) || 100;
        const errorType = req.query.errorType;
        const errors = await logger.getErrorLogs(limit, {
            errorType,
        });
        res.json({
            success: true,
            data: errors,
        });
    }
    catch (error) {
        console.error('Error logs retrieval error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/rate-limit/reset
 * レート制限をリセット（管理者用）
 */
router.post('/rate-limit/reset', async (req, res) => {
    try {
        RateLimiter_1.sheetsRateLimiter.reset();
        res.json({
            success: true,
            message: 'Rate limiter reset successfully',
        });
    }
    catch (error) {
        console.error('Rate limit reset error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/manual
 * 手動同期を実行（スプレッドシート → データベース）
 */
router.post('/manual', async (req, res) => {
    const { ErrorHandler } = await Promise.resolve().then(() => __importStar(require('../services/ErrorHandler')));
    const errorHandler = new ErrorHandler(supabase);
    try {
        const { cacheManager } = await Promise.resolve().then(() => __importStar(require('../services/CacheManager')));
        // キャッシュから現在のデータを取得
        const cacheKey = 'sellers:list:all';
        const cachedData = await cacheManager.get(cacheKey);
        // スプレッドシートから最新データを取得（リトライ機能付き）
        const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient(sheetsConfig);
        await sheetsClient.authenticate();
        const syncService = new SpreadsheetSyncService_1.SpreadsheetSyncService(sheetsClient, supabase);
        const latestData = await errorHandler.withRetry(() => syncService.fetchLatestData(), {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 5000,
            backoffMultiplier: 2,
        }, { operation: 'fetchLatestData', endpoint: '/api/sync/manual' });
        // 差分を計算
        const diff = await syncService.compareWithCache(cachedData?.data || []);
        // 差分を適用（リトライ機能付き）
        const result = await errorHandler.withRetry(() => syncService.applyChanges(diff), {
            maxRetries: 2,
            initialDelayMs: 500,
            maxDelayMs: 2000,
            backoffMultiplier: 2,
        }, { operation: 'applyChanges', recordCount: diff.added.length + diff.updated.length });
        // キャッシュを更新
        await cacheManager.set(cacheKey, latestData, 300); // 5分
        res.json({
            success: result.success,
            message: 'Manual sync completed',
            data: {
                recordsAdded: result.recordsAdded,
                recordsUpdated: result.recordsUpdated,
                recordsDeleted: result.recordsDeleted,
                errors: result.errors,
            },
        });
    }
    catch (error) {
        // エラーをログに記録
        await errorHandler.logError(error, {
            operation: 'manualSync',
            endpoint: '/api/sync/manual',
        });
        // ユーザーフレンドリーなエラーメッセージを返す
        const userMessage = errorHandler.getUserFriendlyMessage(error);
        const isRecoverable = errorHandler.isRecoverable(error);
        res.status(500).json({
            success: false,
            error: userMessage,
            details: error.message,
            recoverable: isRecoverable,
        });
    }
});
/**
 * POST /api/sync/manual/legacy
 * 手動同期を実行（旧バージョン - データベース → スプレッドシート）
 */
router.post('/manual/legacy', async (req, res) => {
    try {
        const mode = req.body.mode || 'incremental';
        if (mode !== 'full' && mode !== 'incremental') {
            return res.status(400).json({
                success: false,
                error: 'Invalid mode. Must be "full" or "incremental"',
            });
        }
        const service = await getManualSyncService();
        // 既に実行中かチェック
        if (service.isRunningSync()) {
            return res.status(409).json({
                success: false,
                error: 'Sync is already running',
                progress: service.getCurrentProgress(),
            });
        }
        // 非同期で同期を実行
        service.executeManualSync(mode).catch(error => {
            console.error('Manual sync error:', error);
        });
        res.json({
            success: true,
            message: 'Manual sync started',
            mode,
        });
    }
    catch (error) {
        console.error('Manual sync start error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/manual/progress
 * 手動同期の進行状況を取得
 */
router.get('/manual/progress', async (req, res) => {
    try {
        const service = await getManualSyncService();
        const progress = service.getCurrentProgress();
        const isRunning = service.isRunningSync();
        res.json({
            success: true,
            data: {
                isRunning,
                progress,
            },
        });
    }
    catch (error) {
        console.error('Manual sync progress error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/snapshot
 * スナップショットを作成
 */
router.post('/snapshot', async (req, res) => {
    try {
        const { description } = req.body;
        const service = getRollbackService();
        const snapshot = await service.createSnapshot(description);
        res.json({
            success: true,
            message: 'Snapshot created successfully',
            data: snapshot,
        });
    }
    catch (error) {
        console.error('Snapshot creation error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/snapshots
 * スナップショット一覧を取得
 */
router.get('/snapshots', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const service = getRollbackService();
        const snapshots = await service.listSnapshots(limit);
        res.json({
            success: true,
            data: snapshots,
        });
    }
    catch (error) {
        console.error('Snapshots retrieval error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/rollback
 * スナップショットからロールバック
 */
router.post('/rollback', async (req, res) => {
    try {
        const { snapshotId } = req.body;
        if (!snapshotId) {
            return res.status(400).json({
                success: false,
                error: 'snapshotId is required',
            });
        }
        const service = getRollbackService();
        const result = await service.rollback(snapshotId);
        if (result.success) {
            res.json({
                success: true,
                message: 'Rollback completed successfully',
                data: result,
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: result.error,
                data: result,
            });
        }
    }
    catch (error) {
        console.error('Rollback error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * DELETE /api/sync/snapshot/:id
 * スナップショットを削除
 */
router.delete('/snapshot/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const service = getRollbackService();
        const success = await service.deleteSnapshot(id);
        if (success) {
            res.json({
                success: true,
                message: 'Snapshot deleted successfully',
            });
        }
        else {
            res.status(500).json({
                success: false,
                error: 'Failed to delete snapshot',
            });
        }
    }
    catch (error) {
        console.error('Snapshot deletion error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/auto
 * スプレッドシートから新規売主を自動同期（1回のみ実行）- 旧バージョン
 */
router.post('/auto', async (req, res) => {
    try {
        const { getAutoSyncService } = await Promise.resolve().then(() => __importStar(require('../services/AutoSyncService')));
        const autoSyncService = getAutoSyncService();
        await autoSyncService.initialize();
        const result = await autoSyncService.syncNewSellers();
        res.json({
            success: result.success,
            message: result.success
                ? `Auto-sync completed: ${result.newSellersCount} new sellers synced`
                : 'Auto-sync completed with errors',
            data: result,
        });
    }
    catch (error) {
        console.error('Auto-sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/trigger
 * 手動で強化版フル同期をトリガー（全件比較方式）
 * GitHub Actions等の外部からの呼び出し用（CRON_SECRET認証）
 *
 * クエリパラメータ:
 *   ?async=true  → 即座に202を返し、バックグラウンドで同期実行（GAS用）
 */
router.post('/trigger', async (req, res) => {
    // CRON_SECRET認証チェック
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.error('[Sync Trigger] Unauthorized access attempt');
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    // sellersOnly=true の場合は売主同期のみ（Phase 1-3）を実行してタイムアウトを回避
    // deletionOnly=true の場合は削除同期のみ（Phase 3）を実行
    // additionOnly=true の場合は追加同期のみ（Phase 1）を実行（GASのPhase 2はSupabase直接更新のため）
    // buyerAddition=true の場合は買主追加同期のみを実行（スプシにあってDBにない買主を追加）
    // buyerDeletion=true の場合は買主削除同期のみを実行（スプシにない買主をDBから物理削除）
    // GASのタイムアウトは6分あるので、同期処理が完了するまで待つ
    const sellersOnly = req.query.sellersOnly === 'true';
    const deletionOnly = req.query.deletionOnly === 'true';
    const additionOnly = req.query.additionOnly === 'true';
    const buyerAddition = req.query.buyerAddition === 'true';
    const buyerDeletion = req.query.buyerDeletion === 'true';
    try {
        const { getEnhancedAutoSyncService } = await Promise.resolve().then(() => __importStar(require('../services/EnhancedAutoSyncService')));
        const { getSyncHealthChecker } = await Promise.resolve().then(() => __importStar(require('../services/SyncHealthChecker')));
        const syncService = getEnhancedAutoSyncService();
        await syncService.initialize();
        if (buyerAddition && additionOnly) {
            // 買主追加同期のみ（スプシにあってDBにない買主を追加）
            console.log('➕ Buyer addition-only sync triggered');
            syncService.clearBuyerSpreadsheetCache();
            const missingBuyers = await syncService.detectMissingBuyers();
            let added = 0;
            const errors = [];
            if (missingBuyers.length > 0) {
                const addResult = await syncService.syncMissingBuyers(missingBuyers);
                added = addResult.newSellersCount;
                errors.push(...addResult.errors);
            }
            const healthChecker = getSyncHealthChecker();
            await healthChecker.checkAndUpdateHealth();
            return res.json({
                success: errors.length === 0,
                message: `Buyer addition sync completed: ${added} added`,
                data: { added, errors: errors.length },
            });
        }
        else if (buyerDeletion && deletionOnly) {
            // 買主削除同期のみ（スプシにない買主をDBから物理削除）
            console.log('🗑️  Buyer deletion-only sync triggered');
            syncService.clearBuyerSpreadsheetCache();
            const deletedBuyers = await syncService.detectDeletedBuyers();
            let deleted = 0;
            const errors = [];
            if (deletedBuyers.length > 0) {
                const deletionResult = await syncService.syncDeletedBuyers(deletedBuyers);
                deleted = deletionResult.successfullyDeleted;
                errors.push(...deletionResult.errors);
            }
            const healthChecker = getSyncHealthChecker();
            await healthChecker.checkAndUpdateHealth();
            return res.json({
                success: errors.length === 0,
                message: `Buyer deletion sync completed: ${deleted} deleted`,
                data: { deleted, detected: deletedBuyers.length, errors: errors.length },
            });
        }
        else if (additionOnly) {
            // 追加同期のみ（Phase 1）- GASのPhase 2はSupabase直接更新のため不要
            console.log('➕ Addition-only sync triggered');
            syncService.clearSpreadsheetCache();
            const missingSellers = await syncService.detectMissingSellers();
            let added = 0;
            const errors = [];
            if (missingSellers.length > 0) {
                const addResult = await syncService.syncMissingSellers(missingSellers);
                added = addResult.newSellersCount;
                errors.push(...addResult.errors);
            }
            const healthChecker = getSyncHealthChecker();
            await healthChecker.checkAndUpdateHealth();
            return res.json({
                success: errors.length === 0,
                message: `Addition-only sync completed: ${added} added`,
                data: { added, errors: errors.length },
            });
        }
        else if (deletionOnly) {
            // 削除同期のみ（Phase 3）
            console.log('🗑️  Deletion-only sync triggered');
            syncService.clearSpreadsheetCache();
            const deletedSellers = await syncService.detectDeletedSellers();
            let deleted = 0;
            const errors = [];
            if (deletedSellers.length > 0) {
                const deletionResult = await syncService.syncDeletedSellers(deletedSellers);
                deleted = deletionResult.successfullyDeleted;
                errors.push(...deletionResult.errors);
            }
            const healthChecker = getSyncHealthChecker();
            await healthChecker.checkAndUpdateHealth();
            return res.json({
                success: errors.length === 0,
                message: `Deletion-only sync completed: ${deleted} deleted`,
                data: { deleted, errors: errors.length },
            });
        }
        else if (sellersOnly) {
            // 売主のみ同期（Phase 1-3）
            const result = await syncService.runSellersOnlySync();
            // ヘルスチェックを更新
            const healthChecker = getSyncHealthChecker();
            await healthChecker.checkAndUpdateHealth();
            res.json({
                success: result.success,
                message: result.success
                    ? `Sellers-only sync completed: ${result.added} added, ${result.updated} updated, ${result.deleted} deleted`
                    : 'Sellers-only sync failed',
                data: {
                    added: result.added,
                    updated: result.updated,
                    deleted: result.deleted,
                    errors: result.errors.length,
                    durationMs: result.durationMs,
                },
            });
        }
        else {
            // フル同期（全フェーズ）
            const result = await syncService.runFullSync('manual');
            // ヘルスチェックを更新
            const healthChecker = getSyncHealthChecker();
            await healthChecker.checkAndUpdateHealth();
            const isSuccess = result.status === 'success' || result.status === 'partial_success';
            res.json({
                success: isSuccess,
                message: isSuccess
                    ? `Full sync completed: ${result.additionResult.successfullyAdded} added, ${result.deletionResult.successfullyDeleted} deleted`
                    : 'Full sync failed',
                data: {
                    status: result.status,
                    additionResult: {
                        totalProcessed: result.additionResult.totalProcessed,
                        successfullyAdded: result.additionResult.successfullyAdded,
                        successfullyUpdated: result.additionResult.successfullyUpdated,
                        failed: result.additionResult.failed,
                    },
                    deletionResult: {
                        totalDetected: result.deletionResult.totalDetected,
                        successfullyDeleted: result.deletionResult.successfullyDeleted,
                        failedToDelete: result.deletionResult.failedToDelete,
                        requiresManualReview: result.deletionResult.requiresManualReview,
                    },
                    duration: result.totalDurationMs,
                    syncedAt: result.syncedAt,
                },
            });
        }
    }
    catch (error) {
        console.error('Trigger sync error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/missing
 * 不足している売主を検出（同期はしない）
 */
router.get('/missing', async (req, res) => {
    try {
        const { getEnhancedAutoSyncService } = await Promise.resolve().then(() => __importStar(require('../services/EnhancedAutoSyncService')));
        const syncService = getEnhancedAutoSyncService();
        await syncService.initialize();
        const missingSellers = await syncService.detectMissingSellers();
        res.json({
            success: true,
            data: {
                count: missingSellers.length,
                sellerNumbers: missingSellers.slice(0, 100), // 最初の100件のみ
                hasMore: missingSellers.length > 100,
            },
        });
    }
    catch (error) {
        console.error('Detect missing sellers error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/periodic/start
 * 定期同期を開始
 */
router.post('/periodic/start', async (req, res) => {
    try {
        const { getPeriodicSyncManager } = await Promise.resolve().then(() => __importStar(require('../services/AutoSyncService')));
        const intervalMinutes = req.body.intervalMinutes || 5;
        const periodicSyncManager = getPeriodicSyncManager(intervalMinutes);
        if (periodicSyncManager.isActive()) {
            return res.json({
                success: true,
                message: 'Periodic sync is already running',
                data: {
                    isActive: true,
                    intervalMinutes: periodicSyncManager.getIntervalMinutes(),
                },
            });
        }
        await periodicSyncManager.start();
        res.json({
            success: true,
            message: `Periodic sync started (every ${periodicSyncManager.getIntervalMinutes()} minutes)`,
            data: {
                isActive: true,
                intervalMinutes: periodicSyncManager.getIntervalMinutes(),
            },
        });
    }
    catch (error) {
        console.error('Periodic sync start error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * POST /api/sync/periodic/stop
 * 定期同期を停止
 */
router.post('/periodic/stop', async (req, res) => {
    try {
        const { getPeriodicSyncManager } = await Promise.resolve().then(() => __importStar(require('../services/AutoSyncService')));
        const periodicSyncManager = getPeriodicSyncManager();
        periodicSyncManager.stop();
        res.json({
            success: true,
            message: 'Periodic sync stopped',
            data: {
                isActive: false,
            },
        });
    }
    catch (error) {
        console.error('Periodic sync stop error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/periodic/status
 * 定期同期のステータスを取得
 */
router.get('/periodic/status', async (req, res) => {
    try {
        const { getPeriodicSyncManager } = await Promise.resolve().then(() => __importStar(require('../services/AutoSyncService')));
        const periodicSyncManager = getPeriodicSyncManager();
        res.json({
            success: true,
            data: {
                isActive: periodicSyncManager.isActive(),
                intervalMinutes: periodicSyncManager.getIntervalMinutes(),
            },
        });
    }
    catch (error) {
        console.error('Periodic sync status error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
/**
 * GET /api/sync/sellers-by-inquiry-date?from=2026-01-01
 * GAS一括同期用: 指定日以降の反響日付を持つ売主番号リストを返す
 * GASはこのリストを使って seller-row を1件ずつ呼び出す
 */
router.get('/sellers-by-inquiry-date', async (req, res) => {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const from = req.query.from;
    if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from)) {
        return res.status(400).json({ success: false, error: 'fromパラメータが必要です（例: 2026-01-01）' });
    }
    try {
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data, error } = await supabaseClient
            .from('sellers')
            .select('seller_number')
            .gte('inquiry_date', from)
            .is('deleted_at', null)
            .order('inquiry_date', { ascending: true })
            .limit(10000);
        if (error)
            throw new Error(error.message);
        const sellerNumbers = (data || []).map((s) => s.seller_number);
        console.log(`[sellers-by-inquiry-date] from=${from} → ${sellerNumbers.length}件`);
        res.json({ success: true, count: sellerNumbers.length, sellerNumbers });
    }
    catch (error) {
        console.error('[sellers-by-inquiry-date] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
/**
 * POST /api/sync/seller-row
 * GAS onEditトリガー用: スプレッドシートの1行分のデータを受け取ってDBを更新
 *
 * リクエストボディ: スプレッドシートの行データ（カラム名: 値 の形式）
 * 例: { "売主番号": "AA13501", "状況（当社）": "追客中", ... }
 */
router.post('/seller-row', async (req, res) => {
    // CRON_SECRET認証チェック
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    try {
        const row = req.body;
        const sellerNumber = row['売主番号'];
        // デバッグ: 訪問日フィールドをログ出力
        console.log(`[seller-row] ${sellerNumber} 訪問日 Y/M/D:`, row['訪問日 Y/M/D'], '(type:', typeof row['訪問日 Y/M/D'], ')');
        if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.startsWith('AA')) {
            return res.status(400).json({ success: false, error: '売主番号が不正です' });
        }
        const { getEnhancedAutoSyncService } = await Promise.resolve().then(() => __importStar(require('../services/EnhancedAutoSyncService')));
        const syncService = getEnhancedAutoSyncService();
        await syncService.initialize();
        // DBに売主が存在するか確認
        const { createClient } = await Promise.resolve().then(() => __importStar(require('@supabase/supabase-js')));
        const supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data: existing } = await supabaseClient
            .from('sellers')
            .select('seller_number')
            .eq('seller_number', sellerNumber)
            .single();
        if (existing) {
            // 既存売主を更新
            await syncService.updateSingleSeller(sellerNumber, row);
            console.log(`✅ [seller-row] Updated: ${sellerNumber}`);
            res.json({ success: true, action: 'updated', sellerNumber });
        }
        else {
            // 新規売主を追加
            await syncService.syncSingleSeller(sellerNumber, row);
            console.log(`✅ [seller-row] Created: ${sellerNumber}`);
            res.json({ success: true, action: 'created', sellerNumber });
        }
    }
    catch (error) {
        console.error('[seller-row] Error:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});
exports.default = router;
