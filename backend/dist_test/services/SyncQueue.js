"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncQueue = void 0;
/**
 * 同期キュー
 *
 * スプレッドシート同期処理をキューイングして順次処理します。
 * リトライロジックとエラーハンドリングを含みます。
 */
class SyncQueue {
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
        // 処理中でなければ処理を開始
        if (!this.processing) {
            this.process().catch(error => {
                console.error('Queue processing error:', error);
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
        try {
            while (this.queue.length > 0) {
                const operation = this.queue.shift();
                if (!operation)
                    continue;
                try {
                    await this.executeOperation(operation);
                }
                catch (error) {
                    console.error(`Operation failed for seller ${operation.sellerId}:`, error);
                    // リトライ判定
                    if (operation.retryCount < this.retryConfig.maxRetries) {
                        // リトライカウントを増やして再キュー
                        operation.retryCount++;
                        // Exponential backoff
                        const delay = this.calculateDelay(operation.retryCount);
                        await this.sleep(delay);
                        this.queue.push(operation);
                    }
                    else {
                        // 最大リトライ回数を超えたら失敗リストに追加
                        this.failedOperations.push(operation);
                        console.error(`Operation permanently failed for seller ${operation.sellerId} after ${operation.retryCount} retries`);
                    }
                }
            }
        }
        finally {
            this.processing = false;
        }
    }
    /**
     * 同期操作を実行
     */
    async executeOperation(operation) {
        switch (operation.type) {
            case 'create':
            case 'update':
                const syncResult = await this.syncService.syncToSpreadsheet(operation.sellerId);
                if (!syncResult.success) {
                    throw new Error(syncResult.error || 'Sync failed');
                }
                break;
            case 'delete':
                const deleteResult = await this.syncService.deleteFromSpreadsheet(operation.sellerId);
                if (!deleteResult.success) {
                    throw new Error(deleteResult.error || 'Delete failed');
                }
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
}
exports.SyncQueue = SyncQueue;
