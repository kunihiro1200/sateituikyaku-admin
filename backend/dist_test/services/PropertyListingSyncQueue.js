"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyListingSyncQueue = void 0;
/**
 * 物件リスト同期キュー
 *
 * 物件リストのスプレッドシート同期処理をキューイングして順次処理します。
 * リトライロジック（最大3回、Exponential backoff）とエラーハンドリングを含みます。
 */
class PropertyListingSyncQueue {
    constructor(syncService, retryConfig) {
        this.queue = [];
        this.processing = false;
        this.failedOperations = [];
        this.syncService = syncService;
        this.retryConfig = {
            maxRetries: retryConfig?.maxRetries ?? 3,
            initialDelay: retryConfig?.initialDelay ?? 1000,
            maxDelay: retryConfig?.maxDelay ?? 10000,
            backoffMultiplier: retryConfig?.backoffMultiplier ?? 2,
        };
    }
    /**
     * 同期操作をキューに追加
     */
    async enqueue(operation) {
        const op = {
            ...operation,
            retryCount: 0,
            createdAt: new Date(),
        };
        this.queue.push(op);
        console.log(`[PropertyListingSyncQueue] Enqueued sync for property ${operation.propertyNumber}`);
        // 処理中でなければ処理を開始
        if (!this.processing) {
            this.process().catch(error => {
                console.error('[PropertyListingSyncQueue] Queue processing error:', error);
            });
        }
    }
    /**
     * キューを順次処理
     */
    async process() {
        if (this.processing) {
            return;
        }
        this.processing = true;
        console.log('[PropertyListingSyncQueue] Starting queue processing');
        try {
            while (this.queue.length > 0) {
                const operation = this.queue.shift();
                if (!operation)
                    continue;
                try {
                    console.log(`[PropertyListingSyncQueue] Processing sync for property ${operation.propertyNumber} (attempt ${operation.retryCount + 1})`);
                    await this.executeOperation(operation);
                    console.log(`[PropertyListingSyncQueue] Successfully synced property ${operation.propertyNumber}`);
                }
                catch (error) {
                    console.error(`[PropertyListingSyncQueue] Operation failed for property ${operation.propertyNumber}:`, error);
                    // リトライ判定
                    if (operation.retryCount < this.retryConfig.maxRetries) {
                        // リトライカウントを増やして再キュー
                        operation.retryCount++;
                        // Exponential backoff
                        const delay = this.calculateDelay(operation.retryCount);
                        console.log(`[PropertyListingSyncQueue] Retrying property ${operation.propertyNumber} after ${delay}ms (attempt ${operation.retryCount + 1}/${this.retryConfig.maxRetries})`);
                        await this.sleep(delay);
                        this.queue.push(operation);
                    }
                    else {
                        // 最大リトライ回数を超えたら失敗リストに追加
                        this.failedOperations.push(operation);
                        console.error(`[PropertyListingSyncQueue] Operation permanently failed for property ${operation.propertyNumber} after ${operation.retryCount} retries`);
                    }
                }
            }
        }
        finally {
            this.processing = false;
            console.log('[PropertyListingSyncQueue] Queue processing completed');
        }
    }
    /**
     * 同期操作を実行
     */
    async executeOperation(operation) {
        switch (operation.type) {
            case 'update':
                await this.syncService.syncToSpreadsheet(operation.propertyNumber);
                break;
            case 'update_confirmation':
                if (!operation.confirmation) {
                    throw new Error('confirmation is required for update_confirmation operation');
                }
                await this.syncService.syncConfirmationToSpreadsheet(operation.propertyNumber, operation.confirmation);
                break;
            default:
                throw new Error(`Unknown operation type: ${operation.type}`);
        }
    }
    /**
     * Exponential backoffでリトライ遅延を計算
     */
    calculateDelay(retryCount) {
        const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1);
        return Math.min(delay, this.retryConfig.maxDelay);
    }
    /**
     * 指定時間待機
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * キューのステータスを取得
     */
    getQueueStatus() {
        return {
            pending: this.queue.length,
            processing: this.processing ? 1 : 0,
            failed: this.failedOperations.length,
        };
    }
    /**
     * 失敗した操作を取得
     */
    getFailedOperations() {
        return [...this.failedOperations];
    }
    /**
     * 失敗した操作をクリア
     */
    clearFailedOperations() {
        this.failedOperations = [];
    }
    /**
     * 失敗した操作を再試行
     */
    async retryFailedOperations() {
        const failed = [...this.failedOperations];
        this.failedOperations = [];
        for (const operation of failed) {
            // リトライカウントをリセット
            operation.retryCount = 0;
            await this.enqueue(operation);
        }
    }
    /**
     * キューをクリア
     */
    clearQueue() {
        this.queue = [];
    }
    /**
     * キューが空かどうか
     */
    isEmpty() {
        return this.queue.length === 0 && !this.processing;
    }
    /**
     * 処理完了を待機
     */
    async waitForCompletion(timeoutMs = 30000) {
        const startTime = Date.now();
        while (!this.isEmpty()) {
            if (Date.now() - startTime > timeoutMs) {
                return false; // タイムアウト
            }
            await this.sleep(100);
        }
        return true;
    }
    /**
     * キューの長さを取得（テスト用）
     */
    getQueueLength() {
        return this.queue.length;
    }
}
exports.PropertyListingSyncQueue = PropertyListingSyncQueue;
