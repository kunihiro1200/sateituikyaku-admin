"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorHandler = exports.ErrorType = void 0;
/**
 * エラーの種類
 */
var ErrorType;
(function (ErrorType) {
    ErrorType["NETWORK"] = "network";
    ErrorType["AUTHENTICATION"] = "authentication";
    ErrorType["DATA_INTEGRITY"] = "data_integrity";
    ErrorType["RATE_LIMIT"] = "rate_limit";
    ErrorType["UNKNOWN"] = "unknown";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
/**
 * エラーハンドラーサービス
 * エラーの分類、ログ記録、リトライ機能を提供
 */
class ErrorHandler {
    constructor(supabase) {
        this.defaultRetryConfig = {
            maxRetries: 3,
            initialDelayMs: 1000,
            maxDelayMs: 10000,
            backoffMultiplier: 2,
        };
        this.supabase = supabase;
    }
    /**
     * エラーの種類を判定
     */
    classifyError(error) {
        // ネットワークエラー
        if (error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.message?.includes('network') ||
            error.message?.includes('fetch failed')) {
            return ErrorType.NETWORK;
        }
        // 認証エラー
        if (error.status === 401 ||
            error.status === 403 ||
            error.message?.includes('authentication') ||
            error.message?.includes('unauthorized') ||
            error.message?.includes('token')) {
            return ErrorType.AUTHENTICATION;
        }
        // レート制限エラー
        if (error.status === 429 ||
            error.message?.includes('rate limit') ||
            error.message?.includes('quota exceeded')) {
            return ErrorType.RATE_LIMIT;
        }
        // データ整合性エラー
        if (error.message?.includes('validation') ||
            error.message?.includes('constraint') ||
            error.message?.includes('integrity') ||
            error.message?.includes('duplicate')) {
            return ErrorType.DATA_INTEGRITY;
        }
        return ErrorType.UNKNOWN;
    }
    /**
     * エラーをログに記録
     */
    async logError(error, context, userId) {
        try {
            const errorType = this.classifyError(error);
            const logEntry = {
                errorType,
                message: error.message || String(error),
                stack: error.stack,
                context,
                timestamp: new Date(),
                userId,
                resolved: false,
            };
            // データベースにエラーログを保存
            const { error: dbError } = await this.supabase
                .from('error_logs')
                .insert(logEntry);
            if (dbError) {
                console.error('Failed to log error to database:', dbError);
            }
            // コンソールにもログ出力
            console.error('Error logged:', {
                type: errorType,
                message: logEntry.message,
                context,
            });
        }
        catch (loggingError) {
            console.error('Failed to log error:', loggingError);
        }
    }
    /**
     * リトライ可能なエラーかどうかを判定
     */
    isRetryable(errorType) {
        return (errorType === ErrorType.NETWORK ||
            errorType === ErrorType.RATE_LIMIT);
    }
    /**
     * 指数バックオフでリトライを実行
     */
    async withRetry(operation, config = {}, context) {
        const retryConfig = { ...this.defaultRetryConfig, ...config };
        let lastError;
        let delay = retryConfig.initialDelayMs;
        for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
            try {
                return await operation();
            }
            catch (error) {
                lastError = error;
                const errorType = this.classifyError(error);
                // リトライ不可能なエラーの場合は即座に失敗
                if (!this.isRetryable(errorType)) {
                    await this.logError(error, {
                        ...context,
                        attempt,
                        retryable: false,
                    });
                    throw error;
                }
                // 最後の試行の場合はエラーをスロー
                if (attempt === retryConfig.maxRetries) {
                    await this.logError(error, {
                        ...context,
                        attempt,
                        maxRetriesReached: true,
                    });
                    throw error;
                }
                // エラーをログに記録
                await this.logError(error, {
                    ...context,
                    attempt,
                    nextRetryDelayMs: delay,
                });
                // 待機
                await this.sleep(delay);
                // 次の遅延時間を計算（指数バックオフ）
                delay = Math.min(delay * retryConfig.backoffMultiplier, retryConfig.maxDelayMs);
            }
        }
        throw lastError;
    }
    /**
     * エラーメッセージをユーザーフレンドリーな形式に変換
     */
    getUserFriendlyMessage(error) {
        const errorType = this.classifyError(error);
        switch (errorType) {
            case ErrorType.NETWORK:
                return 'ネットワーク接続に問題があります。インターネット接続を確認してください。';
            case ErrorType.AUTHENTICATION:
                return '認証に失敗しました。再度ログインしてください。';
            case ErrorType.RATE_LIMIT:
                return 'リクエストが多すぎます。しばらく待ってから再度お試しください。';
            case ErrorType.DATA_INTEGRITY:
                return 'データに問題があります。入力内容を確認してください。';
            default:
                return '予期しないエラーが発生しました。しばらく待ってから再度お試しください。';
        }
    }
    /**
     * エラーが回復可能かどうかを判定
     */
    isRecoverable(error) {
        const errorType = this.classifyError(error);
        return (errorType === ErrorType.NETWORK ||
            errorType === ErrorType.RATE_LIMIT);
    }
    /**
     * 指定時間待機
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * エラーログを取得
     */
    async getErrorLogs(filters) {
        try {
            let query = this.supabase
                .from('error_logs')
                .select('*')
                .order('timestamp', { ascending: false });
            if (filters?.errorType) {
                query = query.eq('error_type', filters.errorType);
            }
            if (filters?.resolved !== undefined) {
                query = query.eq('resolved', filters.resolved);
            }
            if (filters?.startDate) {
                query = query.gte('timestamp', filters.startDate.toISOString());
            }
            if (filters?.endDate) {
                query = query.lte('timestamp', filters.endDate.toISOString());
            }
            if (filters?.limit) {
                query = query.limit(filters.limit);
            }
            const { data, error } = await query;
            if (error) {
                throw error;
            }
            return data || [];
        }
        catch (error) {
            console.error('Failed to fetch error logs:', error);
            return [];
        }
    }
    /**
     * エラーログを解決済みにマーク
     */
    async markErrorResolved(errorId) {
        try {
            const { error } = await this.supabase
                .from('error_logs')
                .update({ resolved: true })
                .eq('id', errorId);
            if (error) {
                throw error;
            }
        }
        catch (error) {
            console.error('Failed to mark error as resolved:', error);
            throw error;
        }
    }
}
exports.ErrorHandler = ErrorHandler;
