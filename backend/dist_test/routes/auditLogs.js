"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AuditLogService_1 = require("../services/AuditLogService");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
/**
 * GET /api/audit-logs
 * Get audit logs with optional filtering
 */
router.get('/', auth_1.authenticate, async (req, res) => {
    try {
        const { entityType, entityId, fieldName, userId, startDate, endDate, limit = '100', offset = '0', } = req.query;
        const filter = {};
        if (entityType) {
            filter.entityType = entityType;
        }
        if (entityId) {
            filter.entityId = entityId;
        }
        if (fieldName) {
            filter.fieldName = fieldName;
        }
        if (userId) {
            filter.userId = userId;
        }
        if (startDate) {
            filter.startDate = new Date(startDate);
        }
        if (endDate) {
            filter.endDate = new Date(endDate);
        }
        const logs = await AuditLogService_1.AuditLogService.getAuditLogs(filter, parseInt(limit, 10), parseInt(offset, 10));
        res.json(logs);
    }
    catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({
            error: 'Failed to fetch audit logs',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/audit-logs/entity/:entityType/:entityId
 * Get audit logs for a specific entity
 */
router.get('/entity/:entityType/:entityId', auth_1.authenticate, async (req, res) => {
    try {
        const { entityType, entityId } = req.params;
        const { limit = '50' } = req.query;
        if (!['buyer', 'seller', 'property'].includes(entityType)) {
            return res.status(400).json({
                error: 'Invalid entity type',
                message: 'Entity type must be buyer, seller, or property',
            });
        }
        const logs = await AuditLogService_1.AuditLogService.getEntityAuditLogs(entityType, entityId, parseInt(limit, 10));
        res.json(logs);
    }
    catch (error) {
        console.error('Error fetching entity audit logs:', error);
        res.status(500).json({
            error: 'Failed to fetch entity audit logs',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
/**
 * GET /api/audit-logs/field/:entityType/:entityId/:fieldName
 * Get audit logs for a specific field
 */
router.get('/field/:entityType/:entityId/:fieldName', auth_1.authenticate, async (req, res) => {
    try {
        const { entityType, entityId, fieldName } = req.params;
        const { limit = '20' } = req.query;
        if (!['buyer', 'seller', 'property'].includes(entityType)) {
            return res.status(400).json({
                error: 'Invalid entity type',
                message: 'Entity type must be buyer, seller, or property',
            });
        }
        const logs = await AuditLogService_1.AuditLogService.getFieldAuditLogs(entityType, entityId, fieldName, parseInt(limit, 10));
        res.json(logs);
    }
    catch (error) {
        console.error('Error fetching field audit logs:', error);
        res.status(500).json({
            error: 'Failed to fetch field audit logs',
            message: error instanceof Error ? error.message : 'Unknown error',
        });
    }
});
exports.default = router;
