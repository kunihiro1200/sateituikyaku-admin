"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncMonitoringService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
class SyncMonitoringService {
    /**
     * Record the result of a field-level sync operation
     */
    async recordFieldSync(result) {
        try {
            const { error } = await supabase
                .from('buyer_field_sync_logs')
                .insert({
                buyer_number: result.buyerNumber,
                field_name: result.fieldName,
                success: result.success,
                old_value: result.oldValue,
                new_value: result.newValue,
                error_message: result.errorMessage,
                synced_at: new Date().toISOString()
            });
            if (error) {
                console.error('Failed to record field sync:', error);
            }
        }
        catch (err) {
            console.error('Error recording field sync:', err);
        }
    }
    /**
     * Get statistics for a specific field across all buyers
     */
    async getFieldStats(fieldName, since) {
        try {
            let query = supabase
                .from('buyer_field_sync_logs')
                .select('success, synced_at')
                .eq('field_name', fieldName);
            if (since) {
                query = query.gte('synced_at', since.toISOString());
            }
            const { data, error } = await query;
            if (error) {
                throw error;
            }
            const totalSyncs = data?.length || 0;
            const successCount = data?.filter(log => log.success).length || 0;
            const failureCount = totalSyncs - successCount;
            const successRate = totalSyncs > 0 ? (successCount / totalSyncs) * 100 : 0;
            const lastSyncAt = data && data.length > 0
                ? new Date(Math.max(...data.map(log => new Date(log.synced_at).getTime())))
                : undefined;
            return {
                fieldName,
                totalSyncs,
                successCount,
                failureCount,
                successRate,
                lastSyncAt
            };
        }
        catch (err) {
            console.error('Error getting field stats:', err);
            return {
                fieldName,
                totalSyncs: 0,
                successCount: 0,
                failureCount: 0,
                successRate: 0
            };
        }
    }
    /**
     * Find buyers with sync issues for specific fields
     */
    async getBuyersWithFieldIssues(fieldName, minFailures = 3) {
        try {
            let query = supabase
                .from('buyer_field_sync_logs')
                .select('buyer_number, field_name, success, error_message, synced_at')
                .eq('success', false)
                .order('synced_at', { ascending: false });
            if (fieldName) {
                query = query.eq('field_name', fieldName);
            }
            const { data, error } = await query;
            if (error) {
                throw error;
            }
            // Group by buyer and field
            const issuesMap = new Map();
            data?.forEach(log => {
                const key = `${log.buyer_number}:${log.field_name}`;
                const existing = issuesMap.get(key);
                if (existing) {
                    existing.failureCount++;
                    if (!existing.lastFailedAt || new Date(log.synced_at) > existing.lastFailedAt) {
                        existing.lastError = log.error_message;
                        existing.lastFailedAt = new Date(log.synced_at);
                    }
                }
                else {
                    issuesMap.set(key, {
                        buyerNumber: log.buyer_number,
                        fieldName: log.field_name,
                        failureCount: 1,
                        lastError: log.error_message,
                        lastFailedAt: new Date(log.synced_at)
                    });
                }
            });
            // Filter by minimum failures
            return Array.from(issuesMap.values())
                .filter(issue => issue.failureCount >= minFailures)
                .sort((a, b) => b.failureCount - a.failureCount);
        }
        catch (err) {
            console.error('Error getting buyers with field issues:', err);
            return [];
        }
    }
    /**
     * Check if alert threshold is reached for a field
     */
    async checkAlertThreshold(fieldName, thresholdPercentage = 10, timeWindowHours = 24) {
        const since = new Date();
        since.setHours(since.getHours() - timeWindowHours);
        const stats = await this.getFieldStats(fieldName, since);
        const shouldAlert = stats.totalSyncs > 0 &&
            (100 - stats.successRate) >= thresholdPercentage;
        return { shouldAlert, stats };
    }
    /**
     * Get recent sync history for a specific buyer
     */
    async getBuyerSyncHistory(buyerNumber, limit = 50) {
        try {
            const { data, error } = await supabase
                .from('buyer_field_sync_logs')
                .select('*')
                .eq('buyer_number', buyerNumber)
                .order('synced_at', { ascending: false })
                .limit(limit);
            if (error) {
                throw error;
            }
            return data?.map(log => ({
                buyerNumber: log.buyer_number,
                fieldName: log.field_name,
                success: log.success,
                oldValue: log.old_value,
                newValue: log.new_value,
                errorMessage: log.error_message
            })) || [];
        }
        catch (err) {
            console.error('Error getting buyer sync history:', err);
            return [];
        }
    }
}
exports.SyncMonitoringService = SyncMonitoringService;
