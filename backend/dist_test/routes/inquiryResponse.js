"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const InquiryResponseService_1 = require("../services/InquiryResponseService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
const inquiryResponseService = new InquiryResponseService_1.InquiryResponseService();
/**
 * POST /api/inquiry-response/generate
 * 問い合わせ返信メールのプレビューを生成
 */
router.post('/generate', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyNumbers, buyerName, buyerEmail } = req.body;
        // バリデーション
        if (!propertyNumbers || !Array.isArray(propertyNumbers) || propertyNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Property numbers are required and must be a non-empty array',
            });
        }
        if (!buyerName || typeof buyerName !== 'string' || buyerName.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Buyer name is required',
            });
        }
        if (!buyerEmail || typeof buyerEmail !== 'string' || !isValidEmail(buyerEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Valid buyer email is required',
            });
        }
        // メールコンテンツを生成
        const emailContent = await inquiryResponseService.generatePreview({
            propertyNumbers,
            buyerName,
            buyerEmail,
            senderAddress: '', // プレビュー時は不要
        });
        res.json({
            success: true,
            emailContent,
        });
    }
    catch (error) {
        console.error('Error generating inquiry response preview:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate email preview',
        });
    }
});
/**
 * POST /api/inquiry-response/send
 * 問い合わせ返信メールを送信
 */
router.post('/send', auth_1.authenticate, async (req, res) => {
    try {
        const { propertyNumbers, buyerName, buyerEmail, senderAddress, emailContent, buyerId } = req.body;
        // バリデーション
        if (!propertyNumbers || !Array.isArray(propertyNumbers) || propertyNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Property numbers are required and must be a non-empty array',
            });
        }
        if (!buyerName || typeof buyerName !== 'string' || buyerName.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Buyer name is required',
            });
        }
        if (!buyerEmail || typeof buyerEmail !== 'string' || !isValidEmail(buyerEmail)) {
            return res.status(400).json({
                success: false,
                error: 'Valid buyer email is required',
            });
        }
        if (!senderAddress || typeof senderAddress !== 'string' || !isValidEmail(senderAddress)) {
            return res.status(400).json({
                success: false,
                error: 'Valid sender address is required',
            });
        }
        if (!emailContent || !emailContent.subject || !emailContent.body) {
            return res.status(400).json({
                success: false,
                error: 'Email content with subject and body is required',
            });
        }
        // 認証されたユーザーのemployeeIdを取得
        const employeeId = req.user?.id;
        // メールを送信
        const result = await inquiryResponseService.sendInquiryResponseEmail({
            propertyNumbers,
            buyerName,
            buyerEmail,
            senderAddress,
            buyerId, // Pass buyerId for email history tracking
        }, emailContent, employeeId // Pass employeeId for activity log
        );
        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to send email',
            });
        }
        res.json({
            success: true,
            message: 'Inquiry response email sent successfully',
            messageId: result.messageId,
        });
    }
    catch (error) {
        console.error('Error sending inquiry response email:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send email',
        });
    }
});
/**
 * メールアドレスの形式を検証
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
exports.default = router;
