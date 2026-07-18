"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncHealthChecker = void 0;
exports.getSyncHealthChecker = getSyncHealthChecker;
/**
 * 同期ヘルスチェッカー
 *
 * 同期システムの健全性を監視します。
 */
const supabase_js_1 = require("@supabase/supabase-js");
const SyncLogService_1 = require("./SyncLogService");
const EnhancedAutoSyncService_1 = require("./EnhancedAutoSyncService");
class SyncHealthChecker {
    constructor(supabaseUrl, supabaseKey) {
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl || process.env.SUPABASE_URL, supabaseKey || process.env.SUPABASE_SERVICE_KEY);
        this.syncIntervalMinutes = parseInt(process.env.AUTO_SYNC_INTERVAL_MINUTES || '5', 10);
    }
    /**
     * 現在の健全性状態を取得
     */
    async getHealthStatus() {
        const syncLogService = (0, SyncLogService_1.getSyncLogService)();
        const lastSuccessfulSync = await syncLogService.getLastSuccessfulSync();
        // 最新の同期ログを取得
        const history = await syncLogService.getHistory(10);
        // 連続失敗回数を計算
        let consecutiveFailures = 0;
        for (const entry of history) {
            if (!entry.success) {
                consecutiveFailures++;
            }
            else {
                break;
            }
        }
        // 不足売主数を取得
        let pendingMissingSellers = 0;
        try {
            const enhancedSyncService = (0, EnhancedAutoSyncService_1.getEnhancedAutoSyncService)();
            const missingSellers = await enhancedSyncService.detectMissingSellers();
            pendingMissingSellers = missingSellers.length;
        }
        catch (error) {
            console.warn('Failed to detect missing sellers for health check');
        }
        // 健全性を判定
        const lastSyncTime = lastSuccessfulSync?.executedAt || null;
        const isHealthy = this.calculateHealthStatus(lastSyncTime, consecutiveFailures);
        // 次回同期予定時刻を計算
        const nextScheduledSync = lastSyncTime
            ? new Date(lastSyncTime.getTime() + this.syncIntervalMinutes * 60 * 1000)
            : null;
        return {
            isHealthy,
            lastSyncTime,
            lastSyncSuccess: history.length > 0 ? history[0].success : false,
            pendingMissingSellers,
            syncIntervalMinutes: this.syncIntervalMinutes,
            nextScheduledSync,
            consecutiveFailures,
        };
    }
    /**
     * 健全性を計算
     * 最後の成功同期から3倍の間隔を超えていたらunhealthy
     */
    calculateHealthStatus(lastSyncTime, consecutiveFailures) {
        // 連続失敗が3回以上ならunhealthy
        if (consecutiveFailures >= 3) {
            return false;
        }
        // 最後の成功同期がない場合
        if (!lastSyncTime) {
            return false;
        }
        // 3倍の間隔を超えていたらunhealthy
        const thresholdMs = this.syncIntervalMinutes * 3 * 60 * 1000;
        const timeSinceLastSync = Date.now() - lastSyncTime.getTime();
        return timeSinceLastSync < thresholdMs;
    }
    /**
     * 健全性をチェックして更新
     */
    async checkAndUpdateHealth() {
        const status = await this.getHealthStatus();
        // sync_healthテーブルを更新
        const { error } = await this.supabase
            .from('sync_health')
            .upsert({
            id: '00000000-0000-0000-0000-000000000001', // 固定ID
            last_sync_time: status.lastSyncTime?.toISOString() || null,
            last_sync_success: status.lastSyncSuccess,
            pending_missing_sellers: status.pendingMissingSellers,
            consecutive_failures: status.consecutiveFailures,
            is_healthy: status.isHealthy,
            sync_interval_minutes: status.syncIntervalMinutes,
            updated_at: new Date().toISOString(),
        });
        if (error) {
            console.error('Failed to update sync health:', error.message);
        }
        // unhealthyの場合は警告ログを出力
        if (!status.isHealthy) {
            console.warn('⚠️ Sync health is UNHEALTHY!');
            console.warn(`   Last successful sync: ${status.lastSyncTime?.toISOString() || 'Never'}`);
            console.warn(`   Consecutive failures: ${status.consecutiveFailures}`);
            console.warn(`   Pending missing sellers: ${status.pendingMissingSellers}`);
        }
    }
}
exports.SyncHealthChecker = SyncHealthChecker;
// シングルトンインスタンス
let syncHealthCheckerInstance = null;
function getSyncHealthChecker() {
    if (!syncHealthCheckerInstance) {
        syncHealthCheckerInstance = new SyncHealthChecker();
    }
    return syncHealthCheckerInstance;
}
