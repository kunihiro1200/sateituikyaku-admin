import { sellerPortalApi, ValuationSummary } from '../../services/sellerPortalApi';

export type YesNoUnknown = 'yes' | 'no' | 'unknown';

export type DetailedProceedsAnswers = {
  hasLoan?: YesNoUnknown; // 住宅ローン残高の有無＝抵当権の有無として扱う（重複質問を避ける）
  loanBalanceMan?: string;
  isOwner?: YesNoUnknown; // 名義人が売主本人かどうか（3000万円特別控除の要件）
  isResident?: YesNoUnknown; // 現在居住しているか（3000万円特別控除の要件）
  moveOutYear?: string; // 居住していない場合、住民票を移した年（3年以内かどうかの判定用）
  acquisitionKnown?: 'yes' | 'no';
  acquisitionCostMan?: string;
  purchaseYear?: string;
};

export interface DetailedProceedsResult {
  rows: any[];
  qualifiesForSpecialDeduction: boolean;
  /** 譲渡所得税の計算根拠（チャレンジ価格ベース）。税額が発生しない場合はnull。 */
  taxBreakdown: any | null;
}

/**
 * 詳細な手残り計算の共通ロジック。
 * NetProceedsCard（既存の回答があればページ表示時に自動計算）と
 * DetailedProceedsWizard（新規回答後の計算）の両方から呼ばれる。
 * 回答内容は known_facts に保存するので、次回ページを開いたときも再質問せずに表示できる。
 */
export async function calculateDetailedProceeds(
  token: string,
  sellerNumber: string,
  valuation: ValuationSummary | null,
  answers: DetailedProceedsAnswers
): Promise<DetailedProceedsResult> {
  const currentYear = new Date().getFullYear();

  // 住宅ローン残高あり＝抵当権あり として扱う（別途「抵当権の有無」は聞かない）
  const hasMortgage = answers.hasLoan === 'yes';
  const isFiSeller = sellerNumber.trim().toUpperCase().includes('FI');
  const mortgageReleaseFee = hasMortgage ? (isFiSeller ? 50_000 : 30_000) : 0;
  const loanBalance = answers.hasLoan === 'yes' ? Math.round(parseFloat(answers.loanBalanceMan || '0') * 10_000) : 0;

  const mode: 'unknown' | 'known' = answers.acquisitionKnown === 'yes' ? 'known' : 'unknown';

  const moveOutYearParsed = answers.moveOutYear ? parseInt(answers.moveOutYear, 10) : undefined;
  const withinThreeYears = moveOutYearParsed !== undefined && currentYear <= moveOutYearParsed + 3;
  const qualifies = answers.isOwner === 'yes' && (answers.isResident === 'yes' || withinThreeYears);
  const maxPriceYen = valuation?.maximumPrice ?? 0;
  const skipAcquisition = qualifies && maxPriceYen <= 50_000_000;

  // 取得費質問をスキップした場合（3000万円控除適用・高額でない場合）は、
  // 「控除だけで課税所得が吸収される」前提として税額を0にする。
  // （取得費不明時の5%簡便法を使うと、控除を差し引いてもゼロにならないため）
  const assumeFullyCoveredBySpecialDeduction = skipAcquisition && qualifies;

  // 回答一式をまとめて1つのキーに保存する（次回開いたときに質問し直さず表示するため）
  await sellerPortalApi.saveKnownFacts(token, {
    detailed_proceeds_answers: answers,
  });

  const res = await sellerPortalApi.getDetailedProceeds(token, {
    loanBalance,
    mortgageReleaseFee,
    transferTax: {
      mode,
      acquisitionCost: answers.acquisitionCostMan ? Math.round(parseFloat(answers.acquisitionCostMan) * 10_000) : undefined,
      purchaseYear: answers.purchaseYear ? parseInt(answers.purchaseYear, 10) : undefined,
      specialDeduction: qualifies ? 30_000_000 : 0,
      assumeFullyCoveredBySpecialDeduction,
    },
  });

  return { rows: res.rows, qualifiesForSpecialDeduction: qualifies, taxBreakdown: res.taxBreakdown };
}
