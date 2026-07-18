"use strict";
/**
 * AWS Services Index
 * すべてのAWSクライアントをエクスポート
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComprehendClient = exports.AmazonComprehendClient = exports.getS3Client = exports.AmazonS3Client = exports.getTranscribeClient = exports.AmazonTranscribeClient = exports.getConnectClient = exports.AmazonConnectClient = void 0;
var ConnectClient_1 = require("./ConnectClient");
Object.defineProperty(exports, "AmazonConnectClient", { enumerable: true, get: function () { return ConnectClient_1.AmazonConnectClient; } });
Object.defineProperty(exports, "getConnectClient", { enumerable: true, get: function () { return ConnectClient_1.getConnectClient; } });
var TranscribeClient_1 = require("./TranscribeClient");
Object.defineProperty(exports, "AmazonTranscribeClient", { enumerable: true, get: function () { return TranscribeClient_1.AmazonTranscribeClient; } });
Object.defineProperty(exports, "getTranscribeClient", { enumerable: true, get: function () { return TranscribeClient_1.getTranscribeClient; } });
var S3Client_1 = require("./S3Client");
Object.defineProperty(exports, "AmazonS3Client", { enumerable: true, get: function () { return S3Client_1.AmazonS3Client; } });
Object.defineProperty(exports, "getS3Client", { enumerable: true, get: function () { return S3Client_1.getS3Client; } });
var ComprehendClient_1 = require("./ComprehendClient");
Object.defineProperty(exports, "AmazonComprehendClient", { enumerable: true, get: function () { return ComprehendClient_1.AmazonComprehendClient; } });
Object.defineProperty(exports, "getComprehendClient", { enumerable: true, get: function () { return ComprehendClient_1.getComprehendClient; } });
