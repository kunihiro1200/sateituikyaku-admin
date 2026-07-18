"use strict";
/**
 * SyncError - 双方向同期のエラー種別定義
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.SyncValidationError = exports.ConflictError = exports.AuthenticationError = exports.NetworkError = exports.SyncError = void 0;
class SyncError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'SyncError';
        this.code = code;
        this.details = details;
        this.retryable = this.isRetryable(code);
        this.syncStatus = this.retryable ? 'pending' : 'failed';
    }
    isRetryable(code) {
        switch (code) {
            case 'NETWORK_ERROR':
            case 'RATE_LIMIT_ERROR':
                return true;
            case 'AUTHENTICATION_ERROR':
            case 'CONFLICT_ERROR':
            case 'VALIDATION_ERROR':
            case 'NOT_FOUND_ERROR':
            case 'UNKNOWN_ERROR':
                return false;
            default:
                return false;
        }
    }
    toJSON() {
        return {
            code: this.code,
            message: this.message,
            details: this.details,
            retryable: this.retryable,
            syncStatus: this.syncStatus
        };
    }
    static fromError(error) {
        // ネットワークエラー
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
            return new SyncError('NETWORK_ERROR', `Network error: ${error.message}`, { originalCode: error.code });
        }
        // HTTPステータスコードによる判定
        const status = error.status || error.statusCode;
        if (status) {
            if (status === 401 || status === 403) {
                return new SyncError('AUTHENTICATION_ERROR', 'Authentication failed', { status });
            }
            if (status === 404) {
                return new SyncError('NOT_FOUND_ERROR', 'Resource not found', { status });
            }
            if (status === 409) {
                return new SyncError('CONFLICT_ERROR', 'Conflict detected', { status });
            }
            if (status === 429) {
                return new SyncError('RATE_LIMIT_ERROR', 'Rate limit exceeded', { status });
            }
            if (status >= 500) {
                return new SyncError('NETWORK_ERROR', `Server error: ${status}`, { status });
            }
        }
        // Google Sheets API のレート制限エラー
        if (error.message?.includes('Rate Limit') || error.message?.includes('quota')) {
            return new SyncError('RATE_LIMIT_ERROR', 'Google Sheets API rate limit exceeded');
        }
        // バリデーションエラー
        if (error.message?.includes('validation') || error.message?.includes('invalid')) {
            return new SyncError('VALIDATION_ERROR', error.message);
        }
        // 競合エラー
        if (error.message?.includes('conflict') || error.message?.includes('Conflict')) {
            return new SyncError('CONFLICT_ERROR', error.message);
        }
        // その他のエラー
        return new SyncError('UNKNOWN_ERROR', error.message || 'Unknown error occurred');
    }
}
exports.SyncError = SyncError;
/**
 * NetworkError - ネットワーク関連のエラー
 */
class NetworkError extends SyncError {
    constructor(message, details) {
        super('NETWORK_ERROR', message, details);
        this.name = 'NetworkError';
    }
}
exports.NetworkError = NetworkError;
/**
 * AuthenticationError - 認証エラー
 */
class AuthenticationError extends SyncError {
    constructor(message, details) {
        super('AUTHENTICATION_ERROR', message, details);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
/**
 * ConflictError - 競合エラー
 */
class ConflictError extends SyncError {
    constructor(message, conflicts, details) {
        super('CONFLICT_ERROR', message, details);
        this.name = 'ConflictError';
        this.conflicts = conflicts;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            conflicts: this.conflicts
        };
    }
}
exports.ConflictError = ConflictError;
/**
 * ValidationError - バリデーションエラー
 */
class SyncValidationError extends SyncError {
    constructor(message, fieldErrors, details) {
        super('VALIDATION_ERROR', message, details);
        this.name = 'SyncValidationError';
        this.fieldErrors = fieldErrors;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            fieldErrors: this.fieldErrors
        };
    }
}
exports.SyncValidationError = SyncValidationError;
/**
 * RateLimitError - レート制限エラー
 */
class RateLimitError extends SyncError {
    constructor(message, retryAfter, details) {
        super('RATE_LIMIT_ERROR', message, details);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            retryAfter: this.retryAfter
        };
    }
}
exports.RateLimitError = RateLimitError;
