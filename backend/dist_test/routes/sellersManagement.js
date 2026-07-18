"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const auth_1 = require("../middleware/auth");
const SellerNumberService_1 = require("../services/SellerNumberService");
const DuplicateDetectionService_1 = require("../services/DuplicateDetectionService");
const InquiryService_1 = require("../services/InquiryService");
const ValuationService_1 = require("../services/ValuationService");
const VisitService_1 = require("../services/VisitService");
const FollowUpProgressService_1 = require("../services/FollowUpProgressService");
const DocumentDeliveryService_1 = require("../services/DocumentDeliveryService");
const AssigneeService_1 = require("../services/AssigneeService");
const CompetitorService_1 = require("../services/CompetitorService");
const PinrichService_1 = require("../services/PinrichService");
const ExclusionService_1 = require("../services/ExclusionService");
const router = (0, express_1.Router)();
// Note: Authentication is applied to individual routes below
// Do not use router.use(authenticate) here as it would affect all routes on /api/sellers path
/**
 * Generate seller number
 * POST /sellers/generate-number
 */
router.post('/generate-number', auth_1.authenticate, async (_req, res) => {
    try {
        const sellerNumber = await SellerNumberService_1.sellerNumberService.generateWithRetry();
        res.json({ sellerNumber });
    }
    catch (error) {
        console.error('Generate seller number error:', error);
        res.status(500).json({
            error: {
                code: 'GENERATION_ERROR',
                message: error.message || 'Failed to generate seller number',
                retryable: true,
            },
        });
    }
});
/**
 * Check for duplicate sellers
 * POST /sellers/check-duplicate
 */
router.post('/check-duplicate', auth_1.authenticate, [
    (0, express_validator_1.body)('phoneNumber').notEmpty().withMessage('Phone number is required'),
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Invalid email format'),
    (0, express_validator_1.body)('excludeId').optional().isString(),
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
        const { phoneNumber, email, excludeId } = req.body;
        const matches = await DuplicateDetectionService_1.duplicateDetectionService.instance.checkDuplicates(phoneNumber, email, excludeId);
        res.json({ matches });
    }
    catch (error) {
        console.error('Check duplicate error:', error);
        res.status(500).json({
            error: {
                code: 'DUPLICATE_CHECK_ERROR',
                message: error.message || 'Failed to check duplicates',
                retryable: true,
            },
        });
    }
});
/**
 * Copy seller information
 * POST /sellers/copy/:sellerNumber
 */
router.post('/copy/:sellerNumber', auth_1.authenticate, [(0, express_validator_1.param)('sellerNumber').matches(/^AA\d{5}$/).withMessage('Invalid seller number format')], async (req, res) => {
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
        const { sellerNumber } = req.params;
        const sellerData = await DuplicateDetectionService_1.duplicateDetectionService.instance.copySeller(sellerNumber);
        res.json({ sellerData });
    }
    catch (error) {
        console.error('Copy seller error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            error: {
                code: error.message.includes('not found') ? 'NOT_FOUND' : 'COPY_ERROR',
                message: error.message || 'Failed to copy seller',
                retryable: false,
            },
        });
    }
});
/**
 * Copy buyer information
 * POST /buyers/copy/:buyerNumber
 */
router.post('/buyers/copy/:buyerNumber', auth_1.authenticate, [(0, express_validator_1.param)('buyerNumber').notEmpty().withMessage('Buyer number is required')], async (req, res) => {
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
        const { buyerNumber } = req.params;
        const buyerData = await DuplicateDetectionService_1.duplicateDetectionService.instance.copyBuyer(buyerNumber);
        res.json({ buyerData });
    }
    catch (error) {
        console.error('Copy buyer error:', error);
        res.status(error.message.includes('not found') ? 404 : 500).json({
            error: {
                code: error.message.includes('not found') ? 'NOT_FOUND' : 'COPY_ERROR',
                message: error.message || 'Failed to copy buyer',
                retryable: false,
            },
        });
    }
});
/**
 * Get past owner and property information
 * POST /sellers/past-info
 */
router.post('/past-info', auth_1.authenticate, [
    (0, express_validator_1.body)('phoneNumber').notEmpty().withMessage('Phone number is required'),
    (0, express_validator_1.body)('email').optional().isEmail().withMessage('Invalid email format'),
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
        const { phoneNumber, email } = req.body;
        const pastInfo = await DuplicateDetectionService_1.duplicateDetectionService.instance.getPastOwnerAndPropertyInfo(phoneNumber, email);
        res.json(pastInfo);
    }
    catch (error) {
        console.error('Get past info error:', error);
        res.status(500).json({
            error: {
                code: 'PAST_INFO_ERROR',
                message: error.message || 'Failed to get past information',
                retryable: true,
            },
        });
    }
});
/**
 * Record inquiry information
 * POST /sellers/:id/inquiry
 */
