"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditLogService = void 0;
const supabase_1 = require("../config/supabase");
/**
 * Service for managing audit trail logs
 * Tracks all changes to buyer, seller, and property data
 */
class AuditLogService {
    /**
     * Log a field update
     */
    static async logFieldUpdate(entityType, entityId, fieldName, oldValue, newValue, userId, userEmail, syncStatus) {
        try {
            const entry = {
                entity_type: entityType,
                entity_id: entityId,
                field_name: fieldName,
                old_value: this.serializeValue(oldValue),
                new_value: this.serializeValue(newValue),
                user_id: userId,
                user_email: userEmail,
                timestamp: new Date(),
                action: 'update',
                sync_status: syncStatus,
            };
            const { error } = await supabase_1.supabase
                .from('audit_logs')
                .insert(entry);
            if (error) {
                console.error('Failed to create audit log:', error);
                // Don't throw - audit logging should not break the main operation
            }
        }
        catch (error) {
            console.error('Error creating audit log:', error);
            // Don't throw - audit logging should not break the main operation
        }
    }
    /**
     * Log entity creation
     */
    static async logEntityCreation(entityType, entityId, initialData, userId, userEmail) {
        try {
            const entry = {
                entity_type: entityType,
                entity_id: entityId,
                field_name: '_entity_created',
                old_value: null,
                new_value: this.serializeValue(initialData),
                user_id: userId,
                user_email: userEmail,
                timestamp: new Date(),
                action: 'create',
            };
            const { error } = await supabase_1.supabase
                .from('audit_logs')
                .insert(entry);
            if (error) {
                console.error('Failed to create audit log:', error);
            }
        }
        catch (error) {
            console.error('Error creating audit log:', error);
        }
    }
    /**
     * Log entity deletion
     */
    static async logEntityDeletion(entityType, entityId, finalData, userId, userEmail) {
        try {
            const entry = {
                entity_type: entityType,
                entity_id: entityId,
                field_name: '_entity_deleted',
                old_value: this.serializeValue(finalData),
                new_value: null,
                user_id: userId,
                user_email: userEmail,
                timestamp: new Date(),
                action: 'delete',
            };
            const { error } = await supabase_1.supabase
                .from('audit_logs')
                .insert(entry);
            if (error) {
                console.error('Failed to create audit log:', error);
            }
        }
        catch (error) {
            console.error('Error creating audit log:', error);
        }
    }
    /**
     * Get audit logs with optional filtering
     */
    static async getAuditLogs(filter = {}, limit = 100, offset = 0) {
        try {
            let query = supabase_1.supabase
                .from('audit_logs')
                .select('*')
                .order('timestamp', { ascending: false })
                .range(offset, offset + limit - 1);
            if (filter.entityType) {
                query = query.eq('entity_type', filter.entityType);
            }
            if (filter.entityId) {
                query = query.eq('entity_id', filter.entityId);
            }
            if (filter.fieldName) {
                query = query.eq('field_name', filter.fieldName);
            }
            if (filter.userId) {
                query = query.eq('user_id', filter.userId);
            }
            if (filter.startDate) {
                query = query.gte('timestamp', filter.startDate.toISOString());
            }
            if (filter.endDate) {
                query = query.lte('timestamp', filter.endDate.toISOString());
            }
            const { data, error } = await query;
            if (error) {
                throw new Error(`Failed to fetch audit logs: ${error.message}`);
            }
            return data || [];
        }
        catch (error) {
            console.error('Error fetching audit logs:', error);
            throw error;
        }
    }
    /**
     * Get audit logs for a specific entity
     */
    static async getEntityAuditLogs(entityType, entityId, limit = 50) {
        return this.getAuditLogs({ entityType, entityId }, limit, 0);
    }
    /**
     * Get audit logs for a specific field
     */
    static async getFieldAuditLogs(entityType, entityId, fieldName, limit = 20) {
        return this.getAuditLogs({ entityType, entityId, fieldName }, limit, 0);
    }
    /**
     * Serialize value for storage
     * Handles complex types like objects and arrays
     */
    static serializeValue(value) {
        if (value === null || value === undefined) {
            return null;
        }
        if (typeof value === 'object') {
            // Store objects and arrays as JSON
            return JSON.stringify(value);
        }
        return value;
    }
}
exports.AuditLogService = AuditLogService;
