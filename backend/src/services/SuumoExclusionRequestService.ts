// SUUMO（リクルートＪＤＳ）反響除外申請フォーマットへの自動追記サービス
//
// スプシ名: 【SUUMO売却】反響除外申請フォーマットver2(194323001)
// spreadsheetId: 1JHIpTlqaUcF0xpuoPn3213__eFVKKIHV
// タブ(シート)名: 申請フォーマット
//
// 仕様（パターンA：SUUMO売主が自動登録されるのと同時に、全反響のJDS連番を追記する）:
//   - B列: JDS連番（10桁。suumo-transfer の inquiry_id）
//   - C列: 「いたずら反響」（申請の種類。プルダウンの選択肢と同じ文字列）
//   - F列: 「いたずら、打ち間違いと思われる反響（いたずら反響）」（申請の理由）
//   - D/E/G/H/I: 触らない（空のまま）
//
// 書き込み位置: B列を上から見て、ヘッダー以降で「最初にB列が空の行」。
//   表には No（A列）が 1..999 まであらかじめ振られているため、
//   「A列に数字があり、かつB列が空」の最初の行を次の記入行とする。
//   見つからない場合は、A列/B列いずれかに値がある最終行の次の行に書く。
//
// 失敗してもDB登録や売主リスト反映は止めない（呼び出し側でベストエフォート扱いにする）。

import { GoogleSheetsClient } from './GoogleSheetsClient';

export const SUUMO_EXCLUSION_SPREADSHEET_ID = '1JHIpTlqaUcF0xpuoPn3213__eFVKKIHV';
export const SUUMO_EXCLUSION_SHEET_NAME = '申請フォーマット';

const APPLICATION_TYPE = 'いたずら反響';
const APPLICATION_REASON = 'いたずら、打ち間違いと思われる反響（いたずら反響）';

export interface SuumoExclusionAppendResult {
  success: boolean;
  row?: number;
  skipped?: boolean;
  message?: string;
  error?: string;
}

/**
 * SUUMO除外申請フォーマットに JDS連番 を1行追記する。
 * @param jdsSerial JDS連番（10桁）。空なら何もしない。
 */
export async function appendSuumoExclusionRequest(
  jdsSerial: string | null | undefined
): Promise<SuumoExclusionAppendResult> {
  const serial = (jdsSerial || '').toString().trim();
  if (!serial) {
    return { success: false, skipped: true, message: 'JDS連番が空のため追記しません' };
  }

  const client = new GoogleSheetsClient({
    spreadsheetId: SUUMO_EXCLUSION_SPREADSHEET_ID,
    sheetName: SUUMO_EXCLUSION_SHEET_NAME,
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await client.authenticate();

  // A列・B列を広めに取得（ヘッダー行＋データ枠）。
  // A列=No、B列=JDS連番 の前提で、次に書くべき行を決定する。
  const colA = await client.readRawRange('A1:A1200');
  const colB = await client.readRawRange('B1:B1200');

  const valAt = (col: string[][], i: number): string =>
    (col[i] && col[i][0] != null ? String(col[i][0]) : '').trim();

  const maxLen = Math.max(colA.length, colB.length);

  // 1) 重複防止：同じJDS連番が既にB列にあれば追記しない
  for (let i = 0; i < colB.length; i++) {
    if (valAt(colB, i) === serial) {
      return {
        success: true,
        skipped: true,
        row: i + 1,
        message: `JDS連番 ${serial} は既にB${i + 1}に記入済みのため追記しません`,
      };
    }
  }

  // 2) 「A列に数字（No）があり、かつB列が空」の最初の行を探す
  let targetRow = -1;
  for (let i = 0; i < maxLen; i++) {
    const a = valAt(colA, i);
    const b = valAt(colB, i);
    const aIsNo = /^\d+$/.test(a); // No列は数字
    if (aIsNo && b === '') {
      targetRow = i + 1; // 1-indexed
      break;
    }
  }

  // 3) No枠が尽きている場合：A列/B列いずれかに値がある最終行の次に書く
  if (targetRow === -1) {
    let lastUsed = 0;
    for (let i = 0; i < maxLen; i++) {
      if (valAt(colA, i) !== '' || valAt(colB, i) !== '') {
        lastUsed = i + 1;
      }
    }
    targetRow = lastUsed + 1;
  }

  // B/C/F 列へ書き込む（D/E は触らない）
  await client.updateRawCell(SUUMO_EXCLUSION_SHEET_NAME, `B${targetRow}`, serial);
  await client.updateRawCell(SUUMO_EXCLUSION_SHEET_NAME, `C${targetRow}`, APPLICATION_TYPE);
  await client.updateRawCell(SUUMO_EXCLUSION_SHEET_NAME, `F${targetRow}`, APPLICATION_REASON);

  return {
    success: true,
    row: targetRow,
    message: `JDS連番 ${serial} を ${SUUMO_EXCLUSION_SHEET_NAME} の ${targetRow}行目に追記しました`,
  };
}
