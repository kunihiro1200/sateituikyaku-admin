import { PropertyListingSpreadsheetSync } from './PropertyListingSpreadsheetSync';

export interface PropertySyncOperation {
  type: 'update' | 'update_confirmation';
  propertyNumber: string;
  confirmation?: '未' | '済'; // update_confirmationの場合に使用
  retryCount: number;
  createdAt: Date;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
}

export interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
}

/**
 * 物件リスト同期キュー
 * 
 * 物件リストのスプレッドシート同期処理をキューイングして順次処理します。
 * リトライロジック（最大3回、Exponential backoff）とエラーハンドリングを含みます。
 */
export class PropertyListingSyncQueue {
  private queue: PropertySyncOperation[] = [];
  private processing: boolean = false;
  private failedOperations: PropertySyncOperation[] = [];
  private syncService: PropertyListingSpreadsheetSync;
  private retryConfig: RetryConfig;

  constructor(
    syncService: PropertyListingSpreadsheetSync,
    retryConfig?: Partial<RetryConfig>
  ) {
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
  async enqueue(operation: Omit<PropertySyncOperation, 'retryCount' | 'createdAt'>): Promise<void> {
    const op: PropertySyncOperation = {
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
  async process(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;
    console.log('[PropertyListingSyncQueue] Starting queue processing');

    try {
      while (this.queue.length > 0) {
        const operation = this.queue.shift();
        if (!operation) continue;

        try {
          console.log(`[PropertyListingSyncQueue] Processing sync for property ${operation.propertyNumber} (attempt ${operation.retryCount + 1})`);
          await this.executeOperation(operation);
          console.log(`[PropertyListingSyncQueue] Successfully synced property ${operation.propertyNumber}`);
        } catch (error: any) {
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
          } else {
            // 最大リトライ回数を超えたら失敗リストに追加
            this.failedOperations.push(operation);
            console.error(`[PropertyListingSyncQueue] Operation permanently failed for property ${operation.propertyNumber} after ${operation.retryCount} retries`);
          }
        }
      }
    } finally {
      this.processing = false;
      console.log('[PropertyListingSyncQueue] Queue processing completed');
    }
  }

  /**
   * 同期操作を実行
   */
  private async executeOperation(operation: PropertySyncOperation): Promise<void> {
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
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  /**
   * Exponential backoffでリトライ遅延を計算
   */
  private calculateDelay(retryCount: number): number {
    const delay = this.retryConfig.initialDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount - 1);
    return Math.min(delay, this.retryConfig.maxDelay);
  }

  /**
   * 指定時間待機
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * キューのステータスを取得
   */
  getQueueStatus(): QueueStatus {
    return {
      pending: this.queue.length,
      processing: this.processing ? 1 : 0,
      failed: this.failedOperations.length,
    };
  }

  /**
   * 失敗した操作を取得
   */
  getFailedOperations(): PropertySyncOperation[] {
    return [...this.failedOperations];
  }

  /**
   * 失敗した操作をクリア
   */
  clearFailedOperations(): void {
    this.failedOperations = [];
  }

  /**
   * 失敗した操作を再試行
   */
  async retryFailedOperations(): Promise<void> {
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
  clearQueue(): void {
    this.queue = [];
  }

  /**
   * キューが空かどうか
   */
  isEmpty(): boolean {
    return this.queue.length === 0 && !this.processing;
  }

  /**
   * 処理完了を待機
   */
  async waitForCompletion(timeoutMs: number = 30000): Promise<boolean> {
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
  getQueueLength(): number {
    return this.queue.length;
  }
}
