/**
 * 電話番号の先頭「0」補完ユーティリティ
 */

/**
 * 電話番号文字列の先頭が「0」でない場合に「0」を付加する
 * - null/undefined/空文字はそのまま返す
 * - 先頭が既に「0」の場合はそのまま返す
 * - 文字列の内容（ハイフン・括弧・特殊文字）は変更しない
 */
export function normalizePhoneNumber(tel: string | null | undefined): string | null | undefined {
  if (tel === null || tel === undefined || tel === '') {
    return tel;
  }
  if (tel.startsWith('0')) {
    return tel;
  }
  return '0' + tel;
}

/**
 * 電話番号が携帯番号かどうかを判定する
 * 日本の携帯番号は 070, 080, 090 で始まる
 * ハイフンや空白を除去してから判定する
 * - null/undefined/空文字の場合は false を返す
 */
export function isMobilePhone(tel: string | null | undefined): boolean {
  if (!tel) return false;
  // ハイフン、空白、括弧を除去して数字のみにする
  const digits = tel.replace(/[-\s()（）]/g, '');
  // 先頭が0でない場合は0を付加して判定
  const normalized = digits.startsWith('0') ? digits : '0' + digits;
  return /^0[789]0/.test(normalized);
}
