/**
 * 買付状況判定ユーティリティ
 *
 * 物件の買付状況を判定するための純粋関数を提供する。
 * - 条件1（買主側）: latest_status に「買」が含まれるか
 * - 条件2（物件側）: offer_status に空でない値があるか
 * - 両方成立時は条件1を優先
 */

/**
 * 条件1の判定: latest_status に「買」が含まれるか
 * @param latestStatus 買主の最新状況
 * @returns 「買」を含む場合 true、null・空文字・含まない場合 false
 */
export function hasBuyerPurchaseStatus(
  latestStatus: string | null | undefined
): boolean {
  if (!latestStatus) return false;
  return latestStatus.includes('買');
}

/**
 * 条件2の判定: offer_status に空でない値があるか
 * @param offerStatus 物件の買付フィールド
 * @returns 空でない文字列の場合 true、null・空文字の場合 false
 */
export function hasPropertyOfferStatus(
  offerStatus: string | null | undefined
): boolean {
  if (!offerStatus) return false;
  return offerStatus.length > 0;
}

/**
 * 買付状況テキストを返す。
 * 条件1（latest_status に「買」を含む）が優先。
 * どちらも成立しない場合は null を返す。
 *
 * @param latestStatus 買主の最新状況
 * @param offerStatus 物件の買付フィールド
 * @returns 買付状況テキスト、または null
 */
export function getPurchaseStatusText(
  latestStatus: string | null | undefined,
  offerStatus: string | null | undefined
): string | null {
  // 条件1: latest_status に「買」が含まれる場合
  if (hasBuyerPurchaseStatus(latestStatus)) {
    return latestStatus as string;
  }
  // 条件2: offer_status に空でない値がある場合
  if (hasPropertyOfferStatus(offerStatus)) {
    return offerStatus as string;
  }
  // どちらも不成立
  return null;
}
