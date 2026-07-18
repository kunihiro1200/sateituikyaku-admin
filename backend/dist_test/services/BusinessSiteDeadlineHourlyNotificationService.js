"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BusinessSiteDeadlineHourlyNotificationService = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const EmailService_supabase_1 = require("./EmailService.supabase");
/**
 * 業務詳細のサイト登録・間取図納期の約1時間前にメール通知を送信するサービス
 * 毎時0分に Vercel Cron から呼び出される
 */
class BusinessSiteDeadlineHourlyNotificationService {
    constructor() {
        this.supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        this.emailService = new EmailService_supabase_1.EmailService();
    }
    /**
     * 日付・日時文字列を JST として解釈した Date を返す
     * - "YYYY-MM-DD HH:MM:SS" 形式 → JST の時刻として解釈
     * - "YYYY-MM-DD" 形式 → JST 00:00:00 として解釈
     * 無効な値の場合は null を返す
     */
    parseDueDateAsJST(dateStr) {
        if (!dateStr || typeof dateStr !== 'string')
            return null;
        // TIMESTAMPTZ形式（タイムゾーン付き）: "YYYY-MM-DDTHH:MM:SS+09:00" / "YYYY-MM-DDTHH:MM:SSZ" など
        // → new Date() はタイムゾーン情報を正しく解釈するのでそのまま渡す
        const hasTimezone = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)([+-]\d{2}:\d{2}|Z)$/.test(dateStr);
        if (hasTimezone) {
            const d = new Date(dateStr);
            if (isNaN(d.getTime()))
                return null;
            return d;
        }
        // "YYYY-MM-DD HH:MM:SS" または "YYYY-MM-DDTHH:MM:SS" 形式（タイムゾーンなし）→ JSTとして解釈
        const datetimeMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)$/);
        if (datetimeMatch) {
            const d = new Date(datetimeMatch[1] + 'T' + datetimeMatch[2] + '+09:00');
            if (isNaN(d.getTime()))
                return null;
            return d;
        }
        // "YYYY-MM-DD" 形式（date のみ）→ JST 00:00:00
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const d = new Date(dateStr + 'T00:00:00+09:00');
            if (isNaN(d.getTime()))
                return null;
            return d;
        }
        return null;
    }
    /**
     * 納期日時が現在時刻（UTC）の30分後〜90分後の範囲内かチェックする
     * now + 30分 <= dueDateTime <= now + 90分
     */
    isInNotificationWindow(dueDateTime, now) {
        const lower = new Date(now.getTime() + 30 * 60 * 1000);
        const upper = new Date(now.getTime() + 90 * 60 * 1000);
        return dueDateTime >= lower && dueDateTime <= upper;
    }
    /**
     * 残り時間（分）を日本語フォーマットに変換する
     * - 60未満: 「あと約N分」
     * - 60の倍数: 「あと約N時間」
     * - 端数あり: 「あと約H時間M分」
     */
    formatRemainingTime(minutes) {
        if (minutes < 60) {
            return `あと約${minutes}分`;
        }
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        if (m === 0) {
            return `あと約${h}時間`;
        }
        return `あと約${h}時間${m}分`;
    }
    /**
     * 通知対象レコードを取得する
     */
    async getTargets() {
        const { data, error } = await this.supabase
            .from('work_tasks')
            .select('*');
        if (error) {
            throw new Error(`[BusinessSiteDeadline] DB取得エラー: ${error.message}`);
        }
        const now = new Date();
        // isInNotificationWindow には UTC の now をそのまま渡す（nowJST.getTime() は +9h ずれるため使わない）
        const targets = [];
        for (const task of data || []) {
            // サイト登録通知チェック（site_registration_due_date = 納期予定日・datetime型）
            const siteDeadlineStr = task.site_registration_due_date;
            const siteOkSent = task.site_registration_ok_sent;
            if (siteDeadlineStr) {
                const dueDateTime = this.parseDueDateAsJST(siteDeadlineStr);
                if (dueDateTime && this.isInNotificationWindow(dueDateTime, now)) {
                    // site_registration_ok_sent が空欄の場合のみ通知
                    if (!siteOkSent || siteOkSent === '') {
                        const remainingMs = dueDateTime.getTime() - now.getTime();
                        const remainingMinutes = Math.round(remainingMs / (60 * 1000));
                        targets.push({
                            property_number: task.property_number || '',
                            property_address: task.property_address || '',
                            notificationType: 'site_registration',
                            dueDateTime,
                            remainingMinutes,
                        });
                    }
                }
            }
            // 間取図通知チェック
            const floorPlanDueDateStr = task.floor_plan_due_date;
            const floorPlanOkSent = task.floor_plan_ok_sent;
            if (floorPlanDueDateStr) {
                const dueDateTime = this.parseDueDateAsJST(floorPlanDueDateStr);
                if (dueDateTime && this.isInNotificationWindow(dueDateTime, now)) {
                    // floor_plan_ok_sent が空欄の場合のみ通知
                    if (!floorPlanOkSent || floorPlanOkSent === '') {
                        const remainingMs = dueDateTime.getTime() - now.getTime();
                        const remainingMinutes = Math.round(remainingMs / (60 * 1000));
                        targets.push({
                            property_number: task.property_number || '',
                            property_address: task.property_address || '',
                            notificationType: 'floor_plan',
                            dueDateTime,
                            remainingMinutes,
                        });
                    }
                }
            }
        }
        return targets;
    }
    /**
     * 通知メールを送信する
     */
    async sendNotifications(targets) {
        const result = { sent: 0, failed: 0, skipped: 0, details: [] };
        for (const target of targets) {
            if (!target.property_number) {
                result.skipped++;
                continue;
            }
            const remainingTime = this.formatRemainingTime(target.remainingMinutes);
            try {
                let subject;
                let body;
                if (target.notificationType === 'site_registration') {
                    subject = `${target.property_number}/${target.property_address}のサイト登録の納期が迫っています！！`;
                    body = [
                        `${target.property_number}/${target.property_address}のサイト登録の納期が${remainingTime}です。`,
                        '必ず、クラウドワーカーと連絡をとり、納期の件間に合うかどうか連絡してください。',
                        'この件は急ぎではないのでよい等の自己判断はしないでください。',
                        '大事なのは依頼先に「遅れても良い」と思わせないことです。',
                        '「対応済み」に入れる前に、遅れる可能性がある場合は担当、上長に相談してください。',
                        'ご確認の程よろしくお願い致します。',
                    ].join('\n');
                }
                else {
                    subject = `${target.property_number}/${target.property_address}の間取図作成の納期が迫っています！！`;
                    body = [
                        `${target.property_number}/${target.property_address}の間取図作成の納期が${remainingTime}です。`,
                        '必ず、クラウドワーカーと連絡をとり、納期の件間に合うかどうか連絡してください。',
                        'この件は急ぎではないのでよい等の自己判断はしないでください。',
                        '大事なのは依頼先に「遅れても良い」と思わせないことです。',
                        '「対応済み」に入れる前に、遅れる可能性がある場合は担当、上長に相談してください。',
                        'ご確認の程よろしくお願い致します。',
                    ].join('\n');
                }
                await this.emailService.sendEmailWithCcAndAttachments({
                    to: 'tenant@ifoo-oita.com',
                    subject,
                    body: body.replace(/\n/g, '<br>'),
                    from: 'tenant@ifoo-oita.com',
                    isHtml: true,
                });
                console.log(`[BusinessSiteDeadline] 送信成功: ${target.property_number} / ${target.notificationType}`);
                result.sent++;
                result.details.push({
                    property_number: target.property_number,
                    notificationType: target.notificationType,
                    success: true,
                });
            }
            catch (error) {
                console.error(`[BusinessSiteDeadline] 送信失敗: ${target.property_number} / ${target.notificationType} - ${error.message}`);
                result.failed++;
                result.details.push({
                    property_number: target.property_number,
                    notificationType: target.notificationType,
                    success: false,
                    error: error.message,
                });
            }
        }
        return result;
    }
}
exports.BusinessSiteDeadlineHourlyNotificationService = BusinessSiteDeadlineHourlyNotificationService;
