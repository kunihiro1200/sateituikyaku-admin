"use strict";
/**
 * 電話番号の先頭「0」補完ユーティリティ
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhoneNumber = normalizePhoneNumber;
/**
 * 電話番号文字列の先頭が「0」でない場合に「0」を付加する
 * - null/undefined/空文字はそのまま返す
 * - 先頭が既に「0」の場合はそのまま返す
 * - 文字列の内容（ハイフン・括弧・特殊文字）は変更しない
 */
function normalizePhoneNumber(tel) {
    if (tel === null || tel === undefined || tel === '') {
        return tel;
    }
    if (tel.startsWith('0')) {
        return tel;
    }
    return '0' + tel;
}
