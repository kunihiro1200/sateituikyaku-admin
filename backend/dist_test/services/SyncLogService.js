"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncLogService = void 0;
exports.getSyncLogService = getSyncLogService;
class SyncLogService {
    constructor() {
        this.logs = [];
        this.maxLogs = 100;
        // メモリベースのログ管理（sync_logsテーブル不要）
    }
    /**
     * 同期結果をログに記録（メモリベース）
     */
    async logSync(result) {
        const duration = result.endTime.getTime() - result.startTime.getTime();
        const errorDetails = result.errors.length > 0
            ? JSON.stringify(result.errors.map(e => ({
                sellerNumber: e.sellerNumber,
                message: e.message,
            })))
            : null;
        const logEntry = {
            id: this.generateId(),
            executedAt: result.startTime,
            duration,
            success: result.success,
            newSellersCount: result.newSellersCount,
            updatedSellersCount: result.updatedSellersCount,
            errorsCount: result.errors.length,
            errorDetails,
            triggeredBy: result.triggeredBy,
            missingSellersDetected: result.missingSellersDetected,
            healthStatus: result.success ? 'healthy' : 'unhealthy',
        };
        this.addLog(logEntry);
        console.log('📝 Sync result logged (memory-based)');
    }
    /**
     * 削除同期結果をログに記録（メモリベース）
     */
    async logDeletionSync(result) {
        const logEntry = {
            id: this.generateId(),
            executedAt: result.startedAt,
            duration: result.durationMs,
            success: result.failedToDelete === 0,
            newSellersCount: 0,
            updatedSellersCount: 0,
            errorsCount: result.errors.length,
            errorDetails: result.errors.length > 0
                ? JSON.stringify(result.errors)
                : null,
            triggeredBy: 'scheduled',
            missingSellersDetected: 0,
            healthStatus: result.failedToDelete === 0 ? 'healthy' : 'unhealthy',
            deletedSellersCount: result.successfullyDeleted,
            deletedSellerNumbers: result.deletedSellerNumbers,
            manualReviewRequired: result.requiresManualReview,
        };
        this.addLog(logEntry);
        console.log(`📝 Deletion sync logged: ${result.successfullyDeleted} deleted, ${result.requiresManualReview} require review`);
        // Send alerts for manual review cases if needed
        if (result.requiresManualReview > 0) {
            await this.sendManualReviewAlert(result);
        }
    }
    /**
     * 完全同期結果（追加+削除）をログに記録（メモリベース）
     */
    async logCompleteSync(additionResult, deletionResult) {
        const duration = additionResult.endTime.getTime() - additionResult.startTime.getTime();
        const totalDuration = deletionResult
            ? duration + deletionResult.durationMs
            : duration;
        const allErrors = [
            ...additionResult.errors.map(e => ({
                type: 'addition',
                sellerNumber: e.sellerNumber,
                message: e.message,
            })),
            ...(deletionResult?.errors || []).map(e => ({
                type: 'deletion',
                sellerNumber: e.sellerNumber,
                message: e.error,
            })),
        ];
        const errorDetails = allErrors.length > 0
            ? JSON.stringify(allErrors)
            : null;
        const logEntry = {
            id: this.generateId(),
            executedAt: additionResult.startTime,
            duration: totalDuration,
            success: additionResult.success && (deletionResult?.failedToDelete === 0 || !deletionResult),
            newSellersCount: additionResult.newSellersCount,
            updatedSellersCount: additionResult.updatedSellersCount,
            errorsCount: allErrors.length,
            errorDetails,
            triggeredBy: additionResult.triggeredBy,
            missingSellersDetected: additionResult.missingSellersDetected,
            healthStatus: allErrors.length === 0 ? 'healthy' : 'unhealthy',
            deletedSellersCount: deletionResult?.successfullyDeleted || 0,
            deletedSellerNumbers: deletionResult?.deletedSellerNumbers || [],
            manualReviewRequired: deletionResult?.requiresManualReview || 0,
        };
        this.addLog(logEntry);
        console.log('📝 Complete sync result logged');
        if (deletionResult) {
            console.log(`   ├─ Added: ${additionResult.newSellersCount}, Updated: ${additionResult.updatedSellersCount}`);
            console.log(`   └─ Deleted: ${deletionResult.successfullyDeleted}, Manual review: ${deletionResult.requiresManualReview}`);
        }
        // Send alerts for manual review cases if needed
        if (deletionResult && deletionResult.requiresManualReview > 0) {
            await this.sendManualReviewAlert(deletionResult);
        }
    }
    /**
     * 手動レビューが必要な場合のアラートを送信
     */
    async sendManualReviewAlert(result) {
        try {
            console.warn('⚠️  Manual review required for deletion sync:');
            console.warn(`   Total requiring review: ${result.requiresManualReview}`);
            console.warn(`   Seller numbers: ${result.manualReviewSellerNumbers.join(', ')}`);
            // TODO: Implement actual alert mechanism (email, Slack, etc.)
            // For now, just log to console
            // You could integrate with a notification service here:
            // await notificationService.send({
            //   type: 'manual_review_required',
            //   count: result.requiresManualReview,
            //   sellerNumbers: result.manualReviewSellerNumbers,
            // });
        }
        catch (error) {
            console.error('Failed to send manual review alert:', error);
        }
    }
    /**
     * 同期履歴を取得（メモリベース）
     */
    async getHistory(limit = 100) {
        return this.logs.slice(0, limit);
    }
    /**
     * 最後に成功した同期を取得（メモリベース）
     */
    async getLastSuccessfulSync() {
        const successfulSyncs = this.logs.filter(log => log.success);
        return successfulSyncs.length > 0 ? successfulSyncs[0] : null;
    }
    /**
     * 削除同期の統計情報を取得（メモリベース）
     */
    async getDeletionStats() {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const deletionLogs = this.logs.filter(log => log.deletedSellersCount && log.deletedSellersCount > 0);
        const totalDeleted = deletionLogs.reduce((sum, log) => sum + (log.deletedSellersCount || 0), 0);
        const deletedToday = deletionLogs
            .filter(log => log.executedAt >= today)
            .reduce((sum, log) => sum + (log.deletedSellersCount || 0), 0);
        const deletedThisWeek = deletionLogs
            .filter(log => log.executedAt >= weekAgo)
            .reduce((sum, log) => sum + (log.deletedSellersCount || 0), 0);
        const lastDeletionSync = deletionLogs.length > 0
            ? deletionLogs[0].executedAt
            : null;
        return {
            totalDeleted,
            deletedToday,
            deletedThisWeek,
            lastDeletionSync,
        };
    }
    /**
     * ログをメモリに追加（最大件数を超えたら古いものを削除）
     */
    addLog(log) {
        this.logs.unshift(log); // 新しいログを先頭に追加
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(0, this.maxLogs);
        }
    }
    /**
     * ユニークIDを生成
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.SyncLogService = SyncLogService;
// シングルトンインスタンス
let syncLogServiceInstance = null;
function getSyncLogService() {
    if (!syncLogServiceInstance) {
        syncLogServiceInstance = new SyncLogService();
    }
    return syncLogServiceInstance;
}
