"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = void 0;
/**
 * NotFoundError - Thrown when a requested resource is not found
 */
class NotFoundError extends Error {
    constructor(message, resourceType, resourceId) {
        super(message);
        this.statusCode = 404;
        this.code = 'NOT_FOUND';
        this.name = 'NotFoundError';
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        // Maintains proper stack trace for where our error was thrown (only available on V8)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, NotFoundError);
        }
    }
    toJSON() {
        return {
            error: this.name,
            message: this.message,
            code: this.code,
            resourceType: this.resourceType,
            resourceId: this.resourceId,
            statusCode: this.statusCode
        };
    }
}
exports.NotFoundError = NotFoundError;
