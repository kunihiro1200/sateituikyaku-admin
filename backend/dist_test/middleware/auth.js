"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticate = void 0;
const AuthService_supabase_1 = require("../services/AuthService.supabase");
const authService = new AuthService_supabase_1.AuthService();
/**
 * 認証ミドルウェア
 * リクエストヘッダーからJWTトークンを取得し、検証する
 */
const authenticate = async (req, res, next) => {
    try {
        // Authorizationヘッダーからトークンを取得
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: {
                    code: 'AUTH_ERROR',
                    message: 'No authentication token provided',
                    retryable: false,
                },
            });
        }
        const token = authHeader.substring(7); // "Bearer " を除去
        // JWT + Redisでセッションを検証
        const employee = await authService.validateSession(token);
        // リクエストオブジェクトに社員情報を追加
        req.employee = employee;
        next();
    }
    catch (error) {
        return res.status(401).json({
            error: {
                code: 'AUTH_ERROR',
                message: 'Invalid or expired authentication token',
                retryable: false,
            },
        });
    }
};
exports.authenticate = authenticate;
/**
 * ロール確認ミドルウェア
 * 特定のロールを持つ社員のみアクセスを許可
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.employee) {
            return res.status(401).json({
                error: {
                    code: 'AUTH_ERROR',
                    message: 'Authentication required',
                    retryable: false,
                },
            });
        }
        if (!roles.includes(req.employee.role)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient permissions',
                    retryable: false,
                },
            });
        }
        next();
    };
};
exports.requireRole = requireRole;
