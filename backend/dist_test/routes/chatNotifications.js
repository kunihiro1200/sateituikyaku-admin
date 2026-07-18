"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const ChatNotificationService_1 = require("../services/ChatNotificationService");
const router = (0, express_1.Router)();
// Apply authentication to all routes
router.use(auth_1.authenticate);
/**
 * Send general contract notification
 * POST /chat-notifications/general-contract/:sellerId
 */
router.post('/general-contract/:sellerId', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('assignee').optional().isString(),
    (0, express_validator_1.body)('notes').optional().isString(),
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
        const { sellerId } = req.params;
        const success = await new ChatNotificationService_1.ChatNotificationService().sendGeneralContractNotification(sellerId, req.body);
        res.json({ success });
    }
    catch (error) {
        console.error('Send general contract notification error:', error);
        res.status(500).json({
            error: {
                code: 'NOTIFICATION_ERROR',
                message: error.message || 'Failed to send notification',
                retryable: true,
            },
        });
    }
});
/**
 * Send exclusive contract notification
 * POST /chat-notifications/exclusive-contract/:sellerId
 */
router.post('/exclusive-contract/:sellerId', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('assignee').optional().isString(),
    (0, express_validator_1.body)('notes').optional().isString(),
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
        const { sellerId } = req.params;
        const success = await new ChatNotificationService_1.ChatNotificationService().sendExclusiveContractNotification(sellerId, req.body);
        res.json({ success });
    }
    catch (error) {
        console.error('Send exclusive contract notification error:', error);
        res.status(500).json({
            error: {
                code: 'NOTIFICATION_ERROR',
                message: error.message || 'Failed to send notification',
                retryable: true,
            },
        });
    }
});
/**
 * Send post-visit other decision notification
 * POST /chat-notifications/post-visit-other-decision/:sellerId
 */
router.post('/post-visit-other-decision/:sellerId', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('reason').optional().isString(),
    (0, express_validator_1.body)('notes').optional().isString(),
    (0, express_validator_1.body)('assignee').optional().isString(),
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
        const { sellerId } = req.params;
        const success = await new ChatNotificationService_1.ChatNotificationService().sendPostVisitOtherDecisionNotification(sellerId, req.body);
        res.json({ success });
    }
    catch (error) {
        console.error('Send post-visit other decision notification error:', error);
        res.status(500).json({
            error: {
                code: 'NOTIFICATION_ERROR',
                message: error.message || 'Failed to send notification',
                retryable: true,
            },
        });
    }
});
/**
 * Send pre-visit other decision notification
 * POST /chat-notifications/pre-visit-other-decision/:sellerId
 */
router.post('/pre-visit-other-decision/:sellerId', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('reason').optional().isString(),
    (0, express_validator_1.body)('notes').optional().isString(),
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
        const { sellerId } = req.params;
        const success = await new ChatNotificationService_1.ChatNotificationService().sendPreVisitOtherDecisionNotification(sellerId, req.body);
        res.json({ success });
    }
    catch (error) {
        console.error('Send pre-visit other decision notification error:', error);
        res.status(500).json({
            error: {
                code: 'NOTIFICATION_ERROR',
                message: error.message || 'Failed to send notification',
                retryable: true,
            },
        });
    }
});
/**
 * Send property introduction notification
 * POST /chat-notifications/property-introduction/:sellerId
 */
router.post('/property-introduction/:sellerId', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('introduction').notEmpty().withMessage('Introduction text is required'),
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
        const { sellerId } = req.params;
        const { introduction } = req.body;
        const success = await new ChatNotificationService_1.ChatNotificationService().sendPropertyIntroductionNotification(sellerId, introduction);
        res.json({ success });
    }
    catch (error) {
        console.error('Send property introduction notification error:', error);
        res.status(500).json({
            error: {
                code: 'NOTIFICATION_ERROR',
                message: error.message || 'Failed to send notification',
                retryable: true,
            },
        });
    }
});
/**
 * Check if Google Chat is configured
 * GET /chat-notifications/status
 */
router.get('/status', async (_req, res) => {
    try {
        const configured = new ChatNotificationService_1.ChatNotificationService().isConfigured();
        res.json({ configured });
    }
    catch (error) {
        console.error('Check chat notification status error:', error);
        res.status(500).json({
            error: {
                code: 'STATUS_ERROR',
                message: error.message || 'Failed to check status',
                retryable: true,
            },
        });
    }
});
exports.default = router;
