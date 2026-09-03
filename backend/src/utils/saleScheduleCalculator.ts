/**
 * 売却スケジュールの逆算ロジック。
 *
 * 既存の資料生成「売却スケジュール」（frontend/frontend/src/components/SaleScheduleModal.tsx の calcDates()）
 * は「今日」を起点に順算する設計だが、売却サポートページでは「いつまでに売りたいか」を
 * 起点に逆算する必要がある。
 *
 * 🚨 新しい期間を勝手に設定しない。既存の calcDates() が使っている期間オフセットをそのまま使い、
 * 順算ではなく逆算する点だけが異なる。
 *
 * 既存の期間オフセット（SaleScheduleModal.tsx calcDates()より）:
 *   STEP1 販売開始   → 起点
 *   STEP2 販売活動強化 → 開始+1ヶ月 〜 開始+2ヶ月
 *   STEP3 売買契約   → 開始+3ヶ月
 *   STEP4 決済・引渡し → 契約+1ヶ月（= 開始+4ヶ月）
 */

export interface SaleScheduleInput {
  desiredSettlementYear: number;
  desiredSettlementMonth: number; // 1-12
}

export interface SaleScheduleResult {
  startYear: number;
  startMonth: number;
  marketingYear: number;
  marketingStartMonth: number;
  marketingEndYear: number;
  marketingEndMonth: number;
  contractYear: number;
  contractMonth: number;
  settlementYear: number;
  settlementMonth: number;
}

/** year/monthに対してnヶ月加算（負数で減算）した結果のyear/monthを返す */
function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return { year: newYear, month: newMonth };
}

/**
 * 「いつまでに売りたいか」（決済・引渡し希望月）から逆算して、
 * 売買契約・販売活動強化・販売開始の各時期を算出する。
 */
export function calculateSaleScheduleFromSettlement(input: SaleScheduleInput): SaleScheduleResult {
  const settlement = { year: input.desiredSettlementYear, month: input.desiredSettlementMonth };

  // 決済・引渡し = 売買契約 + 1ヶ月 → 売買契約 = 決済 - 1ヶ月
  const contract = addMonths(settlement.year, settlement.month, -1);

  // 売買契約 = 販売開始 + 3ヶ月 → 販売開始 = 売買契約 - 3ヶ月
  const start = addMonths(contract.year, contract.month, -3);

  // 販売活動強化 = 販売開始 + 1ヶ月 〜 +2ヶ月
  const marketingStart = addMonths(start.year, start.month, 1);
  const marketingEnd = addMonths(start.year, start.month, 2);

  return {
    startYear: start.year,
    startMonth: start.month,
    marketingYear: marketingStart.year,
    marketingStartMonth: marketingStart.month,
    marketingEndYear: marketingEnd.year,
    marketingEndMonth: marketingEnd.month,
    contractYear: contract.year,
    contractMonth: contract.month,
    settlementYear: settlement.year,
    settlementMonth: settlement.month,
  };
}
