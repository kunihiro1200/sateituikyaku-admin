"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationError = void 0;
/**
 * ValidationError - Thrown when input validation fails
 */
class ValidationError extends Error {
    constructor(message, details) {
        super(message);
        this.statusCode = 400;
        this.code = 'VALIDATION_ERROR';
        this.name = 'ValidationError';
        this.details = details;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ValidationError);
        }
    }
    toJSON() {
        return {
            error: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            statusCode: this.statusCode
        };
    }
}
exports.ValidationError = ValidationError;
