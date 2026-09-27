import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService';

/** 通知メール送信先（本日公開通知） */
const RECIPIENTS = [
  'tenant@ifoo-oita.com',
  'jyuna.wada@ifoo-oita.com',
  'mariko.kume@ifoo-oita.com',
  'yurine.kimura@ifoo-oita.com',
];

/** 本日公開予定の物件 */
export interface PublicationTarget {
  property_number: string;
  property_address: string | null;
  publish_scheduled_date: string | null;
}

export interface PublicationNotificationResult {
  sent: number;
  targetCount: number;
}

/**
 * 本日公開物件メール通知サービス
 *
 * work_tasks.publish_scheduled_date（公開予定日）が当日（JST）と一致する物件を
 * 検出し、担当者4名へメール通知する。1通のメールに当日公開予定の全物件をまとめて記載する。
 * 値下げ予約日メール（PriceReductionNotificationService）と同じ日次cronパターン。
 */
export class PublicationNotificationService {
  private supabase: SupabaseClient;
  private emailService: EmailService;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.emailService = new EmailService();
  }

  /**
   * UTC日時から JST（UTC+9）の YYYY-MM-DD 文字列を返す（純粋関数）
   */
  getJSTDateString(utcDate: Date): string {
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    const jstTime = new Date(utcDate.getTime() + JST_OFFSET_MS);
    const yyyy = jstTime.getUTCFullYear();
    const mm = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstTime.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * 当日（JST）に公開予定の物件を取得する。
   * work_tasks.publish_scheduled_date（公開予定日）が当日と一致するものを全件取得。
   */
  async getTodayTargets(): Promise<PublicationTarget[]> {
    const todayJST = this.getJSTDateString(new Date());

    const { data, error } = await this.supabase
      .from('work_tasks')
      .select('property_number, property_address, publish_scheduled_date')
      .eq('publish_scheduled_date', todayJST)
      .not('publish_scheduled_date', 'is', null);

    if (error) {
      throw new Error(`[PublicationNotificationService] DB取得エラー: ${error.message}`);
    }

    return (data || []) as PublicationTarget[];
  }

  /**
   * 当日公開物件リストからメール本文を生成する（純粋関数）
   */
  buildEmailBody(targets: PublicationTarget[], todayJST: string): string {
    const lines: string[] = [];
    lines.push('お疲れ様です。');
    lines.push('');
    lines.push(`本日（${todayJST}）公開予定の物件は以下の通りです。（${targets.length}件）`);
    lines.push('');
    targets.forEach((t, i) => {
      lines.push(`${i + 1}. 物件番号：${t.property_number}`);
      lines.push(`   物件住所：${t.property_address || '（住所未登録）'}`);
      lines.push('');
    });
    return lines.join('\n');
  }

  /**
   * 当日公開物件の通知メールを4名へ送信する。
   * 対象が0件の場合はメールを送らない。
   */
  async sendNotification(targets: PublicationTarget[]): Promise<PublicationNotificationResult> {
    if (targets.length === 0) {
      return { sent: 0, targetCount: 0 };
    }

    const todayJST = this.getJSTDateString(new Date());
    const subject = `【本日公開】本日公開予定の物件（${targets.length}件）`;
    const body = this.buildEmailBody(targets, todayJST);

    await this.emailService.sendEmail({
      to: RECIPIENTS,
      subject,
      body,
    });

    console.log(
      `[PublicationNotificationService] メール送信成功: 宛先=${RECIPIENTS.length}名, 対象物件=${targets.length}件`
    );

    return { sent: RECIPIENTS.length, targetCount: targets.length };
  }
}
