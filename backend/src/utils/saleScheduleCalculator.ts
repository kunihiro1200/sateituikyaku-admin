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
  /** 期間が短く圧縮されたため、販売活動強化期間を明示的に表示できない場合はnull */
  marketingYear: number | null;
  marketingStartMonth: number | null;
  marketingEndYear: number | null;
  marketingEndMonth: number | null;
  contractYear: number;
  contractMonth: number;
  settlementYear: number;
  settlementMonth: number;
  /** 標準期間（4ヶ月）より短く圧縮されたスケジュールかどうか。画面側で注記を出す判定に使う */
  isCompressed: boolean;
}

/** year/monthに対してnヶ月加算（負数で減算）した結果のyear/monthを返す */
function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const totalMonths = year * 12 + (month - 1) + delta;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return { year: newYear, month: newMonth };
}

/** year/month の組を比較用の連番（年×12+月）に変換する */
function toMonthIndex(year: number, month: number): number {
  return year * 12 + month;
}

/**
 * 「いつまでに売りたいか」（決済・引渡し希望月）から逆算して、
 * 売買契約・販売活動強化・販売開始の各時期を算出する。
 *
 * 🚨 重要：販売開始は「今日（今月）」より過去にはできない。
 * 標準の期間（開始→+3ヶ月で契約→+1ヶ月で決済、計4ヶ月）で逆算した結果、
 * 開始が今月より前になってしまう場合は、開始を今月に固定し、
 * 残りの期間（今月から決済月までの月数）に契約・決済を圧縮して収める。
 */
export function calculateSaleScheduleFromSettlement(
  input: SaleScheduleInput,
  today?: Date
): SaleScheduleResult {
  const settlement = { year: input.desiredSettlementYear, month: input.desiredSettlementMonth };

  // 🚨 タイムゾーンルール：サーバー（Vercel）はUTCで動作するため、new Date()の
  // getFullYear()/getMonth()をそのまま使うと日本時間との年月ズレが起きうる（月末深夜等）。
  // JST基準の「今日」から年月を求める（getTodayJSTと同じ+9時間オフセットの考え方）。
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const base = today ?? new Date();
  const jst = new Date(base.getTime() + JST_OFFSET_MS);
  const currentYear = jst.getUTCFullYear();
  const currentMonth = jst.getUTCMonth() + 1;

  // 標準ルールでの逆算（決済-1ヶ月=契約、契約-3ヶ月=開始）
  const standardContract = addMonths(settlement.year, settlement.month, -1);
  const standardStart = addMonths(standardContract.year, standardContract.month, -3);

  const todayIndex = toMonthIndex(currentYear, currentMonth);
  const standardStartIndex = toMonthIndex(standardStart.year, standardStart.month);

  if (standardStartIndex >= todayIndex) {
    // 標準ルールのままで開始が今月以降に収まる場合はそのまま使う
    const marketingStart = addMonths(standardStart.year, standardStart.month, 1);
    const marketingEnd = addMonths(standardStart.year, standardStart.month, 2);
    return {
      startYear: standardStart.year,
      startMonth: standardStart.month,
      marketingYear: marketingStart.year,
      marketingStartMonth: marketingStart.month,
      marketingEndYear: marketingEnd.year,
      marketingEndMonth: marketingEnd.month,
      contractYear: standardContract.year,
      contractMonth: standardContract.month,
      settlementYear: settlement.year,
      settlementMonth: settlement.month,
      isCompressed: false,
    };
  }

  // 標準ルールだと開始が過去になってしまう → 開始を今月に固定し、圧縮する
  const start = { year: currentYear, month: currentMonth };
  const settlementIndex = toMonthIndex(settlement.year, settlement.month);
  const availableMonths = settlementIndex - todayIndex; // 今月から決済月までの月数

  // 契約は「決済の1ヶ月前」を基本としつつ、開始より前にはできない
  const idealContract = addMonths(settlement.year, settlement.month, -1);
  const idealContractIndex = toMonthIndex(idealContract.year, idealContract.month);
  const contract = idealContractIndex >= todayIndex ? idealContract : { year: start.year, month: start.month };

  // 活動強化期間は「開始〜契約」の間に収まる場合のみ表示する（収まらない場合は非表示にする）
  const contractIndex = toMonthIndex(contract.year, contract.month);
  const canShowMarketing = contractIndex - todayIndex >= 2; // 開始と契約の間に最低1ヶ月の余白がある場合のみ
  const marketingStart = canShowMarketing ? addMonths(start.year, start.month, 1) : null;
  const marketingEnd = canShowMarketing
    ? addMonths(start.year, start.month, Math.min(2, contractIndex - todayIndex - 1))
    : null;

  return {
    startYear: start.year,
    startMonth: start.month,
    marketingYear: marketingStart?.year ?? null,
    marketingStartMonth: marketingStart?.month ?? null,
    marketingEndYear: marketingEnd?.year ?? null,
    marketingEndMonth: marketingEnd?.month ?? null,
    contractYear: contract.year,
    contractMonth: contract.month,
    settlementYear: settlement.year,
    settlementMonth: settlement.month,
    isCompressed: true,
  };
}
