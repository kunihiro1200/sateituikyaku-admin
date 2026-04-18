/** 訪問統計APIのレスポンス型（statsByEmployee の各要素） */
export interface VisitStatEntry {
  initials: string;
  name: string;
  count: number;
  employeeId: string;
}

/** 訪問統計APIのレスポンス型 */
export interface VisitStatsResponse {
  month: string;
  totalVisits: number;
  statsByEmployee: VisitStatEntry[];
  yamamotoStats: { count: number; rate: number; name: string; initials: string } | null;
}

/**
 * 角井（I）の訪問査定割合を計算する純粋関数
 * 山本マネージャー（Y）の件数を分母から除外する
 *
 * @param stats - visit-stats APIのレスポンス
 * @param yamamotoInitials - 山本マネージャーのイニシャル（デフォルト: 'Y'）
 * @returns 割合（0〜100）。対象メンバーの合計が0件の場合は0を返す
 */
export function calcKadoiVisitRatio(
  stats: VisitStatsResponse,
  yamamotoInitials: string = 'Y'
): number {
  // 山本マネージャーの件数を除外した分母を計算
  const yamamotoCount = stats.yamamotoStats?.count ?? 0;
  const denominator = stats.totalVisits - yamamotoCount;

  // ゼロ除算安全
  if (denominator <= 0) {
    return 0;
  }

  // 角井（I）の件数を取得
  const kadoiEntry = stats.statsByEmployee.find((e) => e.initials === 'I');
  const kadoiCount = kadoiEntry?.count ?? 0;

  return (kadoiCount / denominator) * 100;
}
