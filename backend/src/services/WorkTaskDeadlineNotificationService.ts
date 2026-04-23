import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService.supabase';

// フロントエンドのcalculateTaskStatusに依存しないよう、
// バックエンド用に同等のロジックをインライン実装する

/** 通知対象物件の型 */
export interface DeadlineTarget {
  property_number: string;
  property_address: string;
  category: string; // ステータス文字列（例: "サイト登録依頼してください 4/22"）
}

/** 通知結果 */
export interface DeadlineNotificationResult {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ property_number: string; success: boolean; error?: string }>;
}

// ============================================================
// 日付ヘルパー（バックエンド用）
// ============================================================

const isNotBlank = (v: any): boolean => v !== null && v !== undefined && v !== '';
const isBlank = (v: any): boolean => !isNotBlank(v);

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

const formatDateMD = (s: string | null | undefined): string => {
  const d = parseDate(s);
  if (!d) return '';
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const todayJST = (): Date => {
  const now = new Date();
  // UTC+9
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst;
};

const dateGte = (s: string | null | undefined, ref: Date): boolean => {
  const d = parseDate(s);
  if (!d) return false;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst >= ref;
};

const dateLte = (s: string | null | undefined, ref: Date): boolean => {
  const d = parseDate(s);
  if (!d) return false;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst <= ref;
};

const dateLt = (s: string | null | undefined, ref: Date): boolean => {
  const d = parseDate(s);
  if (!d) return false;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst < ref;
};

const BASE_DATE = new Date('2025-05-26');
const SITE_REG_BASE_DATE = new Date('2025-10-30');

/** バックエンド用ステータス計算（workTaskStatusUtils.tsと同等） */
function calcStatus(task: Record<string, any>): string {
  const t = todayJST();

  if (task.sales_contract_confirmed === '確認中') {
    return `売買契約　営業確認中${formatDateMD(task.sales_contract_deadline)}`;
  }
  if (
    isNotBlank(task.sales_contract_deadline) &&
    isBlank(task.binding_scheduled_date) &&
    isBlank(task.on_hold) &&
    isBlank(task.binding_completed) &&
    (isBlank(task.settlement_date) || dateGte(task.settlement_date, t)) &&
    (isNotBlank(task.hirose_request_sales) || isNotBlank(task.cw_request_sales) || isNotBlank(task.employee_contract_creation)) &&
    isBlank(task.accounting_confirmed) &&
    (isBlank(task.cw_completed_email_sales) || isBlank(task.work_completed_chat_hirose))
  ) {
    return `売買契約 入力待ち ${formatDateMD(task.sales_contract_deadline)} ${task.sales_contract_assignee || ''}`.trimEnd();
  }
  if (
    isBlank(task.site_registration_requestor) &&
    isBlank(task.on_hold) &&
    isBlank(task.distribution_date) &&
    isBlank(task.publish_scheduled_date) &&
    isNotBlank(task.site_registration_deadline) &&
    isBlank(task.sales_contract_deadline)
  ) {
    return `サイト登録依頼してください ${formatDateMD(task.site_registration_deadline)}`;
  }
  if (
    dateLte(task.settlement_date, t) &&
    dateGte(task.settlement_date, BASE_DATE) &&
    isNotBlank(task.settlement_date) &&
    isBlank(task.settlement_completed_chat) &&
    isNotBlank(task.sales_contract_deadline)
  ) {
    return '決済完了チャット送信未';
  }
  if (
    isNotBlank(task.settlement_completed_chat) &&
    (isBlank(task.accounting_confirmed) || task.accounting_confirmed === '未') &&
    isNotBlank(task.sales_contract_deadline)
  ) {
    return '入金確認未';
  }
  if (
    isBlank(task.ledger_created) &&
    isBlank(task.on_hold) &&
    isNotBlank(task.settlement_date) &&
    dateLt(task.settlement_date, t) &&
    isNotBlank(task.sales_contract_deadline)
  ) {
    return '要台帳作成';
  }
  if (
    isNotBlank(task.sales_contract_deadline) &&
    isNotBlank(task.binding_scheduled_date) &&
    task.sales_contract_confirmed === '確認OK' &&
    isBlank(task.on_hold) &&
    isBlank(task.binding_completed)
  ) {
    return `売買契約 製本待ち ${formatDateMD(task.binding_scheduled_date)} ${task.sales_contract_assignee || ''}`.trimEnd();
  }
  if (
    isNotBlank(task.sales_contract_deadline) &&
    isBlank(task.binding_scheduled_date) &&
    isBlank(task.binding_completed) &&
    (isBlank(task.settlement_date) || dateGte(task.settlement_date, t)) &&
    isBlank(task.accounting_confirmed) &&
    isBlank(task.on_hold) &&
    isBlank(task.hirose_request_sales) &&
    isBlank(task.cw_request_sales)
  ) {
    return `売買契約 依頼未 締日${formatDateMD(task.sales_contract_deadline)} ${task.sales_contract_assignee || ''}`.trimEnd();
  }
  if (
    isBlank(task.site_registration_confirm_request_date) &&
    isBlank(task.sales_contract_deadline) &&
    isNotBlank(task.site_registration_deadline) &&
    task.site_registration_confirmed !== '完了' &&
    dateGte(task.site_registration_deadline, SITE_REG_BASE_DATE)
  ) {
    return 'サイト依頼済み納品待ち';
  }
  if (
    isNotBlank(task.site_registration_confirm_request_date) &&
    isBlank(task.site_registration_confirmed)
  ) {
    return `サイト登録要確認 ${formatDateMD(task.site_registration_deadline)}`;
  }
  if (
    isBlank(task.mediation_completed) &&
    isNotBlank(task.mediation_deadline) &&
    isBlank(task.distribution_date) &&
    isBlank(task.sales_contract_deadline) &&
    isBlank(task.on_hold)
  ) {
    return `媒介作成_締日（${formatDateMD(task.mediation_deadline)}`;
  }
  if (isNotBlank(task.on_hold)) {
    return '保留';
  }
  return '';
}

/**
 * ステータス文字列から締切日（M/D）を抽出して当日かどうか判定
 * 例: "サイト登録依頼してください 4/22" → "4/22" → 当日なら true
 */
function isDeadlineToday(status: string): boolean {
  const match = status.match(/(\d{1,2})\/(\d{1,2})/);
  if (!match) return false;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  const t = todayJST();
  return t.getUTCMonth() + 1 === month && t.getUTCDate() === day;
}

// ============================================================
// WorkTaskDeadlineNotificationService
// ============================================================

/**
 * 業務リストの締切日当日にメール通知を送信するサービス
 * 毎日 JST 09:00（UTC 00:00）に Vercel Cron から呼び出される
 */
export class WorkTaskDeadlineNotificationService {
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
   * 当日締切の業務タスクを取得する
   */
  async getTodayDeadlineTargets(): Promise<DeadlineTarget[]> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('*');

    if (error) {
      throw new Error(`[WorkTaskDeadline] DB取得エラー: ${error.message}`);
    }

    const targets: DeadlineTarget[] = [];

    for (const task of data || []) {
      const status = calcStatus(task);
      if (!status) continue;
      if (!isDeadlineToday(status)) continue;
      // サイト登録は1時間前通知（BusinessSiteDeadlineHourlyNotificationService）に任せる
      if (status.startsWith('サイト登録依頼してください')) continue;

      targets.push({
        property_number: task.property_number || '',
        property_address: task.property_address || '',
        category: status,
      });
    }

    return targets;
  }

  /**
   * 通知メールを送信する
   */
  async sendNotifications(targets: DeadlineTarget[]): Promise<DeadlineNotificationResult> {
    const result: DeadlineNotificationResult = { sent: 0, failed: 0, skipped: 0, details: [] };

    for (const target of targets) {
      if (!target.property_number) {
        result.skipped++;
        continue;
      }

      try {
        const subject = `${target.category}／${target.property_address}／　本日締め切りです`;
        const body = [
          `物件番号：${target.property_number}`,
          `物件住所：${target.property_address}`,
          `本日${target.category}において締め切りです。遅れる可能性がある場合は担当、上長に相談してください。`,
        ].join('\n');

        await this.emailService.sendEmailWithCcAndAttachments({
          to: 'tenant@ifoo-oita.com',
          subject,
          body: body.replace(/\n/g, '<br>'),
          from: 'tenant@ifoo-oita.com',
          isHtml: true,
        });

        console.log(`[WorkTaskDeadline] 送信成功: ${target.property_number} / ${target.category}`);
        result.sent++;
        result.details.push({ property_number: target.property_number, success: true });
      } catch (error: any) {
        console.error(`[WorkTaskDeadline] 送信失敗: ${target.property_number}`, error.message);
        result.failed++;
        result.details.push({ property_number: target.property_number, success: false, error: error.message });
      }
    }

    return result;
  }
}
