/**
 * 全角文字を半角文字に変換するユーティリティ
 */

/**
 * 全角英数字・記号・スペースを半角に変換する
 * メールアドレス・電話番号などの入力正規化に使用
 */
export function toHalfWidth(str: string): string {
  return str
    // 全角英数字・記号 (！～) → 半角
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    // 全角スペース → 半角スペース
    .replace(/　/g, ' ');
}

/**
 * メールアドレス用の正規化
 * 全角→半角変換 + 前後の空白除去
 */
export function normalizeEmail(email: string): string {
  return toHalfWidth(email).trim();
}
