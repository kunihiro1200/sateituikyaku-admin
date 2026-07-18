"use strict";
/**
 * Custom error classes for the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceError = exports.NotFoundError = exports.ValidationError = void 0;
var ValidationError_1 = require("./ValidationError");
Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function () { return ValidationError_1.ValidationError; } });
var NotFoundError_1 = require("./NotFoundError");
Object.defineProperty(exports, "NotFoundError", { enumerable: true, get: function () { return NotFoundError_1.NotFoundError; } });
var ServiceError_1 = require("./ServiceError");
Object.defineProperty(exports, "ServiceError", { enumerable: true, get: function () { return ServiceError_1.ServiceError; } });
