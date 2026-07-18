"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncStateService = void 0;
/**
 * Service for managing property listing sync state
 *
 * This service provides methods to:
 * - Create and track sync operations
 * - Update sync progress and status
 * - Record sync errors
 * - Calculate sync statistics
 * - Monitor sync health
 */
class SyncStateService {
    constructor(supabase) {
        this.supabase = supabase;
    }
    /**
     * Create a new sync record
     *
     * @param type - Type of sync operation
     * @param metadata - Optional metadata for the sync
     * @returns Sync ID
     */
    async createSync(type, metadata) {
        const { data, error } = await this.supabase
            .from('property_listing_sync_state')
            .insert({
            sync_type: type,
            status: 'queued',
            started_at: new Date().toISOString(),
            metadata: metadata || {}
        })
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to create sync record: ${error.message}`);
        }
        return data.id;
    }
    /**
     * Update sync record
     *
     * @param syncId - Sync ID to update
     * @param updates - Partial sync record updates
     */
    async updateSync(syncId, updates) {
        const { error } = await this.supabase
            .from('property_listing_sync_state')
            .update({
            ...updates,
            updated_at: new Date().toISOString()
        })
            .eq('id', syncId);
        if (error) {
            throw new Error(`Failed to update sync record: ${error.message}`);
        }
    }
    /**
     * Mark sync as started
     *
     * @param syncId - Sync ID
     * @param totalItems - Total number of items to sync
     */
    async startSync(syncId, totalItems) {
        await this.updateSync(syncId, {
            status: 'in_progress',
            total_items: totalItems,
            started_at: new Date().toISOString()
        });
    }
    /**
     * Mark sync as completed
     *
     * @param syncId - Sync ID
     * @param stats - Sync statistics
     */
    async completeSync(syncId, stats) {
        const status = stats.failed === 0 ? 'completed' : 'partial';
        await this.updateSync(syncId, {
            status,
            success_count: stats.success,
            failed_count: stats.failed,
            skipped_count: stats.skipped,
            completed_at: new Date().toISOString()
        });
    }
    /**
     * Mark sync as failed
     *
     * @param syncId - Sync ID
     * @param error - Error details
     */
    async failSync(syncId, error) {
        await this.updateSync(syncId, {
            status: 'failed',
            error_details: {
                message: error.message,
                stack: error.stack,
                timestamp: new Date().toISOString()
            },
            completed_at: new Date().toISOString()
        });
    }
    /**
     * Record a sync error
     *
     * @param syncId - Sync ID
     * @param propertyNumber - Property number that failed
     * @param error - Error details
     * @param retryCount - Number of retries attempted
     */
    async recordError(syncId, propertyNumber, error, retryCount = 0) {
        const { error: insertError } = await this.supabase
            .from('property_listing_sync_errors')
            .insert({
            sync_id: syncId,
            property_number: propertyNumber,
            error_type: this.categorizeError(error),
            error_message: error.message,
            error_stack: error.stack,
            retry_count: retryCount
        });
        if (insertError) {
            console.error('Failed to record sync error:', insertError.message);
        }
    }
    /**
     * Get sync record by ID
     *
     * @param syncId - Sync ID
     * @returns Sync record
     */
    async getSync(syncId) {
        const { data, error } = await this.supabase
            .from('property_listing_sync_state')
            .select('*')
            .eq('id', syncId)
            .single();
        if (error) {
            throw new Error(`Failed to get sync record: ${error.message}`);
        }
        return data;
    }
    /**
     * Get last sync record
     *
     * @returns Last sync record or null
     */
    async getLastSync() {
        const { data, error } = await this.supabase
            .from('property_listing_sync_state')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') {
            throw new Error(`Failed to get last sync: ${error.message}`);
        }
        return data;
    }
    /**
     * Get sync errors for a sync operation
     *
     * @param syncId - Sync ID
     * @returns Array of sync errors
     */
    async getSyncErrors(syncId) {
        const { data, error } = await this.supabase
            .from('property_listing_sync_errors')
            .select('*')
            .eq('sync_id', syncId)
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to get sync errors: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Get sync statistics for the last 24 hours
     *
     * @returns Sync statistics
     */
    async getStatistics() {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await this.supabase
            .from('property_listing_sync_state')
            .select('*')
            .gte('started_at', oneDayAgo);
        if (error) {
            throw new Error(`Failed to get statistics: ${error.message}`);
        }
        const total = data.length;
        const successful = data.filter(s => s.status === 'completed').length;
        const failed = data.filter(s => s.status === 'failed').length;
        const partial = data.filter(s => s.status === 'partial').length;
        const durations = data
            .filter(s => s.completed_at)
            .map(s => {
            const start = new Date(s.started_at).getTime();
            const end = new Date(s.completed_at).getTime();
            return (end - start) / 1000; // Convert to seconds
        });
        const avgDuration = durations.length > 0
            ? durations.reduce((a, b) => a + b, 0) / durations.length
            : 0;
        return {
            errorRate: total > 0 ? failed / total : 0,
            avgDuration,
            totalSyncs: total,
            successfulSyncs: successful,
            failedSyncs: failed,
            partialSyncs: partial
        };
    }
    /**
     * Get sync health status
     *
     * @returns Sync health status
     */
    async getHealth() {
        const stats = await this.getStatistics();
        const lastSync = await this.getLastSync();
        // Count recent errors (last hour)
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const { data: recentErrors } = await this.supabase
            .from('property_listing_sync_errors')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', oneHourAgo);
        const recentErrorCount = recentErrors?.length || 0;
        // Determine health status
        let status;
        if (stats.errorRate > 0.1 || recentErrorCount > 50) {
            status = 'unhealthy';
        }
        else if (stats.errorRate > 0.05 || recentErrorCount > 20) {
            status = 'degraded';
        }
        else {
            status = 'healthy';
        }
        return {
            status,
            lastSync: lastSync?.completed_at,
            errorRate: stats.errorRate,
            avgSyncDuration: stats.avgDuration,
            recentErrors: recentErrorCount
        };
    }
    /**
     * Get recent sync history
     *
     * @param limit - Maximum number of records to return
     * @returns Array of sync records
     */
    async getRecentSyncs(limit = 10) {
        const { data, error } = await this.supabase
            .from('property_listing_sync_state')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(limit);
        if (error) {
            throw new Error(`Failed to get recent syncs: ${error.message}`);
        }
        return data || [];
    }
    /**
     * Clean up old sync records
     *
     * @param daysToKeep - Number of days of history to keep
     * @returns Number of records deleted
     */
    async cleanupOldRecords(daysToKeep = 30) {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await this.supabase
            .from('property_listing_sync_state')
            .delete()
            .lt('started_at', cutoffDate)
            .select();
        if (error) {
            throw new Error(`Failed to cleanup old records: ${error.message}`);
        }
        return data?.length || 0;
    }
    /**
     * Categorize error type
     *
     * @param error - Error object
     * @returns Error category
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        if (message.includes('validation') || message.includes('invalid')) {
            return 'validation';
        }
        else if (message.includes('network') || message.includes('timeout') || message.includes('enotfound')) {
            return 'network';
        }
        else if (message.includes('database') || message.includes('sql')) {
            return 'database';
        }
        else if (message.includes('rate limit') || message.includes('too many requests')) {
            return 'rate_limit';
        }
        else if (message.includes('permission') || message.includes('unauthorized')) {
            return 'permission';
        }
        else {
            return 'unknown';
        }
    }
}
exports.SyncStateService = SyncStateService;
