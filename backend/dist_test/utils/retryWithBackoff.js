"use strict";
/**
 * Retry utility with exponential backoff
 *
 * 指数バックオフを使用したリトライユーティリティ
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.retryWithBackoff = retryWithBackoff;
/**
 * 指数バックオフを使用して関数を実行
 *
 * @param fn 実行する非同期関数
 * @param options リトライオプション
 * @returns 関数の実行結果
 * @throws 最大試行回数に達した場合、最後のエラーをスロー
 */
async function retryWithBackoff(fn, options) {
    let lastError;
    let delay = options.initialDelay;
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // 最大試行回数に達した場合はエラーをスロー
            if (attempt === options.maxAttempts) {
                throw lastError;
            }
            // リトライコールバックを実行
            if (options.onRetry) {
                options.onRetry(lastError, attempt);
            }
            // 指数バックオフで待機
            await sleep(delay);
            delay = Math.min(delay * options.factor, options.maxDelay);
        }
    }
    throw lastError;
}
/**
 * 指定されたミリ秒数だけ待機
 *
 * @param ms 待機時間（ミリ秒）
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
