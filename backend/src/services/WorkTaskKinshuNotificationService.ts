import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService.supabase';
import { StaffManagementService } from './StaffManagementService';

// ============================================================
// インターフェース定義
// ============================================================

/** 通知対象タスクの型 */
export interface KinshuNotificationTarget {
  property_number: string;
  property_address: string;
  sales_assignee: string;
  settlement_date: string;
  assignee_email: string | null;
}

/** 通知結果 */
export interface KinshuNotificationResult {
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{
    property_number: string;
    success: boolean;
    assignee_email?: string | null;
    error?: string;
  }>;
}

// ============================================================
// 日付ヘルパー
// ============================================================

const isNotBlank = (v: any): boolean => v !== null && v !== undefined && v !== '';
const isBlank = (v: any): boolean => !isNotBlank(v);

const parseDate = (s: string | null | undefined): Date | null => {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
};

/** 今日の日付（JST、時刻なし） */
const todayJST = (): Date => {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst;
};

/** 日付が基準日以降かどうか */
const dateGte = (s: string | null | undefined, ref: Date): boolean => {
  const d = parseDate(s);
  if (!d) return false;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  jst.setUTCHours(0, 0, 0, 0);
  return jst >= ref;
};

// 金種表送付未の基準日（2026/5/20以降の決済日のみ対象）
const DENOMINATION_BASE_DATE = new Date('2026-05-20');

/**
 * タスクが「金種表送付　未」カテゴリーに該当するか判定
 * workTaskStatusUtils.ts の calculateTaskStatus() の 0b ブロックと同等
 */
function isKinshuMi(task: Record<string, any>): boolean {
  if (isBlank(task.settlement_date)) return false;
  if (isBlank(task.sales_contract_deadline)) return false;
  if (!dateGte(task.settlement_date, DENOMINATION_BASE_DATE)) return false;

  const settlementD = parseDate(task.settlement_date);
  if (!settlementD) return false;

  // 決済日の1週間前
  const oneWeekBefore = new Date(settlementD);
  oneWeekBefore.setDate(oneWeekBefore.getDate() - 7);
  oneWeekBefore.setHours(0, 0, 0, 0);

  const today = todayJST();
  // 今日が1週間前以降 かつ 売主・買主の金種表メールが両方未送信
  return (
    today >= oneWeekBefore &&
    isBlank(task.settlement_seller_denomination_email) &&
    isBlank(task.settlement_buyer_denomination_email)
  );
}

// ============================================================
// WorkTaskKinshuNotificationService
// ============================================================

/**
 * 業務リストで「金種表送付　未」に該当するタスクを毎日 JST 09:00 に
 * 営業担当のメールアドレスへ通知するサービス。
 *
 * Vercel Cron から /api/cron/work-task-kinshu-notification へ
 * UTC 00:00（= JST 09:00）に呼び出される。
 */
export class WorkTaskKinshuNotificationService {
  private supabase: SupabaseClient;
  private emailService: EmailService;
  private staffService: StaffManagementService;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    this.emailService = new EmailService();
    this.staffService = new StaffManagementService();
  }

  /**
   * 「金種表送付　未」に該当するタスクを取得し、
   * 営業担当のメールアドレスを付与して返す
   */
  async getKinshuMiTargets(): Promise<KinshuNotificationTarget[]> {
    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('*');

    if (error) {
      throw new Error(`[WorkTaskKinshu] DB取得エラー: ${error.message}`);
    }

    const targets: KinshuNotificationTarget[] = [];

    for (const task of data || []) {
      if (!isKinshuMi(task)) continue;

      // 営業担当のメールアドレスを取得
      const assigneeEmail = await this.resolveAssigneeEmail(task.sales_assignee);

      targets.push({
        property_number: task.property_number || '',
        property_address: task.property_address || '',
        sales_assignee: task.sales_assignee || '',
        settlement_date: task.settlement_date || '',
        assignee_email: assigneeEmail,
      });
    }

    return targets;
  }

  /**
   * 営業担当（イニシャルまたは名前）からメールアドレスを解決する
   */
  private async resolveAssigneeEmail(salesAssignee: string | null): Promise<string | null> {
    if (!salesAssignee) return null;

    try {
      // イニシャルで検索
      const staffByInitials = await this.staffService.getStaffByInitials(salesAssignee);
      if (staffByInitials?.email) return staffByInitials.email;

      // 名前の部分一致で検索
      const staffByName = await this.staffService.getStaffByNameContains(salesAssignee);
      if (staffByName?.email) return staffByName.email;

      console.warn(`[WorkTaskKinshu] 営業担当「${salesAssignee}」のメールアドレスが見つかりませんでした`);
      return null;
    } catch (err: any) {
      console.error(`[WorkTaskKinshu] メールアドレス解決エラー (${salesAssignee}):`, err.message);
      return null;
    }
  }

  /**
   * 通知メールを送信する
   */
  async sendNotifications(
    targets: KinshuNotificationTarget[]
  ): Promise<KinshuNotificationResult> {
    const result: KinshuNotificationResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    for (const target of targets) {
      if (!target.property_number) {
        result.skipped++;
        continue;
      }

      // 営業担当のメールアドレスが取得できない場合はスキップ
      if (!target.assignee_email) {
        console.warn(
          `[WorkTaskKinshu] スキップ: ${target.property_number} / 営業担当「${target.sales_assignee}」のメールアドレス未設定`
        );
        result.skipped++;
        result.details.push({
          property_number: target.property_number,
          success: false,
          assignee_email: null,
          error: `営業担当「${target.sales_assignee}」のメールアドレスが未設定`,
        });
        continue;
      }

      try {
        const subject = `【金種表送付　未】${target.property_address}／${target.property_number}`;
        const bodyLines = [
          `${target.sales_assignee} 様`,
          '',
          '以下の物件で「金種表送付　未」が上がっています。',
          '売主・買主への金種表送付をご確認ください。',
          '',
          `物件番号：${target.property_number}`,
          `物件住所：${target.property_address}`,
          `決済日：${target.settlement_date}`,
          '',
          '対応済みの場合は業務リストの「決済前、売主金種表連絡メール」「決済前、買主金種表連絡メール」に「済」を入力してください。',
          '',
          '㈱いふう',
        ];

        await this.emailService.sendEmailWithCcAndAttachments({
          to: target.assignee_email,
          cc: 'tenant@ifoo-oita.com',
          subject,
          body: bodyLines.join('<br>'),
          from: 'tenant@ifoo-oita.com',
          isHtml: true,
        });

        console.log(
          `[WorkTaskKinshu] 送信成功: ${target.property_number} → ${target.assignee_email}`
        );
        result.sent++;
        result.details.push({
          property_number: target.property_number,
          success: true,
          assignee_email: target.assignee_email,
        });
      } catch (err: any) {
        console.error(
          `[WorkTaskKinshu] 送信失敗: ${target.property_number}`,
          err.message
        );
        result.failed++;
        result.details.push({
          property_number: target.property_number,
          success: false,
          assignee_email: target.assignee_email,
          error: err.message,
        });
      }
    }

    return result;
  }
}
