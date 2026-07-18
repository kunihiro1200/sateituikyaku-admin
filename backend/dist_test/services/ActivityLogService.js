"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityLogService = void 0;
const BaseRepository_1 = require("../repositories/BaseRepository");
const cache_1 = require("../utils/cache");
class ActivityLogService extends BaseRepository_1.BaseRepository {
    /**
     * 活動ログを記録
     */
    async logActivity(log) {
        const { error } = await this.table('activity_logs').insert({
            employee_id: log.employeeId || null,
            action: log.action,
            target_type: log.targetType,
            target_id: log.targetId,
            metadata: log.metadata || {},
            ip_address: log.ipAddress || null, // INET型は空文字列不可
            user_agent: log.userAgent || null,
        });
        if (error) {
            throw new Error(`Failed to log activity: ${error.message}`);
        }
    }
    /**
     * ログを取得（フィルタ対応）
     */
    async getLogs(filter) {
        let query = this.table('activity_logs').select('*, employee:employees(id, name, initials)');
        if (filter.employeeId) {
            query = query.eq('employee_id', filter.employeeId);
        }
        if (filter.dateFrom) {
            query = query.gte('created_at', filter.dateFrom.toISOString());
        }
        if (filter.dateTo) {
            query = query.lte('created_at', filter.dateTo.toISOString());
        }
        if (filter.activityType) {
            query = query.eq('action', filter.activityType);
        }
        if (filter.sellerId) {
            query = query.eq('target_id', filter.sellerId).eq('target_type', 'seller');
        }
        if (filter.targetType) {
            query = query.eq('target_type', filter.targetType);
        }
        if (filter.targetId) {
            query = query.eq('target_id', filter.targetId);
        }
        const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
        if (error) {
            throw new Error(`Failed to get logs: ${error.message}`);
        }
        return data || [];
    }
    /**
     * メール送信を記録
     */
    async logEmail(params) {
        const description = `物件情報メール送信: ${params.propertyNumbers.join(', ')}`;
        await this.logActivity({
            employeeId: params.createdBy,
            action: 'email',
            targetType: params.buyerId ? 'buyer' : 'seller',
            targetId: params.buyerId || params.sellerId || '',
            metadata: {
                property_numbers: params.propertyNumbers,
                propertyAddresses: params.propertyAddresses || {}, // 物件住所を追加
                recipient_email: params.recipientEmail,
                subject: params.subject,
                templateName: params.templateName,
                sender_email: params.senderEmail,
                email_type: 'inquiry_response',
                pre_viewing_notes: params.preViewingNotes,
                source: params.source, // 送信元識別子を追加
                body: params.body, // メール本文を追加
            },
            ipAddress: undefined,
            userAgent: undefined,
        });
    }
    /**
     * 統計を取得
     */
    async getStatistics(dateFrom, dateTo) {
        // キャッシュキーを生成
        const cacheKey = cache_1.CacheHelper.generateKey('statistics', dateFrom?.toISOString() || 'all', dateTo?.toISOString() || 'now');
        // キャッシュをチェック
        const cached = await cache_1.CacheHelper.get(cacheKey);
        if (cached) {
            console.log('✅ Cache hit for statistics');
            return cached;
        }
        // TODO: Supabase RPCまたはPostgREST集計機能を使用して実装
        // 現在は簡易実装
        const logs = await this.getLogs({
            dateFrom,
            dateTo,
        });
        const employeeMap = new Map();
        for (const log of logs) {
            if (!employeeMap.has(log.employeeId)) {
                employeeMap.set(log.employeeId, {
                    employeeId: log.employeeId,
                    employeeName: '', // TODO: 社員名を取得
                    totalActivities: 0,
                    byType: {},
                });
            }
            const employee = employeeMap.get(log.employeeId);
            employee.totalActivities += 1;
            employee.byType[log.action] = (employee.byType[log.action] || 0) + 1;
        }
        const employeeStats = Array.from(employeeMap.values());
        const totalActivities = employeeStats.reduce((sum, e) => sum + e.totalActivities, 0);
        const result = {
            employeeStats,
            totalActivities,
            period: {
                from: dateFrom || new Date(0),
                to: dateTo || new Date(),
            },
        };
        // キャッシュに保存
        await cache_1.CacheHelper.set(cacheKey, result, cache_1.CACHE_TTL.STATISTICS);
        return result;
    }
}
exports.ActivityLogService = ActivityLogService;
