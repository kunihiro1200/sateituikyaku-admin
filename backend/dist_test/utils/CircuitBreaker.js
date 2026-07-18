"use strict";
/**
 * Circuit Breaker Pattern Implementation
 *
 * サーキットブレーカーパターンの実装
 * 連続した失敗を検知し、システムの過負荷を防ぐ
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CircuitBreaker = void 0;
/**
 * サーキットブレーカークラス
 *
 * 状態:
 * - closed: 正常動作中
 * - open: 失敗が閾値を超えた状態（リクエストを拒否）
 * - half-open: タイムアウト後のテスト状態
 */
class CircuitBreaker {
    constructor(thresholdOrOptions, timeout) {
        this.state = 'closed';
        this.failureCount = 0;
        if (typeof thresholdOrOptions === 'object') {
            this.threshold = thresholdOrOptions.threshold;
            this.timeout = thresholdOrOptions.timeout;
        }
        else {
            this.threshold = thresholdOrOptions;
            this.timeout = timeout;
        }
    }
    /**
     * サーキットブレーカーを通して関数を実行
     *
     * @param fn 実行する非同期関数
     * @returns 関数の実行結果
     * @throws サーキットがオープンの場合、またはfnがエラーをスローした場合
     */
    async execute(fn) {
        // サーキットがオープンの場合
        if (this.state === 'open') {
            if (this.shouldAttemptReset()) {
                // タイムアウト後、half-open状態に移行
                this.state = 'half-open';
            }
            else {
                throw new Error('Circuit breaker is open');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * 成功時の処理
     */
    onSuccess() {
        this.failureCount = 0;
        this.state = 'closed';
    }
    /**
     * 失敗時の処理
     */
    onFailure() {
        this.failureCount++;
        this.lastFailureTime = new Date();
        if (this.failureCount >= this.threshold) {
            this.state = 'open';
        }
    }
    /**
     * リセットを試みるべきかどうかを判定
     */
    shouldAttemptReset() {
        if (!this.lastFailureTime)
            return false;
        const elapsed = Date.now() - this.lastFailureTime.getTime();
        return elapsed >= this.timeout;
    }
    /**
     * 現在のサーキット状態を取得
     */
    getState() {
        return this.state;
    }
    /**
     * 失敗回数を取得
     */
    getFailureCount() {
        return this.failureCount;
    }
    /**
     * サーキットブレーカーをリセット
     */
    reset() {
        this.state = 'closed';
        this.failureCount = 0;
        this.lastFailureTime = undefined;
    }
}
exports.CircuitBreaker = CircuitBreaker;
