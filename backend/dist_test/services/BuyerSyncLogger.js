"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuyerSyncLogger = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
/**
 * Service for logging buyer sync operations
 */
class BuyerSyncLogger {
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
        if (!supabaseUrl || !supabaseServiceKey) {
            throw new Error('Missing Supabase credentials');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey);
    }
    /**
     * Log the start of a sync operation
     * @param totalBuyers Total number of buyers to sync
     * @returns The sync log ID
     */
    async logSyncStart(totalBuyers) {
        const { data, error } = await this.supabase
            .from('buyer_sync_logs')
            .insert({
            sync_started_at: new Date().toISOString(),
            total_buyers: totalBuyers,
            created_count: 0,
            updated_count: 0,
            failed_count: 0,
            skipped_count: 0,
        })
            .select('id')
            .single();
        if (error) {
            console.error('Failed to log sync start:', error);
            throw error;
        }
        return data.id;
    }
    /**
     * Log the completion of a sync operation
     * @param syncId The sync log ID
     * @param result The sync result
     */
    async logSyncComplete(syncId, result) {
        const { error } = await this.supabase
            .from('buyer_sync_logs')
            .update({
            sync_completed_at: new Date().toISOString(),
            created_count: result.created,
            updated_count: result.updated,
            failed_count: result.failed,
            skipped_count: result.skipped,
            success_rate: result.successRate,
            duration_ms: result.duration,
            errors: result.errors,
        })
            .eq('id', syncId);
        if (error) {
            console.error('Failed to log sync complete:', error);
            throw error;
        }
    }
    /**
     * Get recent sync logs
     * @param limit Number of logs to retrieve
     * @returns Array of sync logs
     */
    async getRecentSyncs(limit = 10) {
        const { data, error } = await this.supabase
            .from('buyer_sync_logs')
            .select('*')
            .order('sync_started_at', { ascending: false })
            .limit(limit);
        if (error) {
            console.error('Failed to get recent syncs:', error);
            throw error;
        }
        return data;
    }
    /**
     * Get a specific sync log by ID
     * @param syncId The sync log ID
     * @returns The sync log or null if not found
     */
    async getSyncById(syncId) {
        const { data, error } = await this.supabase
            .from('buyer_sync_logs')
            .select('*')
            .eq('id', syncId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // Not found
                return null;
            }
            console.error('Failed to get sync by ID:', error);
            throw error;
        }
        return data;
    }
}
exports.BuyerSyncLogger = BuyerSyncLogger;
