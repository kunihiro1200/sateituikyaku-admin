import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from './EmailService';

// ============================================================
// インターフェース定義
// ============================================================

/**
 * 値下げ予約対象物件の型定義
 * Requirements: 1.1, 2.1
 */
export interface PriceReductionTarget {
  /** 物件番号 */
  property_number: string;
  /** 物件住所 */
  address: string;
  /** 値下げ予約日（YYYY-MM-DD） */
  price_reduction_scheduled_date: string;
}

/**
 * メール通知送信結果の型定義
 * Requirements: 2.1, 3.4
 */
export interface NotificationResult {
  /** 送信成功件数 */
  sent: number;
  /** 送信失敗件数 */
  failed: number;
  /** 各物件の送信詳細 */
  details: Array<{
    property_number: string;
    success: boolean;
    error?: string;
  }>;
}

// ============================================================
// 定数定義
// ============================================================

/** 通知メール送信先 */
const NOTIFICATION_TO = 'tenant@ifoo-oita.com';

/** 通知メール件名 */
const NOTIFICATION_SUBJECT = '本日すぐに値下げお願い致します！！';

// ============================================================
// PriceReductionNotificationService クラス
// ============================================================

/**
 * 値下げ予約日メール配信サービス
 *
 * property_listings テーブルの price_reduction_scheduled_date が
 * 当日（JST）と一致する物件を検出し、担当者へメール通知を送信する。
 *
 * Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 4.3
 */
export class PriceReductionNotificationService {
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
   *
   * 日付境界付近の処理:
   *   UTC 14:59 → JST 23:59（同日）
   *   UTC 15:00 → JST 翌日 00:00（翌日）
   *
   * Requirements: 1.3
   *
   * @param utcDate UTC日時
   * @returns JST の YYYY-MM-DD 文字列
   */
  getJSTDateString(utcDate: Date): string {
    // UTC+9 のオフセット（ミリ秒）
    const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
    // UTC日時に9時間を加算して JST に変換
    const jstTime = new Date(utcDate.getTime() + JST_OFFSET_MS);
    // UTC メソッドで JST の年月日を取得（オフセット適用済みのため UTC メソッドを使用）
    const yyyy = jstTime.getUTCFullYear();
    const mm = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstTime.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  /**
   * 当日（JST）の値下げ予約物件を取得する
   *
   * Supabase クライアントを使用して property_listings テーブルから
   * price_reduction_scheduled_date が当日（JST）と一致する物件を全件取得する。
   * price_reduction_scheduled_date が null の物件は除外される。
   *
   * Requirements: 1.1, 1.4
   *
   * @returns 当日の値下げ予約対象物件リスト
   */
  async getTodayTargets(): Promise<PriceReductionTarget[]> {
    // 現在の UTC 日時から JST 日付文字列を生成
    const todayJST = this.getJSTDateString(new Date());

    const { data, error } = await this.supabase
      .from('property_listings')
      .select('property_number, address, price_reduction_scheduled_date')
      .eq('price_reduction_scheduled_date', todayJST)
      .not('price_reduction_scheduled_date', 'is', null);

    if (error) {
      throw new Error(`[PriceReductionNotificationService] DB取得エラー: ${error.message}`);
    }

    return (data || []) as PriceReductionTarget[];
  }

  /**
   * 物件情報からメール本文を生成する（純粋関数）
   *
   * 本文形式:
   *   物件番号：{property_number}
   *   物件住所：{address}
   *   値下げ予約日：{price_reduction_scheduled_date}
   *
   * Requirements: 2.3
   *
   * @param target 値下げ予約対象物件
   * @returns メール本文文字列
   */
  buildEmailBody(target: PriceReductionTarget): string {
    return [
      `物件番号：${target.property_number}`,
      `物件住所：${target.address}`,
      `値下げ予約日：${target.price_reduction_scheduled_date}`,
    ].join('\n');
  }

  /**
   * 対象物件へメール通知を送信する
   *
   * 各物件に対して EmailService.sendEmail を呼び出す。
   * 1件失敗しても残りの物件の送信を継続する。
   * 各物件の送信結果（成功/失敗）をログに記録する。
   *
   * Requirements: 2.1, 2.2, 2.4, 4.3
   *
   * @param targets 値下げ予約対象物件リスト
   * @returns 送信結果（sent, failed, details）
   */
  async sendNotifications(targets: PriceReductionTarget[]): Promise<NotificationResult> {
    const result: NotificationResult = {
      sent: 0,
      failed: 0,
      details: [],
    };

    for (const target of targets) {
      try {
        const body = this.buildEmailBody(target);

        await this.emailService.sendEmail({
          to: [NOTIFICATION_TO],
          subject: NOTIFICATION_SUBJECT,
          body,
        });

        // 送信成功をログに記録
        console.log(
          `[PriceReductionNotificationService] メール送信成功: 物件番号=${target.property_number}`
        );

        result.sent += 1;
        result.details.push({
          property_number: target.property_number,
          success: true,
        });
      } catch (error: any) {
        // 送信失敗をログに記録し、次の物件へ継続
        console.error(
          `[PriceReductionNotificationService] メール送信失敗: 物件番号=${target.property_number}`,
          { error: error.message }
        );

        result.failed += 1;
        result.details.push({
          property_number: target.property_number,
          success: false,
          error: error.message,
        });
      }
    }

    return result;
  }
}
