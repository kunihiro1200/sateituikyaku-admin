"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpService = void 0;
const BaseRepository_1 = require("../repositories/BaseRepository");
const types_1 = require("../types");
class FollowUpService extends BaseRepository_1.BaseRepository {
    /**
     * 追客活動を記録
     */
    async recordActivity(activity) {
        const { data, error } = await this.table('activities')
            .insert({
            seller_id: activity.sellerId,
            employee_id: activity.employeeId,
            type: activity.type,
            content: activity.content,
            result: activity.result,
        })
            .select()
            .single();
        if (error || !data) {
            throw new Error('Failed to record activity');
        }
        return data;
    }
    /**
     * 追客履歴を取得（時系列順）
     */
    async getActivityHistory(sellerId) {
        const { data, error } = await this.table('activities')
            .select('*')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });
        if (error) {
            throw new Error(`Failed to get activity history: ${error.message}`);
        }
        return data || [];
    }
    /**
     * 次電日を設定
     */
    async setNextCallDate(sellerId, date) {
        const { error } = await this.table('sellers')
            .update({ next_call_date: date.toISOString().split('T')[0] })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to set next call date: ${error.message}`);
        }
    }
    /**
     * ヒアリング内容を記録
     */
    async recordHearing(sellerId, content) {
        return this.recordActivity({
            sellerId,
            type: types_1.ActivityType.HEARING,
            content: content.content,
            employeeId: content.employeeId,
        });
    }
    /**
     * 確度を更新
     */
    async updateConfidence(sellerId, level) {
        const { error } = await this.table('sellers')
            .update({ confidence: level })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to update confidence: ${error.message}`);
        }
    }
}
exports.FollowUpService = FollowUpService;
