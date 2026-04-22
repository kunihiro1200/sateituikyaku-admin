import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService.supabase';

/** 通知対象レコードの型 */
export interface HourlyNotificationTarget {
  property_number: string;
  property_address: string;
  notificationType: 'site_registration' | 'floor_plan';
  dueDateTime: Date;        // 解釈済みの納期日時（JST基準）
  remainingMinutes: number; // 残り時間（分）
}

/** 通知結果 */
export interface HourlyNotificationResult {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    property_number: string;
    notificationType: string;
    success: boolean;
    error?: string;
  }>;
}

/**
 * 業務詳細のサイト登録・間取図納期の約1時間前にメール通知を送信するサービス
 * 毎時0分に Vercel Cron から呼び出される
 */
export class BusinessSiteDeadlineHourlyNotificationService {
  private supabase: SupabaseClient;
  private emailService: EmailService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.emailService = new EmailService();
  }

  /**
   * 日付文字列（YYYY-MM-DD）をJST 00:00:00 として解釈した Date を返す
   * 無効な値の場合は null を返す
   */
  parseDueDateAsJST(dateStr: string): Date | null {
    if (!dateStr || typeof dateStr !== 'string') return null;
    // YYYY-MM-DD 形式チェック
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
    const d = new Date(dateStr + 'T00:00:00+09:00');
    if (isNaN(d.getTime())) return null;
    return d;
  }

  /**
   * 納期日時が現在時刻（JST）の30分後〜90分後の範囲内かチェックする
   * nowJST + 30分 <= dueDateTime <= nowJST + 90分
   */
  isInNotificationWindow(dueDateTime: Date, nowJST: Date): boolean {
    const lower = new Date(nowJST.getTime() + 30 * 60 * 1000);
    const upper = new Date(nowJST.getTime() + 90 * 60 * 1000);
    return dueDateTime >= lower && dueDateTime <= upper;
  }

  /**
   * 残り時間（分）を日本語フォーマットに変換する
   * - 60未満: 「あと約N分」
   * - 60の倍数: 「あと約N時間」
   * - 端数あり: 「あと約H時間M分」
   */
  formatRemainingTime(minutes: number): string {
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
  async getTargets(): Promise<HourlyNotificationTarget[]> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('*');

    if (error) {
      throw new Error(`[BusinessSiteDeadline] DB取得エラー: ${error.message}`);
    }

    const now = new Date();
    // 現在時刻をJSTに変換
    const nowJST = new Date(now.getTime() + 9 * 60 * 60 * 1000);

    const targets: HourlyNotificationTarget[] = [];

    for (const task of data || []) {
      // サイト登録通知チェック
      const siteDeadlineStr = task.site_registration_deadline;
      const siteOkSent = task.site_registration_ok_sent;

      if (siteDeadlineStr) {
        const dueDateTime = this.parseDueDateAsJST(siteDeadlineStr);
        if (dueDateTime && this.isInNotificationWindow(dueDateTime, nowJST)) {
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
        if (dueDateTime && this.isInNotificationWindow(dueDateTime, nowJST)) {
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
  async sendNotifications(targets: HourlyNotificationTarget[]): Promise<HourlyNotificationResult> {
    const result: HourlyNotificationResult = { sent: 0, failed: 0, skipped: 0, details: [] };

    for (const target of targets) {
      if (!target.property_number) {
        result.skipped++;
        continue;
      }

      const remainingTime = this.formatRemainingTime(target.remainingMinutes);

      try {
        let subject: string;
        let body: string;

        if (target.notificationType === 'site_registration') {
          subject = `${target.property_number}/${target.property_address}のサイト登録の納期が${remainingTime}です！！`;
          body = [
            'サイト登録者へ、至急メール送信してください！！',
            `${target.property_number}/${target.property_address}のサイト登録の納期が${remainingTime}ですが大丈夫でしょうか？`,
            'ご確認の程よろしくお願い致します。',
          ].join('\n');
        } else {
          subject = `${target.property_number}/${target.property_address}の間取図作成の納期が${remainingTime}です！！`;
          body = [
            '間取図作成者へ、至急メール送信してください！！',
            `${target.property_number}/${target.property_address}の間取図作成の納期が${remainingTime}ですが大丈夫でしょうか？`,
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
      } catch (error: any) {
        console.error(
          `[BusinessSiteDeadline] 送信失敗: ${target.property_number} / ${target.notificationType} - ${error.message}`
        );
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
