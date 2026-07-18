"use strict";
/**
 * Supabase REST API Client with Retry Logic
 *
 * リトライロジックを備えたSupabase REST APIクライアント
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseRestClient = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const retryWithBackoff_1 = require("../utils/retryWithBackoff");
const CircuitBreaker_1 = require("../utils/CircuitBreaker");
/**
 * Supabase REST APIクライアント
 *
 * 機能:
 * - 自動リトライ（指数バックオフ）
 * - サーキットブレーカーパターン
 * - 接続ヘルスチェック
 * - エラーハンドリング
 */
class SupabaseRestClient {
    constructor(config) {
        // デフォルト値を設定
        this.config = {
            supabaseUrl: config.supabaseUrl,
            supabaseKey: config.supabaseKey,
            retryAttempts: config.retryAttempts ?? 3,
            retryDelay: config.retryDelay ?? 1000,
            maxRetryDelay: config.maxRetryDelay ?? 16000,
            retryFactor: config.retryFactor ?? 2,
            circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
            circuitBreakerTimeout: config.circuitBreakerTimeout ?? 60000,
            timeout: config.timeout ?? 30000,
        };
        // Supabaseクライアントを初期化
        this.client = (0, supabase_js_1.createClient)(this.config.supabaseUrl, this.config.supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        // サーキットブレーカーを初期化
        this.circuitBreaker = new CircuitBreaker_1.CircuitBreaker({
            threshold: this.config.circuitBreakerThreshold,
            timeout: this.config.circuitBreakerTimeout,
        });
    }
    /**
     * Supabaseクライアントを取得
     */
    getClient() {
        return this.client;
    }
    /**
     * リトライロジック付きでクエリを実行
     *
     * @param fn 実行する関数
     * @returns クエリ結果
     */
    async executeWithRetry(fn) {
        const retryOptions = {
            maxAttempts: this.config.retryAttempts,
            initialDelay: this.config.retryDelay,
            maxDelay: this.config.maxRetryDelay,
            factor: this.config.retryFactor,
            onRetry: (error, attempt) => {
                console.warn(`[SupabaseRestClient] Retry attempt ${attempt}/${this.config.retryAttempts}:`, error.message);
            },
        };
        return (0, retryWithBackoff_1.retryWithBackoff)(() => this.circuitBreaker.execute(fn), retryOptions);
    }
    /**
     * 接続ヘルスチェック
     *
     * @returns ヘルスチェック結果
     */
    async checkHealth() {
        const startTime = Date.now();
        try {
            // シンプルなクエリで接続をテスト
            const { error } = await this.client
                .from('property_listings')
                .select('id')
                .limit(1);
            const responseTime = Date.now() - startTime;
            if (error) {
                return {
                    healthy: false,
                    responseTime,
                    error: error.message,
                    circuitBreakerState: this.circuitBreaker.getState(),
                };
            }
            return {
                healthy: true,
                responseTime,
                circuitBreakerState: this.circuitBreaker.getState(),
            };
        }
        catch (error) {
            return {
                healthy: false,
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
                circuitBreakerState: this.circuitBreaker.getState(),
            };
        }
    }
    /**
     * サーキットブレーカーの状態を取得
     */
    getCircuitBreakerState() {
        return this.circuitBreaker.getState();
    }
    /**
     * サーキットブレーカーをリセット
     */
    resetCircuitBreaker() {
        this.circuitBreaker.reset();
    }
    /**
     * クライアントを再初期化
     */
    reset() {
        this.client = (0, supabase_js_1.createClient)(this.config.supabaseUrl, this.config.supabaseKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        });
        this.circuitBreaker.reset();
    }
}
exports.SupabaseRestClient = SupabaseRestClient;
