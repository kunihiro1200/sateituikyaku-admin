import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService.supabase';

const FRONTEND_BASE_URL = 'https://sateituikyaku-admin-frontend.vercel.app';

/** 通知対象レコードの型 */
export interface UpcomingDeadlineTarget {
  property_number: string;
  notificationType: 'site_registration_reminder' | 'sales_contract_reminder' | 'mediation_reminder';
}

/** 通知結果 */
export interface UpcomingDeadlineNotificationResult {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ property_number: string; notificationType: string; success: boolean; error?: string }>;
}

// ============================================================
// 日付ヘルパー
// ============================================================

const isNotBlank = (v: any): boolean => v !== null && v !== undefined && v !== '';
const isBlank = (v: any): boolean => !isNotBlank(v);

/** 日付文字列をJST基準のDateに変換（時刻部分は無視して日付のみ比較用） */
const parseDateJST = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  // "YYYY-MM-DD" 形式
  const match = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  // JST 00:00:00 として解釈
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00+09:00`);
  return isNaN(d.getTime()) ? null : d;
};

/** 今日のJST日付（00:00:00） */
const todayJST = (): Date => {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(`${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, '0')}-${String(jst.getUTCDate()).padStart(2, '0')}T00:00:00+09:00`);
};

/** deadline が today <= deadline <= today+daysAhead の範囲内か */
const isWithinDays = (dateStr: string | null | undefined, daysAhead: number): boolean => {
  const d = parseDateJST(dateStr);
  if (!d) return false;
  const t = todayJST();
  const upper = new Date(t.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  return d >= t && d <= upper;
};

// ============================================================
// WorkTaskUpcomingDeadlineNotificationService
// ============================================================

/**
 * 業務リストの締切日が迫っている場合にメール通知を送信するサービス
 *
 * 通知ルール:
 * 1. サイト登録締め日リマインダー
 *    - site_registration_deadline に入力あり
 *    - 今日〜2日後以内
 *    - site_registration_deadline が 2026-04-25 以降
 *    - cw_request_email_site が空欄
 *
 * 2. 売買契約締め日リマインダー
 *    - sales_contract_deadline に入力あり
 *    - 今日〜3日後以内
 *    - employee_contract_creation が空欄
 */
export class WorkTaskUpcomingDeadlineNotificationService {
  private supabase: SupabaseClient;
  private emailService: EmailService;

  // サイト登録締め日の対象開始日（2026-04-25以降のみ）
  private static readonly SITE_REG_START_DATE = new Date('2026-04-25T00:00:00+09:00');

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.emailService = new EmailService();
  }

  /**
   * 通知対象レコードを取得する
   */
  async getTargets(): Promise<UpcomingDeadlineTarget[]> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('property_number, site_registration_deadline, cw_request_email_site, sales_contract_deadline, employee_contract_creation, mediation_deadline, mediation_completed');

    if (error) {
      throw new Error(`[UpcomingDeadline] DB取得エラー: ${error.message}`);
    }

    const targets: UpcomingDeadlineTarget[] = [];

    for (const task of data || []) {
      // ルール1: サイト登録締め日リマインダー
      if (
        isNotBlank(task.site_registration_deadline) &&
        isWithinDays(task.site_registration_deadline, 2) &&
        isBlank(task.cw_request_email_site)
      ) {
        const d = parseDateJST(task.site_registration_deadline);
        if (d && d >= WorkTaskUpcomingDeadlineNotificationService.SITE_REG_START_DATE) {
          targets.push({
            property_number: task.property_number || '',
            notificationType: 'site_registration_reminder',
          });
        }
      }

      // ルール2: 売買契約締め日リマインダー
      if (
        isNotBlank(task.sales_contract_deadline) &&
        isWithinDays(task.sales_contract_deadline, 3) &&
        isBlank(task.employee_contract_creation)
      ) {
        targets.push({
          property_number: task.property_number || '',
          notificationType: 'sales_contract_reminder',
        });
      }

      // ルール3: 媒介作成締め日リマインダー
      if (
        isNotBlank(task.mediation_deadline) &&
        isWithinDays(task.mediation_deadline, 2) &&
        isBlank(task.mediation_completed)
      ) {
        targets.push({
          property_number: task.property_number || '',
          notificationType: 'mediation_reminder',
        });
      }
    }

    return targets;
  }

  /**
   * 通知メールを送信する
   */
  async sendNotifications(targets: UpcomingDeadlineTarget[]): Promise<UpcomingDeadlineNotificationResult> {
    const result: UpcomingDeadlineNotificationResult = { sent: 0, failed: 0, skipped: 0, details: [] };

    for (const target of targets) {
      if (!target.property_number) {
        result.skipped++;
        continue;
      }

      try {
        let subject: string;
        let body: string;

        // サイト登録タブ: tabIndex=1 → URLにクエリパラメータは不要（モーダルはクリックで開く）
        // 業務リストページのURLを案内する
        const workTasksUrl = `${FRONTEND_BASE_URL}/work-tasks`;

        if (target.notificationType === 'site_registration_reminder') {
          subject = `${target.property_number}サイト登録依頼できていません。納期が迫っています！！`;
          body = [
            `${target.property_number}サイト登録依頼を早急にお願いします`,
            '',
            `この物件詳細のURL（サイト登録タブ）: ${workTasksUrl}`,
            '※業務リストページを開き、該当物件番号をクリックしてサイト登録タブをご確認ください。',
          ].join('\n');
        } else if (target.notificationType === 'sales_contract_reminder') {
          subject = `${target.property_number}の売買契約書の締日が迫っています！！`;
          body = [
            `${target.property_number}の売買契約書が未着手です！早急に着手してください！`,
            '',
            `この物件詳細画面のURL（契約決済タブ）: ${workTasksUrl}`,
            '※業務リストページを開き、該当物件番号をクリックして契約決済タブをご確認ください。',
          ].join('\n');
        } else {
          // mediation_reminder
          subject = `${target.property_number}の媒介作成の締日が迫っています！！`;
          body = [
            `${target.property_number}の媒介作成が未完了です！早急に作成してください！`,
            '',
            `この物件詳細画面のURL（媒介契約タブ）: ${workTasksUrl}`,
            '※業務リストページを開き、該当物件番号をクリックして媒介契約タブをご確認ください。',
          ].join('\n');
        }

        await this.emailService.sendEmailWithCcAndAttachments({
          to: 'tenant@ifoo-oita.com',
          subject,
          body: body.replace(/\n/g, '<br>'),
          from: 'tenant@ifoo-oita.com',
          isHtml: true,
        });

        console.log(`[UpcomingDeadline] 送信成功: ${target.property_number} / ${target.notificationType}`);
        result.sent++;
        result.details.push({ property_number: target.property_number, notificationType: target.notificationType, success: true });
      } catch (error: any) {
        console.error(`[UpcomingDeadline] 送信失敗: ${target.property_number} / ${target.notificationType} - ${error.message}`);
        result.failed++;
        result.details.push({ property_number: target.property_number, notificationType: target.notificationType, success: false, error: error.message });
      }
    }

    return result;
  }
}
