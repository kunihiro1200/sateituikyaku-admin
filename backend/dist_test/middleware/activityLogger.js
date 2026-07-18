"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activityLogger = void 0;
const ActivityLogService_1 = require("../services/ActivityLogService");
const activityLogService = new ActivityLogService_1.ActivityLogService();
/**
 * 活動ログミドルウェア
 * APIリクエストを自動的にログに記録
 */
const activityLogger = async (req, res, next) => {
    // 認証されていない場合はスキップ
    if (!req.employee) {
        return next();
    }
    // レスポンス送信後にログを記録
    const originalSend = res.send;
    res.send = function (data) {
        // ログ記録（非同期、エラーは無視）
        logActivity(req, res.statusCode).catch((error) => {
            console.error('Activity logging error:', error);
        });
        return originalSend.call(this, data);
    };
    next();
};
exports.activityLogger = activityLogger;
/**
 * 活動をログに記録
 */
async function logActivity(req, statusCode) {
    // 成功したリクエストのみログに記録
    if (statusCode < 200 || statusCode >= 300) {
        return;
    }
    // ログ対象のアクションを判定
    const action = determineAction(req.method, req.path);
    if (!action) {
        return;
    }
    // ターゲットIDを抽出
    const { targetType, targetId } = extractTarget(req.path, req.body);
    if (!targetId) {
        return;
    }
    // ログを記録
    await activityLogService.logActivity({
        employeeId: req.employee.id,
        action,
        targetType,
        targetId,
        metadata: {
            method: req.method,
            path: req.path,
            query: req.query,
        },
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
    });
}
/**
 * アクションを判定
 */
function determineAction(method, path) {
    // 売主関連
    if (path.includes('/sellers')) {
        if (method === 'POST' && !path.includes('/')) {
            return 'create_seller';
        }
        if (method === 'PUT') {
            return 'update_seller';
        }
        if (path.includes('/send-valuation-email')) {
            return 'send_valuation_email';
        }
        if (path.includes('/send-follow-up-email')) {
            return 'send_follow_up_email';
        }
        if (path.includes('/valuations') && method === 'POST') {
            return 'calculate_valuation';
        }
        if (path.includes('/activities') && method === 'POST') {
            return 'record_activity';
        }
    }
    // 予約関連
    if (path.includes('/appointments')) {
        if (method === 'POST') {
            return 'create_appointment';
        }
        if (method === 'DELETE') {
            return 'cancel_appointment';
        }
    }
    return null;
}
/**
 * ターゲット情報を抽出
 */
function extractTarget(path, body) {
    // パスからIDを抽出
    const sellerMatch = path.match(/\/sellers\/([a-f0-9-]+)/);
    if (sellerMatch) {
        return { targetType: 'seller', targetId: sellerMatch[1] };
    }
    const appointmentMatch = path.match(/\/appointments\/([a-f0-9-]+)/);
    if (appointmentMatch) {
        return { targetType: 'appointment', targetId: appointmentMatch[1] };
    }
    // ボディからIDを抽出
    if (body && body.sellerId) {
        return { targetType: 'seller', targetId: body.sellerId };
    }
    return { targetType: 'unknown', targetId: null };
}
