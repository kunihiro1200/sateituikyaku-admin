/**
 * 手残り金額計算の共通ロジック。
 *
 * frontend/frontend/src/components/NetProceedsListModal.tsx の
 * calcBrokerageFee / calcStampDuty / calcTransferTax と同一の計算式を
 * バックエンドから再利用できるように移植したもの。
 *
 * 🚨 計算式自体は既存の資料生成機能（手残りリスト）と完全に一致させること。
 * ロジックを変更する場合は NetProceedsListModal.tsx 側も合わせて変更する。
 */

/** 仲介手数料（税込）: 800万以下→33万円、それ以外→売買価格×3%+6万×1.1 */
export const calcBrokerageFee = (priceYen: number): number => {
  if (priceYen <= 8_000_000) return 330_000;
  return Math.round((priceYen * 0.03 + 60_000) * 1.1);
};

/** 売買契約書印紙代（軽減税率適用後の現行額） */
export const calcStampDuty = (priceYen: number): number => {
  if (priceYen <= 100_000) return 200;
  if (priceYen <= 500_000) return 200;
  if (priceYen <= 1_000_000) return 500;
  if (priceYen <= 5_000_000) return 1_000;
  if (priceYen <= 10_000_000) return 5_000;
  if (priceYen <= 50_000_000) return 10_000;
  if (priceYen <= 100_000_000) return 30_000;
  if (priceYen <= 500_000_000) return 60_000;
  if (priceYen <= 1_000_000_000) return 160_000;
  return 320_000;
};

/** 建物の減価償却率（木造、耐用年数22年相当） */
const DEPRECIATION_RATE_WOOD = 0.046;

export interface TransferTaxInput {
  mode: 'unknown' | 'known' | 'none' | 'unknown_mortgage' | 'none_mortgage' | 'known_mortgage';
  salePrice: number; // 円
  acquisitionCost?: number; // 円（取得費明確の場合）
  purchaseYear?: number; // 購入年（建物減価償却計算用）
  saleYear?: number; // 売却年（所有期間計算用）
  landRatio?: number; // 土地割合 0~1（デフォルト0.3）
  buildingRatio?: number; // 建物割合（デフォルト0.7）
  /** 3000万円特別控除等の特別控除額（円）。適用可否の判定はAPI呼び出し側の質問フローで行う */
  specialDeduction?: number;
}

export interface TransferTaxResult {
  taxAmount: number;
  taxableGain: number;
  acquisitionCostUsed: number;
  holdingYears: number;
  isLongTerm: boolean;
  depreciationAmount: number;
  buildingAcquisitionCost: number;
  specialDeductionApplied: number;
}

/** 譲渡所得税の概算計算 */
export const calcTransferTax = (input: TransferTaxInput): TransferTaxResult => {
  const currentYear = new Date().getFullYear();
  const saleYear = input.saleYear ?? currentYear;

  if (input.mode === 'none' || input.mode === 'none_mortgage') {
    return {
      taxAmount: 0,
      taxableGain: 0,
      acquisitionCostUsed: 0,
      holdingYears: 0,
      isLongTerm: false,
      depreciationAmount: 0,
      buildingAcquisitionCost: 0,
      specialDeductionApplied: 0,
    };
  }

  const landRatio = input.landRatio ?? 0.3;
  const buildingRatio = input.buildingRatio ?? 0.7;

  let acquisitionCostUsed: number;
  let depreciationAmount = 0;
  let buildingAcquisitionCost = 0;
  let holdingYears = 0;

  if (input.mode === 'unknown' || input.mode === 'unknown_mortgage') {
    // 取得費不明: 売買価格の5%
    acquisitionCostUsed = Math.round(input.salePrice * 0.05);
  } else {
    // 取得費明確: 建物部分を減価償却
    const totalCost = input.acquisitionCost ?? 0;
    buildingAcquisitionCost = Math.round(totalCost * buildingRatio);
    const purchaseYear = input.purchaseYear ?? saleYear - 10;
    holdingYears = saleYear - purchaseYear;
    const depreciationBase = Math.round(
      buildingAcquisitionCost * 0.9 * DEPRECIATION_RATE_WOOD * Math.max(holdingYears, 1)
    );
    depreciationAmount = depreciationBase;
    const buildingBookValue = Math.max(
      buildingAcquisitionCost - depreciationAmount,
      Math.round(buildingAcquisitionCost * 0.05)
    );
    const landCost = Math.round(totalCost * landRatio);
    acquisitionCostUsed = landCost + buildingBookValue;
  }

  // 譲渡所得 = 売買価格 - 取得費 - 仲介手数料（譲渡費用）
  const transferExpense = calcBrokerageFee(input.salePrice);
  const gain = input.salePrice - acquisitionCostUsed - transferExpense;

  // 特別控除（3000万円特別控除等）を適用。控除額は課税譲渡所得を超えて引けない
  const specialDeductionApplied = Math.min(Math.max(input.specialDeduction ?? 0, 0), Math.max(gain, 0));
  const taxableGain = Math.max(gain - specialDeductionApplied, 0);

  if ((input.mode === 'known' || input.mode === 'known_mortgage') && input.purchaseYear) {
    holdingYears = saleYear - input.purchaseYear;
  }
  const isLongTerm = holdingYears > 5 || input.mode === 'unknown' || input.mode === 'unknown_mortgage';
  const taxRate = isLongTerm ? 0.20315 : 0.3963;
  const taxAmount = Math.round(taxableGain * taxRate);

  return {
    taxAmount,
    taxableGain,
    acquisitionCostUsed,
    holdingYears,
    isLongTerm,
    depreciationAmount,
    buildingAcquisitionCost,
    specialDeductionApplied,
  };
};
