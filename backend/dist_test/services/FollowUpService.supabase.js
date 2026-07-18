"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FollowUpService = void 0;
const BaseRepository_1 = require("../repositories/BaseRepository");
const types_1 = require("../types");
class FollowUpService extends BaseRepository_1.BaseRepository {
    /**
     * 追客活動を記録
     */
    async recordActivity(params) {
        const { data: activity, error } = await this.table('activities')
            .insert({
            seller_id: params.sellerId,
            employee_id: params.employeeId,
            type: params.type,
            content: params.content,
            result: params.result,
            metadata: params.metadata || {},
        })
            .select()
            .single();
        if (error || !activity) {
            throw new Error(`Failed to record activity: ${error?.message}`);
        }
        return activity;
    }
    /**
     * 追客履歴を取得（時系列順、担当者情報を含む）
     */
    async getActivityHistory(sellerId, typeFilter) {
        let query = this.table('activities')
            .select(`
        *,
        employees:employee_id (
          id,
          email,
          name
        )
      `)
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });
        // typeフィルタが指定された場合はDBレベルで絞り込む
        if (typeFilter) {
            query = query.eq('type', typeFilter);
        }
        const { data: activities, error } = await query;
        if (error) {
            throw new Error(`Failed to get activity history: ${error.message}`);
        }
        if (!activities) {
            return [];
        }
        // スネークケースからキャメルケースに変換し、employee情報を整形
        return activities.map((activity) => ({
            id: activity.id,
            sellerId: activity.seller_id,
            employeeId: activity.employee_id,
            type: activity.type,
            content: activity.content,
            result: activity.result,
            metadata: activity.metadata,
            createdAt: activity.created_at,
            employee: activity.employees ? {
                id: activity.employees.id,
                email: activity.employees.email,
                name: activity.employees.name,
            } : null,
        }));
    }
    /**
     * ヒアリング内容を記録
     */
    async recordHearing(params) {
        return this.recordActivity({
            sellerId: params.sellerId,
            employeeId: params.employeeId,
            type: types_1.ActivityType.HEARING,
            content: params.content,
            metadata: params.metadata,
        });
    }
    /**
     * 次電日を設定
     */
    async setNextCallDate(sellerId, nextCallDate) {
        const { error } = await this.table('sellers')
            .update({ next_call_date: nextCallDate.toISOString().split('T')[0] })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to set next call date: ${error.message}`);
        }
    }
    /**
     * 確度レベルを更新
     */
    async updateConfidence(sellerId, confidence) {
        const { error } = await this.table('sellers')
            .update({ confidence })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to update confidence: ${error.message}`);
        }
    }
    /**
     * メール送信成功時の活動ログを自動記録
     */
    async recordEmailActivity(sellerId, employeeId, emailType, messageId) {
        const content = emailType === 'valuation'
            ? '査定結果メールを送信しました'
            : 'フォローアップメールを送信しました';
        return this.recordActivity({
            sellerId,
            employeeId,
            type: types_1.ActivityType.EMAIL,
            content,
            result: 'success',
            metadata: {
                emailType,
                messageId,
            },
        });
    }
    /**
     * 不通フラグを設定
     */
    async markAsUnreachable(sellerId) {
        const { error } = await this.table('sellers')
            .update({
            is_unreachable: true,
            unreachable_since: new Date().toISOString(),
        })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to mark as unreachable: ${error.message}`);
        }
    }
    /**
     * 不通フラグをクリア
     */
    async clearUnreachable(sellerId) {
        const { error } = await this.table('sellers')
            .update({
            is_unreachable: false,
            unreachable_since: null,
        })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to clear unreachable: ${error.message}`);
        }
    }
    /**
     * 1番電話不通時2度目電話フラグを設定
     */
    async setSecondCallAfterUnreachable(sellerId, value) {
        const { error } = await this.table('sellers')
            .update({ second_call_after_unreachable: value })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to set second call flag: ${error.message}`);
        }
    }
    /**
     * 連絡方法を設定
     */
    async setContactMethod(sellerId, method) {
        const { error } = await this.table('sellers')
            .update({ contact_method: method })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to set contact method: ${error.message}`);
        }
    }
    /**
     * 連絡取りやすい時間帯を設定
     */
    async setPreferredContactTime(sellerId, time) {
        const { error } = await this.table('sellers')
            .update({ preferred_contact_time: time })
            .eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to set preferred contact time: ${error.message}`);
        }
    }
    /**
     * 追客進捗情報を一括更新
     */
    async updateFollowUpProgress(sellerId, updates) {
        const updateData = {};
        if (updates.isUnreachable !== undefined) {
            updateData.is_unreachable = updates.isUnreachable;
            if (updates.isUnreachable) {
                updateData.unreachable_since = new Date().toISOString();
            }
            else {
                updateData.unreachable_since = null;
            }
        }
        if (updates.secondCallAfterUnreachable !== undefined) {
            updateData.second_call_after_unreachable = updates.secondCallAfterUnreachable;
        }
        if (updates.nextCallDate !== undefined) {
            updateData.next_call_date = updates.nextCallDate.toISOString().split('T')[0];
        }
        if (updates.confidence !== undefined) {
            updateData.confidence = updates.confidence;
        }
        if (updates.contactMethod !== undefined) {
            updateData.contact_method = updates.contactMethod;
        }
        if (updates.preferredContactTime !== undefined) {
            updateData.preferred_contact_time = updates.preferredContactTime;
        }
        if (Object.keys(updateData).length === 0) {
            return;
        }
        const { error } = await this.table('sellers').update(updateData).eq('id', sellerId);
        if (error) {
            throw new Error(`Failed to update follow-up progress: ${error.message}`);
        }
    }
}
exports.FollowUpService = FollowUpService;