router.post('/:id/inquiry', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('inquirySite').notEmpty().withMessage('Inquiry site is required'),
    (0, express_validator_1.body)('inquiryDate').optional().isISO8601(),
    (0, express_validator_1.body)('inquiryReason').optional().isString(),
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
        const inquiryData = req.body;
        const inquiry = await InquiryService_1.inquiryService.recordInquiry(id, inquiryData);
        res.json({ inquiry });
    }
    catch (error) {
        console.error('Record inquiry error:', error);
        res.status(500).json({
            error: {
                code: 'INQUIRY_ERROR',
                message: error.message || 'Failed to record inquiry',
                retryable: true,
            },
        });
    }
});
/**
 * Get inquiry information
 * GET /sellers/:id/inquiry
 */
router.get('/:id/inquiry', auth_1.authenticate, [(0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID')], async (req, res) => {
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
        const inquiry = await InquiryService_1.inquiryService.getInquiry(id);
        if (!inquiry) {
            return res.status(404).json({
                error: {
                    code: 'NOT_FOUND',
                    message: 'Inquiry not found',
                    retryable: false,
                },
            });
        }
        res.json({ inquiry });
    }
    catch (error) {
        console.error('Get inquiry error:', error);
        res.status(500).json({
            error: {
                code: 'INQUIRY_ERROR',
                message: error.message || 'Failed to get inquiry',
                retryable: true,
            },
        });
    }
});
/**
 * Update valuation amounts
 * PUT /sellers/:id/valuations
 */
router.put('/:id/valuations', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('valuationAmount1').optional().isNumeric(),
    (0, express_validator_1.body)('valuationAmount2').optional().isNumeric(),
    (0, express_validator_1.body)('valuationAmount3').optional().isNumeric(),
    (0, express_validator_1.body)('postVisitValuationAmount1').optional().isNumeric(),
    (0, express_validator_1.body)('valuationMethod').optional().isString(),
    (0, express_validator_1.body)('valuationPdfUrl').optional().isURL(),
    (0, express_validator_1.body)('fixedAssetTaxRoadPrice').optional().isNumeric(),
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
        const valuations = await ValuationService_1.valuationService.saveValuationAmounts(id, req.body);
        res.json({ valuations });
    }
    catch (error) {
        console.error('Update valuations error:', error);
        res.status(500).json({
            error: {
                code: 'VALUATION_ERROR',
                message: error.message || 'Failed to update valuations',
                retryable: true,
            },
        });
    }
});
/**
 * Schedule visit
 * POST /sellers/:id/visit
 */
router.post('/:id/visit', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('visitDate').notEmpty().isISO8601().withMessage('Valid visit date is required'),
    (0, express_validator_1.body)('visitTime').notEmpty().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    (0, express_validator_1.body)('visitAssignee').notEmpty().isString(),
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
        const visit = await VisitService_1.visitService.scheduleVisit(id, req.body);
        res.json({ visit });
    }
    catch (error) {
        console.error('Schedule visit error:', error);
        res.status(500).json({
            error: {
                code: 'VISIT_ERROR',
                message: error.message || 'Failed to schedule visit',
                retryable: true,
            },
        });
    }
});
/**
 * Update follow-up status
 * PUT /sellers/:id/follow-up-status
 */
router.put('/:id/follow-up-status', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('unreachable').optional().isBoolean(),
    (0, express_validator_1.body)('nextCallDate').optional().isISO8601(),
    (0, express_validator_1.body)('confidence').optional().isIn(['高', '中', '低']),
    (0, express_validator_1.body)('contactMethod').optional().isIn(['Email', 'Smail', '電話']),
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
        const { unreachable, nextCallDate, confidence, contactMethod } = req.body;
        let result;
        if (unreachable !== undefined) {
            result = unreachable
                ? await FollowUpProgressService_1.followUpProgressService.markUnreachable(id)
                : await FollowUpProgressService_1.followUpProgressService.markReachable(id);
        }
        else if (nextCallDate) {
            result = await FollowUpProgressService_1.followUpProgressService.scheduleNextCall(id, new Date(nextCallDate));
        }
        else if (confidence) {
            result = await FollowUpProgressService_1.followUpProgressService.updateConfidence(id, confidence);
        }
        else if (contactMethod) {
            result = await FollowUpProgressService_1.followUpProgressService.updateContactMethod(id, contactMethod);
        }
        res.json({ followUpStatus: result });
    }
    catch (error) {
        console.error('Update follow-up status error:', error);
        res.status(500).json({
            error: {
                code: 'FOLLOW_UP_ERROR',
                message: error.message || 'Failed to update follow-up status',
                retryable: true,
            },
        });
    }
});
/**
 * Record document delivery
 * POST /sellers/:id/document-delivery
 */
