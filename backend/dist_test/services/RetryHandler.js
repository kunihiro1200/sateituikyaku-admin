"use strict";
/**
 * RetryHandler - リトライロジックと失敗した同期変更のキュー管理
 *
 * ネットワークエラーなどの一時的な障害に対するリトライ機能と、
 * 失敗した変更をキューに保存して後で再処理する機能を提供します。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryHandler = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const DEFAULT_CONFIG = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2
};
class RetryHandler {
    constructor(supabaseUrl, supabaseKey, config) {
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    /**
     * リトライ付きで関数を実行
     * @param fn 実行する関数
     * @param shouldRetry エラーがリトライ可能かどうかを判定する関数
     * @returns 実行結果
     */
    async executeWithRetry(fn, shouldRetry) {
        let lastError;
        let attempts = 0;
        for (let i = 0; i <= this.config.maxRetries; i++) {
            attempts = i + 1;
            try {
                const result = await fn();
                return {
                    success: true,
                    result,
                    attempts
                };
            }
            catch (error) {
                lastError = error;
                // 最後の試行の場合はリトライしない
                if (i === this.config.maxRetries) {
                    break;
                }
                // リトライ可能かどうかをチェック
                if (shouldRetry && !shouldRetry(error)) {
                    break;
                }
                // デフォルトのリトライ判定（ネットワークエラーやレート制限）
                if (!shouldRetry && !this.isRetryableError(error)) {
                    break;
                }
                // 指数バックオフで待機
                const delay = this.calculateDelay(i);
                await this.sleep(delay);
            }
        }
        return {
            success: false,
            error: lastError?.message || 'Unknown error',
            attempts
        };
    }
    /**
     * エラーがリトライ可能かどうかを判定
     */
    isRetryableError(error) {
        // ネットワークエラー
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            return true;
        }
        // HTTPステータスコードによる判定
        const status = error.status || error.statusCode;
        if (status) {
            // 429 Too Many Requests, 500系エラーはリトライ可能
            return status === 429 || (status >= 500 && status < 600);
        }
        // Google Sheets API のレート制限エラー
        if (error.message?.includes('Rate Limit') || error.message?.includes('quota')) {
            return true;
        }
        return false;
    }
    /**
     * 指数バックオフでの待機時間を計算
     */
    calculateDelay(attempt) {
        const delay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
        return Math.min(delay, this.config.maxDelayMs);
    }
    /**
     * 指定時間待機
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 失敗した変更をキューに保存
     * @param change 保存する変更情報
     * @returns 保存結果
     */
    async queueFailedChange(change) {
        try {
            const { data, error } = await this.supabase
                .from('pending_sync_changes')
                .insert({
                buyer_number: change.buyer_number,
                field_name: change.field_name,
                old_value: change.old_value,
                new_value: change.new_value,
                attempted_at: change.attempted_at || new Date(),
                retry_count: change.retry_count,
                last_error: change.last_error,
                status: 'pending'
            })
                .select('id')
                .single();
            if (error) {
                return { success: false, error: error.message };
            }
            return { success: true, id: data?.id };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    }
    /**
     * キューから保留中の変更を取得
     * @param limit 取得する最大件数
     * @returns 保留中の変更リスト
     */
    async getPendingChanges(limit = 100) {
        const { data, error } = await this.supabase
            .from('pending_sync_changes')
            .select('*')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })
            .limit(limit);
        if (error) {
            console.error('Failed to get pending changes:', error);
            return [];
        }
        return data || [];
    }
    /**
     * 変更のステータスを更新
     * @param id 変更ID
     * @param status 新しいステータス
     * @param error エラーメッセージ（失敗時）
     */
    async updateChangeStatus(id, status, error) {
        const updateData = {
            status,
            attempted_at: new Date()
        };
        if (error) {
            updateData.last_error = error;
        }
        if (status === 'pending') {
            // リトライ時はカウントを増やす
            const { data } = await this.supabase
                .from('pending_sync_changes')
                .select('retry_count')
                .eq('id', id)
                .single();
            updateData.retry_count = (data?.retry_count || 0) + 1;
        }
        await this.supabase
            .from('pending_sync_changes')
            .update(updateData)
            .eq('id', id);
    }
    /**
     * キューに溜まった変更を処理
     * @param processor 各変更を処理する関数
     * @returns 処理結果
     */
    async processQueue(processor) {
        const changes = await this.getPendingChanges();
        let processed = 0;
        let succeeded = 0;
        let failed = 0;
        for (const change of changes) {
            processed++;
            // ステータスを処理中に更新
            await this.updateChangeStatus(change.id, 'processing');
            try {
                const success = await processor(change);
                if (success) {
                    await this.updateChangeStatus(change.id, 'completed');
                    succeeded++;
                }
                else {
                    // リトライ回数をチェック
                    if ((change.retry_count || 0) >= this.config.maxRetries) {
                        await this.updateChangeStatus(change.id, 'failed', 'Max retries exceeded');
                    }
                    else {
                        await this.updateChangeStatus(change.id, 'pending', 'Processing failed');
                    }
                    failed++;
                }
            }
            catch (error) {
                // リトライ回数をチェック
                if ((change.retry_count || 0) >= this.config.maxRetries) {
                    await this.updateChangeStatus(change.id, 'failed', error.message);
                }
                else {
                    await this.updateChangeStatus(change.id, 'pending', error.message);
                }
                failed++;
            }
        }
        return { processed, succeeded, failed };
    }
    /**
     * 失敗した変更をクリーンアップ（古いものを削除）
     * @param olderThanDays 指定日数より古いものを削除
     */
    async cleanupOldChanges(olderThanDays = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
        const { data, error } = await this.supabase
            .from('pending_sync_changes')
            .delete()
            .in('status', ['completed', 'failed'])
            .lt('created_at', cutoffDate.toISOString())
            .select('id');
        if (error) {
            console.error('Failed to cleanup old changes:', error);
            return 0;
        }
        return data?.length || 0;
    }
}
exports.RetryHandler = RetryHandler;
