"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const ActivityLogService_1 = require("../services/ActivityLogService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const activityLogService = new ActivityLogService_1.ActivityLogService();
// 全てのルートに認証を適用
router.use(auth_1.authenticate);
/**
 * 活動ログを取得
 */
router.get('/', [
    (0, express_validator_1.query)('employeeId').optional().isUUID().withMessage('Invalid employee ID'),
    (0, express_validator_1.query)('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    (0, express_validator_1.query)('dateTo').optional().isISO8601().withMessage('Invalid date format'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: errors.array(),
                    retryable: false,
                },
            });
        }
        const filter = {
            employeeId: req.query.employeeId,
            dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom) : undefined,
            dateTo: req.query.dateTo ? new Date(req.query.dateTo) : undefined,
            activityType: req.query.activityType,
            sellerId: req.query.sellerId,
            targetType: req.query.target_type,
            targetId: req.query.target_id,
        };
        const logs = await activityLogService.getLogs(filter);
        res.json(logs);
    }
    catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            error: {
                code: 'GET_LOGS_ERROR',
                message: 'Failed to get activity logs',
                retryable: true,
            },
        });
    }
});
/**
 * 活動統計を取得
 */
router.get('/statistics', (0, auth_1.requireRole)('admin', 'agent'), [
    (0, express_validator_1.query)('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
    (0, express_validator_1.query)('dateTo').optional().isISO8601().withMessage('Invalid date format'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: errors.array(),
                    retryable: false,
                },
            });
        }
        const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom) : undefined;
        const dateTo = req.query.dateTo ? new Date(req.query.dateTo) : undefined;
        const statistics = await activityLogService.getStatistics(dateFrom, dateTo);
        res.json(statistics);
    }
    catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            error: {
                code: 'GET_STATISTICS_ERROR',
                message: 'Failed to get statistics',
                retryable: true,
            },
        });
    }
});
/**
 * メール送信履歴を記録
 */
router.post('/email', [
    (0, express_validator_1.body)('buyerId').optional().isString().withMessage('Invalid buyer ID'),
    (0, express_validator_1.body)('sellerId').optional().isString().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('propertyNumbers').isArray().withMessage('Property numbers must be an array'),
    (0, express_validator_1.body)('recipientEmail').isEmail().withMessage('Invalid recipient email'),
    (0, express_validator_1.body)('subject').isString().notEmpty().withMessage('Subject is required'),
    (0, express_validator_1.body)('templateName').optional().isString().withMessage('Invalid template name'),
    (0, express_validator_1.body)('senderEmail').isEmail().withMessage('Invalid sender email'),
    (0, express_validator_1.body)('source').optional().isString().withMessage('Invalid source'),
    (0, express_validator_1.body)('preViewingNotes').optional().isString().withMessage('Invalid pre-viewing notes'),
], async (req, res) => {
    try {
        const errors = (0, express_validator_1.validationResult)(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Validation failed',
                    details: errors.array(),
                    retryable: false,
                },
            });
        }
        const { buyerId, sellerId, propertyNumbers, recipientEmail, subject, templateName, senderEmail, source, preViewingNotes } = req.body;
        // buyerIdまたはsellerIdのいずれかが必須
        if (!buyerId && !sellerId) {
            return res.status(400).json({
                error: {
                    code: 'VALIDATION_ERROR',
                    message: 'Either buyerId or sellerId is required',
                    retryable: false,
                },
            });
        }
        // 認証されたユーザーIDを取得
        const createdBy = req.user?.id;
        if (!createdBy) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'User not authenticated',
                    retryable: false,
                },
            });
        }
        await activityLogService.logEmail({
            buyerId,
            sellerId,
            propertyNumbers,
            recipientEmail,
            subject,
            templateName,
            senderEmail,
            source,
            preViewingNotes,
            createdBy,
        });
        res.status(201).json({ success: true });
    }
    catch (error) {
        console.error('Log email error:', error);
        res.status(500).json({
            error: {
                code: 'LOG_EMAIL_ERROR',
                message: 'Failed to log email',
                retryable: true,
            },
        });
    }
});
exports.default = router;
