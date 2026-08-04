import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleChatService } from './GoogleChatService';

/**
 * 営業会議チャンネル用 Webhook URL
 * 毎月第1月曜の営業会議の1週間前に、物件数チーム・契約率チームへの
 * 「問い」作成・回答入力の依頼を自動送信する
 */
const SALES_MEETING_WEBHOOK_URL =
  'https://chat.googleapis.com/v1/spaces/AAQAouqL-7E/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=4JfQY2n4nnMv_7QnDPUXzgZqYFThSgE0sYno2hTH5GU';

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

export interface SalesMeetingNotificationResult {
  sent: boolean;
  meetingDate?: string;
  reason?: string;
}

/**
 * 営業会議（毎月第1月曜）の1週間前に、物件数チーム・契約率チームへの
 * 「問い」完成・回答入力依頼をGoogle Chatへ自動送信するサービス
 */
export class SalesMeetingNotificationService {
  private chatService: GoogleChatService;
  private supabase: SupabaseClient;

  constructor() {
    this.chatService = new GoogleChatService();
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
    );
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

  /** YYYY-MM-DD 文字列を、UTC深夜0時のDateとしてパース（日付のみの純粋な計算用） */
  private parseDateOnly(dateStr: string): Date {
    return new Date(`${dateStr}T00:00:00Z`);
  }

  private formatDateOnly(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private formatJapanese(date: Date): string {
    const yyyy = date.getUTCFullYear();
    const mm = date.getUTCMonth() + 1;
    const dd = date.getUTCDate();
    const weekday = WEEKDAY_JA[date.getUTCDay()];
    return `${yyyy}年${mm}月${dd}日(${weekday})`;
  }

  /** 指定した年月の「第1月曜」を返す（year: 4桁, month: 1-12） */
  private getFirstMondayOfMonth(year: number, month: number): Date {
    let date = new Date(Date.UTC(year, month - 1, 1));
    while (date.getUTCDay() !== 1) {
      date = this.addDays(date, 1);
    }
    return date;
  }

  /**
   * 基準日（日付のみのDate）から見て、次回営業会議（毎月第1月曜）の日付を返す。
   * 基準日が今月の第1月曜以前ならその日、過ぎていれば翌月の第1月曜を返す。
   */
  getNextMeetingDate(referenceDateOnly: Date): Date {
    const year = referenceDateOnly.getUTCFullYear();
    const month = referenceDateOnly.getUTCMonth() + 1;
    const candidate = this.getFirstMondayOfMonth(year, month);

    if (candidate.getTime() >= referenceDateOnly.getTime()) {
      return candidate;
    }

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    return this.getFirstMondayOfMonth(nextYear, nextMonth);
  }

  /**
   * 営業会議日から、通知メッセージ本文を組み立てる
   * - 会議1週間前 = 通知日
   * - 会議1週間前の3日後 = 「問い」完成期限
   * - 会議1週間前の6日後 = 各自回答入力期限
   */
  buildMessage(meetingDate: Date): string {
    const oneWeekBefore = this.addDays(meetingDate, -7);
    const questionDeadline = this.addDays(oneWeekBefore, 3);
    const answerDeadline = this.addDays(oneWeekBefore, 6);

    return [
      '【営業会議 事前準備のお願い】',
      '',
      `次回営業会議: ${this.formatJapanese(meetingDate)}`,
      '',
      '■ 物件数チーム・契約率チームの「問い」を完成させてください',
      `　期限: ${this.formatJapanese(questionDeadline)}まで`,
      '　※1人各チーム毎の「問い」を1つ以上提出が必須です',
      '',
      '■ 各自の回答入力を完了させてください',
      `　期限: ${this.formatJapanese(answerDeadline)}まで`,
      '',
      'よろしくお願いします。',
    ].join('\n');
  }

  /**
   * DBに保存された手動設定の次回営業会議日を取得する。
   * 設定が無い、または設定日が本日より過去（会議が終わって古くなった）場合は null を返す。
   */
  private async getManualNextMeetingDate(todayDateOnly: Date): Promise<Date | null> {
    const { data, error } = await this.supabase
      .from('sales_meeting_settings')
      .select('next_meeting_date')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[SalesMeetingNotificationService] 手動設定の取得エラー:', error.message);
      return null;
    }

    if (!data?.next_meeting_date) {
      return null;
    }

    const manualDate = this.parseDateOnly(data.next_meeting_date);
    // 設定日が本日より前（過去）なら無効とみなし、自動計算にフォールバックする
    if (manualDate.getTime() < todayDateOnly.getTime()) {
      return null;
    }

    return manualDate;
  }

  /**
   * 次回営業会議日を決定する。
   * DBに本日以降の手動設定があればそれを優先し、無ければ「次回の第1月曜」を自動計算する。
   */
  async getEffectiveMeetingDate(todayDateOnly: Date): Promise<Date> {
    const manual = await this.getManualNextMeetingDate(todayDateOnly);
    if (manual) {
      return manual;
    }
    return this.getNextMeetingDate(todayDateOnly);
  }

  /**
   * 本日（JST）が「次回営業会議の1週間前」であれば、Google Chatへ通知を送信する。
   * それ以外の日は何もせず終了する（Cron Jobから毎日呼び出される想定）。
   * 次回営業会議日は、DBに手動設定（議題ページのヘッダーで編集）があればそれを優先する。
   */
  async sendIfScheduledDay(now: Date = new Date()): Promise<SalesMeetingNotificationResult> {
    const todayStr = this.getJSTDateString(now);
    const todayDateOnly = this.parseDateOnly(todayStr);

    const meetingDate = await this.getEffectiveMeetingDate(todayDateOnly);
    const notifyDate = this.addDays(meetingDate, -7);

    if (this.formatDateOnly(notifyDate) !== this.formatDateOnly(todayDateOnly)) {
      return {
        sent: false,
        reason: `本日は送信日ではありません（次回送信日: ${this.formatDateOnly(notifyDate)}、次回会議日: ${this.formatDateOnly(meetingDate)}）`,
      };
    }

    const message = this.buildMessage(meetingDate);
    const result = await this.chatService.sendMessage(SALES_MEETING_WEBHOOK_URL, message);

    if (!result.success) {
      throw new Error(result.error || 'Google Chatへの送信に失敗しました');
    }

    return { sent: true, meetingDate: this.formatDateOnly(meetingDate) };
  }
}
