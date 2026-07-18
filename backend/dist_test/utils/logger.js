"use strict";
/**
 * Logging utility for API calls and errors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logAPICall = logAPICall;
exports.logValidationFailure = logValidationFailure;
exports.logError = logError;
exports.logSlowQuery = logSlowQuery;
exports.logCacheEvent = logCacheEvent;
exports.logServiceOperation = logServiceOperation;
/**
 * Log an API call with context
 */
function logAPICall(log) {
    const timestamp = new Date().toISOString();
    const { method, path, statusCode, duration, error, context } = log;
    if (error) {
        console.error(`[${timestamp}] ${method} ${path} - ERROR`, {
            statusCode,
            duration: duration ? `${duration}ms` : undefined,
            error,
            context
        });
    }
    else if (duration && duration > 1000) {
        console.warn(`[${timestamp}] ${method} ${path} - SLOW QUERY`, {
            statusCode,
            duration: `${duration}ms`,
            context
        });
    }
    else {
        console.log(`[${timestamp}] ${method} ${path}`, {
            statusCode,
            duration: duration ? `${duration}ms` : undefined,
            context
        });
    }
}
/**
 * Log a validation failure
 */
function logValidationFailure(field, value, reason, context) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] VALIDATION FAILURE`, {
        field,
        value,
        reason,
        context
    });
}
/**
 * Log an error with stack trace
 */
function logError(message, error, context) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ERROR: ${message}`, {
        error: error.message,
        stack: error.stack,
        context
    });
}
/**
 * Log a slow query
 */
function logSlowQuery(query, duration, context) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] SLOW QUERY (${duration}ms)`, {
        query,
        duration: `${duration}ms`,
        context
    });
}
/**
 * Log cache hit/miss
 */
function logCacheEvent(event, key, context) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] CACHE ${event}`, {
        key,
        context
    });
}
/**
 * Log a service operation
 */
function logServiceOperation(service, operation, success, duration, context) {
    const timestamp = new Date().toISOString();
    const status = success ? 'SUCCESS' : 'FAILURE';
    if (!success) {
        console.error(`[${timestamp}] ${service}.${operation} - ${status}`, {
            duration: duration ? `${duration}ms` : undefined,
            context
        });
    }
    else if (duration && duration > 1000) {
        console.warn(`[${timestamp}] ${service}.${operation} - ${status} (SLOW)`, {
            duration: `${duration}ms`,
            context
        });
    }
    else {
        console.log(`[${timestamp}] ${service}.${operation} - ${status}`, {
            duration: duration ? `${duration}ms` : undefined,
            context
        });
    }
}
/**
 * Logger object with standard logging methods
 * Compatible with existing code that uses logger.info(), logger.error(), etc.
 */
const logger = {
    info: (message, context) => {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] INFO: ${message}`, context || {});
    },
    warn: (message, context) => {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] WARN: ${message}`, context || {});
    },
    error: (message, context) => {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ERROR: ${message}`, context || {});
    },
    debug: (message, context) => {
        const timestamp = new Date().toISOString();
        console.debug(`[${timestamp}] DEBUG: ${message}`, context || {});
    }
};
// Export as default for compatibility with existing imports
exports.default = logger;
