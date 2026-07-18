"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setInquiryHistoryService = exports.resetInquiryHistoryService = exports.getInquiryHistoryService = void 0;
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const InquiryHistoryService_1 = require("../services/InquiryHistoryService");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// サービスインスタンスを取得する関数（テスト時にモック可能にするため）
let inquiryHistoryServiceInstance = null;
const getInquiryHistoryService = () => {
    if (!inquiryHistoryServiceInstance) {
        inquiryHistoryServiceInstance = new InquiryHistoryService_1.InquiryHistoryService();
    }
    return inquiryHistoryServiceInstance;
};
exports.getInquiryHistoryService = getInquiryHistoryService;
// テスト用：サービスインスタンスをリセット
const resetInquiryHistoryService = () => {
    inquiryHistoryServiceInstance = null;
};
exports.resetInquiryHistoryService = resetInquiryHistoryService;
// テスト用：サービスインスタンスを設定
const setInquiryHistoryService = (service) => {
    inquiryHistoryServiceInstance = service;
};
exports.setInquiryHistoryService = setInquiryHistoryService;
// 全てのルートに認証を適用
router.use(auth_1.authenticate);
/**
 * GET /api/sellers/:sellerId/inquiry-history
 * 売主IDに紐づく問合せ履歴を取得
 */
router.get('/sellers/:sellerId/inquiry-history', [(0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID')], async (req, res) => {
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
        const inquiryHistories = await (0, exports.getInquiryHistoryService)().getInquiryHistories(sellerId);
        res.json(inquiryHistories);
    }
    catch (error) {
        console.error('Get inquiry histories error:', error);
        res.status(500).json({
            error: {
                code: 'GET_INQUIRY_HISTORIES_ERROR',
                message: 'Failed to get inquiry histories',
                retryable: true,
            },
        });
    }
});
/**
 * POST /api/sellers/:sellerId/inquiry-history
 * 新規問合せ履歴を作成
 */
router.post('/sellers/:sellerId/inquiry-history', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('inquiryDate').isISO8601().withMessage('Invalid inquiry date'),
    (0, express_validator_1.body)('inquirySite').optional().isString().withMessage('Invalid inquiry site'),
    (0, express_validator_1.body)('inquiryReason').optional().isString().withMessage('Invalid inquiry reason'),
    (0, express_validator_1.body)('isCurrentStatus').optional().isBoolean().withMessage('Invalid isCurrentStatus'),
    (0, express_validator_1.body)('notes').optional().isString().withMessage('Invalid notes'),
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
        const inquiryHistory = await (0, exports.getInquiryHistoryService)().createInquiryHistory({
            sellerId,
            inquiryDate: new Date(req.body.inquiryDate),
            inquirySite: req.body.inquirySite,
            inquiryReason: req.body.inquiryReason,
            isCurrentStatus: req.body.isCurrentStatus,
            notes: req.body.notes,
        });
        res.status(201).json(inquiryHistory);
    }
    catch (error) {
        console.error('Create inquiry history error:', error);
        res.status(500).json({
            error: {
                code: 'CREATE_INQUIRY_HISTORY_ERROR',
                message: 'Failed to create inquiry history',
                retryable: true,
            },
        });
    }
});
/**
 * PUT /api/inquiry-history/:id
 * 問合せ履歴を更新
 */
router.put('/inquiry-history/:id', [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid inquiry history ID'),
    (0, express_validator_1.body)('inquiryDate').optional().isISO8601().withMessage('Invalid inquiry date'),
    (0, express_validator_1.body)('inquirySite').optional().isString().withMessage('Invalid inquiry site'),
    (0, express_validator_1.body)('inquiryReason').optional().isString().withMessage('Invalid inquiry reason'),
    (0, express_validator_1.body)('isCurrentStatus').optional().isBoolean().withMessage('Invalid isCurrentStatus'),
    (0, express_validator_1.body)('notes').optional().isString().withMessage('Invalid notes'),
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
        const { id } = req.params;
        const inquiryHistory = await (0, exports.getInquiryHistoryService)().updateInquiryHistory(id, {
            inquiryDate: req.body.inquiryDate ? new Date(req.body.inquiryDate) : undefined,
            inquirySite: req.body.inquirySite,
            inquiryReason: req.body.inquiryReason,
            isCurrentStatus: req.body.isCurrentStatus,
            notes: req.body.notes,
        });
        res.json(inquiryHistory);
    }
    catch (error) {
        console.error('Update inquiry history error:', error);
        res.status(500).json({
            error: {
                code: 'UPDATE_INQUIRY_HISTORY_ERROR',
                message: 'Failed to update inquiry history',
                retryable: true,
            },
        });
    }
});
/**
 * PUT /api/sellers/:sellerId/inquiry-history/:id/current-status
 * is_current_statusを更新（既存のis_current_statusをすべてfalseに更新してから、指定された問合せ履歴をtrueに更新）
 */
router.put('/sellers/:sellerId/inquiry-history/:id/current-status', [
    (0, express_validator_1.param)('sellerId').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid inquiry history ID'),
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
        const { sellerId, id } = req.params;
        await (0, exports.getInquiryHistoryService)().updateCurrentStatus(sellerId, id);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Update current status error:', error);
        res.status(500).json({
            error: {
                code: 'UPDATE_CURRENT_STATUS_ERROR',
                message: 'Failed to update current status',
                retryable: true,
            },
        });
    }
});
/**
 * DELETE /api/inquiry-history/:id
 * 問合せ履歴を削除
 */
router.delete('/inquiry-history/:id', [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid inquiry history ID')], async (req, res) => {
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
        const { id } = req.params;
        await (0, exports.getInquiryHistoryService)().deleteInquiryHistory(id);
        res.status(204).send();
    }
    catch (error) {
        console.error('Delete inquiry history error:', error);
        res.status(500).json({
            error: {
                code: 'DELETE_INQUIRY_HISTORY_ERROR',
                message: 'Failed to delete inquiry history',
                retryable: true,
            },
        });
    }
});
exports.default = router;
