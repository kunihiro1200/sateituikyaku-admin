/**
 * 価格変更履歴の自動生成ユーティリティ
 * Feature: price-change-history-auto-input
 */

/**
 * 円単位の価格を万円単位（切り捨て整数）に変換する
 */
export function toMan(price: number): number {
  return Math.floor(price / 10000);
}

/**
 * 値下げ履歴エントリを生成する
 * フォーマット: {initials}{月}/{日}　{変更前価格}万→{変更後価格}万
 */
export function generatePriceHistoryEntry(
  oldPrice: number | null | undefined,
  newPrice: number,
  initials: string,
  dateStr: string // "3/17" 形式
): string {
  const oldMan = toMan(oldPrice ?? 0);
  const newMan = toMan(newPrice);
  return `${initials}${dateStr}　${oldMan}万→${newMan}万`;
}

/**
 * 既存の履歴の先頭に新しいエントリを追加した履歴全体を返す
 * - 価格が変更されていない場合は既存の履歴をそのまま返す
 * - 変更後がnull/undefinedの場合は既存の履歴をそのまま返す
 */
export function buildUpdatedHistory(
  oldPrice: number | null | undefined,
  newPrice: number | null | undefined,
  initials: string,
  existingHistory: string,
  dateStr: string
): string {
  // 変更後がnull/undefinedの場合は追記しない（要件1.7）
  if (newPrice === null || newPrice === undefined) return existingHistory;
  // 価格が変更されていない場合は追記しない（要件1.5）
  if (oldPrice === newPrice) return existingHistory;

  const entry = generatePriceHistoryEntry(oldPrice, newPrice, initials, dateStr);
  return existingHistory ? `${entry}\n${existingHistory}` : entry;
}
