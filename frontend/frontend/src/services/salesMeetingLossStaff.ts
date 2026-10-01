import api from './api';
import type { PeriodKey } from '../utils/salesMeetingLossTrend';

/**
 * 営業会議「他決数推移」ページの担当別・各指標を取得するクライアント。
 *
 * バックエンド: GET /api/sales-meeting/loss-staff-stats
 * 返却は会計年度（10月始まり）の月スロット配列（index 0=10月 … 11=9月）。
 * 担当は employees マスタの現行イニシャルに正規化済み（旧名義は含まない）。
 */

/** 担当別指標のキー */
export type StaffMetricKey =
  | 'visitAssessment' // 訪問査定数（営担 × 訪問日）
  | 'exclusive' //      専任媒介数（営担 × 専任ステータス × 契約年月）
  | 'loss' //           他決数（営担 × 他決ステータス × 契約年月）
  | 'general' //        一般媒介数（営担 × 一般媒介 × 契約年月）
  | 'firstCall' //      一番電話（first_call_person × 反響日付）
  | 'visitGet' //       訪問査定取得数（訪問査定取得者 × 訪問取得日）
  | 'assessment' //     査定額算出（査定担当 × 反響日付）
  | 'followupCall' //   追客電話（売主追客ログ）
  // FI（福岡）売主限定の担当別版
  | 'visitAssessmentFi'
  | 'exclusiveFi'
  | 'lossFi'
  | 'generalFi'
  | 'firstCallFi'
  | 'visitGetFi'
  | 'assessmentFi'
  | 'followupCallFi';

/** initial -> 会計月スロット配列(0=10月…11=9月) */
export type MetricByInitial = Record<string, number[]>;

export type StaffPeriodBucket = Record<StaffMetricKey, MetricByInitial>;

export type LossStaffStats = Record<PeriodKey, StaffPeriodBucket>;

export interface LossStaffStatsResponse {
  data: LossStaffStats;
  /** 追客ログ（Google Sheets）が読めたか。false のときは追客電話が空。 */
  followupCallAvailable: boolean;
}

export async function fetchLossStaffStats(): Promise<LossStaffStatsResponse> {
  const res = await api.get<LossStaffStatsResponse>('/api/sales-meeting/loss-staff-stats');
  return res.data;
}
