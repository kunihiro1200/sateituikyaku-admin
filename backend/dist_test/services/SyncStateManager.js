"use strict";
/**
 * SyncStateManager
 * 同期状態の管理を行うサービス
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncStateManager = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class SyncStateManager {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase credentials not configured');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    /**
     * 同期状態を取得
     */
    async getSyncState(syncType) {
        const { data, error } = await this.supabase
            .from('sync_state')
            .select('*')
            .eq('sync_type', syncType)
            .single();
        if (error) {
            console.error(`Failed to get sync state for ${syncType}:`, error);
            return null;
        }
        return data;
    }
    /**
     * 同期開始
     */
    async startSync(syncType, totalRecords = 0) {
        try {
            // 同期状態を更新
            const { error: stateError } = await this.supabase
                .from('sync_state')
                .upsert({
                sync_type: syncType,
                status: 'running',
                last_sync_at: new Date().toISOString(),
                total_records: totalRecords,
                synced_records: 0,
                failed_records: 0,
                error_message: null
            });
            if (stateError) {
                console.error('Failed to update sync state:', stateError);
                return null;
            }
            // 同期履歴を作成
            const { data: historyData, error: historyError } = await this.supabase
                .from('sync_history')
                .insert({
                sync_type: syncType,
                started_at: new Date().toISOString(),
                status: 'running',
                total_records: totalRecords,
                synced_records: 0,
                failed_records: 0
            })
                .select()
                .single();
            if (historyError) {
                console.error('Failed to create sync history:', historyError);
                return null;
            }
            return historyData.id;
        }
        catch (error) {
            console.error('Error starting sync:', error);
            return null;
        }
    }
    /**
     * 同期進捗を更新
     */
    async updateProgress(syncType, historyId, syncedRecords, failedRecords) {
        try {
            // 同期状態を更新
            await this.supabase
                .from('sync_state')
                .update({
                synced_records: syncedRecords,
                failed_records: failedRecords
            })
                .eq('sync_type', syncType);
            // 同期履歴を更新
            await this.supabase
                .from('sync_history')
                .update({
                synced_records: syncedRecords,
                failed_records: failedRecords
            })
                .eq('id', historyId);
        }
        catch (error) {
            console.error('Error updating sync progress:', error);
        }
    }
    /**
     * 同期完了
     */
    async completeSync(syncType, historyId, success, errorMessage) {
        try {
            const completedAt = new Date().toISOString();
            const state = await this.getSyncState(syncType);
            if (!state) {
                console.error('Sync state not found');
                return;
            }
            // 同期履歴を取得して期間を計算
            const { data: history } = await this.supabase
                .from('sync_history')
                .select('started_at')
                .eq('id', historyId)
                .single();
            const durationMs = history
                ? new Date(completedAt).getTime() - new Date(history.started_at).getTime()
                : null;
            // 同期状態を更新
            await this.supabase
                .from('sync_state')
                .update({
                status: success ? 'idle' : 'failed',
                last_successful_sync_at: success ? completedAt : state.last_successful_sync_at,
                error_message: errorMessage || null
            })
                .eq('sync_type', syncType);
            // 同期履歴を更新
            await this.supabase
                .from('sync_history')
                .update({
                completed_at: completedAt,
                status: success ? 'completed' : 'failed',
                duration_ms: durationMs,
                error_message: errorMessage || null
            })
                .eq('id', historyId);
        }
        catch (error) {
            console.error('Error completing sync:', error);
        }
    }
    /**
     * エラーを記録
     */
    async logError(historyId, syncType, recordId, errorType, errorMessage, errorStack, metadata) {
        try {
            await this.supabase
                .from('sync_errors')
                .insert({
                sync_history_id: historyId,
                sync_type: syncType,
                record_id: recordId,
                error_type: errorType,
                error_message: errorMessage,
                error_stack: errorStack || null,
                retry_count: 0,
                resolved: false,
                metadata: metadata || {}
            });
        }
        catch (error) {
            console.error('Error logging sync error:', error);
        }
    }
    /**
     * 同期履歴を取得
     */
    async getSyncHistory(syncType, limit = 10) {
        const { data, error } = await this.supabase
            .from('sync_history')
            .select('*')
            .eq('sync_type', syncType)
            .order('started_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('Failed to get sync history:', error);
            return [];
        }
        return data || [];
    }
    /**
     * エラーログを取得
     */
    async getSyncErrors(historyId, limit = 50) {
        const { data, error } = await this.supabase
            .from('sync_errors')
            .select('*')
            .eq('sync_history_id', historyId)
            .order('created_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('Failed to get sync errors:', error);
            return [];
        }
        return data || [];
    }
    /**
     * 未解決のエラーを取得
     */
    async getUnresolvedErrors(syncType) {
        const { data, error } = await this.supabase
            .from('sync_errors')
            .select('*')
            .eq('sync_type', syncType)
            .eq('resolved', false)
            .order('created_at', { ascending: false });
        if (error) {
            console.error('Failed to get unresolved errors:', error);
            return [];
        }
        return data || [];
    }
    /**
     * エラーを解決済みにマーク
     */
    async markErrorResolved(errorId) {
        try {
            await this.supabase
                .from('sync_errors')
                .update({
                resolved: true,
                resolved_at: new Date().toISOString()
            })
                .eq('id', errorId);
        }
        catch (error) {
            console.error('Error marking error as resolved:', error);
        }
    }
    /**
     * 同期が実行中かチェック
     */
    async isSyncRunning(syncType) {
        const state = await this.getSyncState(syncType);
        return state?.status === 'running';
    }
    /**
     * 同期を一時停止
     */
    async pauseSync(syncType) {
        try {
            await this.supabase
                .from('sync_state')
                .update({ status: 'paused' })
                .eq('sync_type', syncType);
        }
        catch (error) {
            console.error('Error pausing sync:', error);
        }
    }
    /**
     * 同期を再開
     */
    async resumeSync(syncType) {
        try {
            await this.supabase
                .from('sync_state')
                .update({ status: 'idle' })
                .eq('sync_type', syncType);
        }
        catch (error) {
            console.error('Error resuming sync:', error);
        }
    }
}
exports.SyncStateManager = SyncStateManager;
