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
 * 両方のステータスが存在する場合は更新日時が新しい方を優先する。
 * タイムスタンプがない場合は offer_status を優先する（より最近の操作と推定）。
 * どちらも成立しない場合は null を返す。
 *
 * @param latestStatus 買主の最新状況
 * @param offerStatus 物件の買付フィールド
 * @param latestStatusUpdatedAt 買主 latest_status の更新日時（ISO8601）
 * @param offerStatusUpdatedAt 物件 offer_status の更新日時（ISO8601）
 * @returns 買付状況テキスト、または null
 */
export function getPurchaseStatusText(
  latestStatus: string | null | undefined,
  offerStatus: string | null | undefined,
  latestStatusUpdatedAt?: string | null,
  offerStatusUpdatedAt?: string | null
): string | null {
  const hasBuyer = hasBuyerPurchaseStatus(latestStatus);
  const hasOffer = hasPropertyOfferStatus(offerStatus);

  // 両方存在する場合: 更新日時が新しい方を優先
  if (hasBuyer && hasOffer) {
    if (latestStatusUpdatedAt && offerStatusUpdatedAt) {
      return latestStatusUpdatedAt > offerStatusUpdatedAt
        ? (latestStatus as string)
        : (offerStatus as string);
    }
    // タイムスタンプがない場合は offer_status を優先（より最近の操作と推定）
    return offerStatus as string;
  }

  // 片方のみ存在する場合
  if (hasBuyer) return latestStatus as string;
  if (hasOffer) return offerStatus as string;
  return null;
}
