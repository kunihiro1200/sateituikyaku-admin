"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceError = void 0;
/**
 * ServiceError - Thrown when a service operation fails
 */
class ServiceError extends Error {
    constructor(message, service, operation, originalError) {
        super(message);
        this.statusCode = 500;
        this.code = 'SERVICE_ERROR';
        this.name = 'ServiceError';
        this.service = service;
        this.operation = operation;
        this.originalError = originalError;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, ServiceError);
        }
    }
    toJSON() {
        return {
            error: this.name,
            message: this.message,
            code: this.code,
            service: this.service,
            operation: this.operation,
            originalError: this.originalError?.message,
            statusCode: this.statusCode
        };
    }
}
exports.ServiceError = ServiceError;
