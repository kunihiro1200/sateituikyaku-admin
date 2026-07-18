"use strict";
/**
 * AI電話統合機能の型定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionError = exports.CallError = exports.AWSConnectionError = exports.PhoneServiceError = void 0;
// ============================================================================
// Error Types
// ============================================================================
/**
 * 電話サービスエラー
 */
class PhoneServiceError extends Error {
    constructor(message, code, category, retryable = false, details) {
        super(message);
        this.code = code;
        this.category = category;
        this.retryable = retryable;
        this.details = details;
        this.name = 'PhoneServiceError';
    }
}
exports.PhoneServiceError = PhoneServiceError;
/**
 * AWS接続エラー
 */
class AWSConnectionError extends PhoneServiceError {
    constructor(message, service, details) {
        super(message, 'AWS_CONNECTION_ERROR', 'aws', true, { service, ...details });
        this.name = 'AWSConnectionError';
    }
}
exports.AWSConnectionError = AWSConnectionError;
/**
 * 通話エラー
 */
class CallError extends PhoneServiceError {
    constructor(message, code, retryable = false, details) {
        super(message, code, 'call', retryable, details);
        this.name = 'CallError';
    }
}
exports.CallError = CallError;
/**
 * 文字起こしエラー
 */
class TranscriptionError extends PhoneServiceError {
    constructor(message, code, retryable = false, details) {
        super(message, code, 'transcription', retryable, details);
        this.name = 'TranscriptionError';
    }
}
exports.TranscriptionError = TranscriptionError;
