import api from './api';
import type { PeriodKey } from '../utils/salesMeetingLossTrend';

/**
 * 営業会議「他決数推移」ページの FI/AA 別・他決件数を取得するクライアント。
 *
 * バックエンド: GET /api/sales-meeting/loss-fi-aa-stats
 * 返却は会計年度（10月始まり）の月スロット配列（index 0=10月 … 11=9月）。
 */

export type RegionBucket = {
  /** 訪問済み（営担あり）他決の月次件数（0=10月 … 11=9月） */
  visited: number[];
  /** 未訪問（営担なし）他決の月次件数（0=10月 … 11=9月） */
  unvisited: number[];
};

export type PeriodBucket = {
  FI: RegionBucket;
  AA: RegionBucket;
};

export type LossFiAaStats = Record<PeriodKey, PeriodBucket>;

export async function fetchLossFiAaStats(): Promise<LossFiAaStats> {
  const res = await api.get<{ data: LossFiAaStats }>('/api/sales-meeting/loss-fi-aa-stats');
  return res.data.data;
}