router.post('/:id/document-delivery', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('type').isIn(['email', 'mail']).withMessage('Type must be email or mail'),
    (0, express_validator_1.body)('sentDate').optional().isISO8601(),
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
        const { type, sentDate } = req.body;
        const date = sentDate ? new Date(sentDate) : new Date();
        const delivery = type === 'email'
            ? await DocumentDeliveryService_1.documentDeliveryService.recordEmailSentDate(id, date)
            : await DocumentDeliveryService_1.documentDeliveryService.recordMailSentDate(id, date);
        res.json({ delivery });
    }
    catch (error) {
        console.error('Record document delivery error:', error);
        res.status(500).json({
            error: {
                code: 'DELIVERY_ERROR',
                message: error.message || 'Failed to record document delivery',
                retryable: true,
            },
        });
    }
});
/**
 * Update assignees
 * PUT /sellers/:id/assignees
 */
router.put('/:id/assignees', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('valuationAssignee').optional().isString(),
    (0, express_validator_1.body)('phoneAssignee').optional().isString(),
    (0, express_validator_1.body)('visitAssignee').optional().isString(),
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
        const { valuationAssignee, phoneAssignee, visitAssignee } = req.body;
        let result;
        if (valuationAssignee) {
            result = await AssigneeService_1.assigneeService.updateValuationAssignee(id, valuationAssignee);
        }
        else if (phoneAssignee !== undefined) {
            result = await AssigneeService_1.assigneeService.updatePhoneAssignee(id, phoneAssignee);
        }
        else if (visitAssignee) {
            result = await AssigneeService_1.assigneeService.updateVisitAssignee(id, visitAssignee);
        }
        res.json({ assignees: result });
    }
    catch (error) {
        console.error('Update assignees error:', error);
        res.status(500).json({
            error: {
                code: 'ASSIGNEE_ERROR',
                message: error.message || 'Failed to update assignees',
                retryable: true,
            },
        });
    }
});
/**
 * Record competitor information
 * POST /sellers/:id/competitor
 */
router.post('/:id/competitor', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('competitorName').optional().isString(),
    (0, express_validator_1.body)('exclusiveOtherDecisionFactor').optional().isString(),
    (0, express_validator_1.body)('otherDecisionCountermeasure').optional().isString(),
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
        const competitor = await CompetitorService_1.competitorService.recordCompetitor(id, req.body);
        res.json({ competitor });
    }
    catch (error) {
        console.error('Record competitor error:', error);
        res.status(500).json({
            error: {
                code: 'COMPETITOR_ERROR',
                message: error.message || 'Failed to record competitor',
                retryable: true,
            },
        });
    }
});
/**
 * Update Pinrich status
 * PUT /sellers/:id/pinrich
 */
router.put('/:id/pinrich', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('status').isIn(['配信中', 'クローズ']).withMessage('Invalid Pinrich status'),
    (0, express_validator_1.body)('numberOfCompanies').optional().isInt({ min: 0 }),
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
        const { status, numberOfCompanies } = req.body;
        const pinrich = status === '配信中'
            ? await PinrichService_1.pinrichService.startPinrichDistribution(id, numberOfCompanies)
            : await PinrichService_1.pinrichService.closePinrichDistribution(id);
        res.json({ pinrich });
    }
    catch (error) {
        console.error('Update Pinrich error:', error);
        res.status(500).json({
            error: {
                code: 'PINRICH_ERROR',
                message: error.message || 'Failed to update Pinrich',
                retryable: true,
            },
        });
    }
});
/**
 * Add to exclusion list
 * POST /sellers/:id/exclusion
 */
router.post('/:id/exclusion', auth_1.authenticate, [
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid seller ID'),
    (0, express_validator_1.body)('exclusionSite').notEmpty().isString(),
    (0, express_validator_1.body)('exclusionCriteria').optional().isString(),
    (0, express_validator_1.body)('exclusionAction').optional().isString(),
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
        const exclusion = await ExclusionService_1.exclusionService.addToExclusionList(id, req.body);
        res.json({ exclusion });
    }
    catch (error) {
        console.error('Add to exclusion error:', error);
        res.status(500).json({
            error: {
                code: 'EXCLUSION_ERROR',
                message: error.message || 'Failed to add to exclusion list',
                retryable: true,
            },
        });
    }
});
exports.default = router;
