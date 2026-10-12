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

// 【SUUMO売却】反響除外申請フォーマット（Googleスプレッドシート形式に変換したネイティブファイル）
// ※ 元のExcel版(1JHIpTlqaUcF0xpuoPn3213__eFVKKIHV)はAPIで書き込めないため、
//    Googleスプレッドシート形式に変換したこのIDを使う。
export const SUUMO_EXCLUSION_SPREADSHEET_ID = '1C-IZLHBdOSA9SDJEOdI0xXL4sT5Cc_ZYcBVRKeWYodI';
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


// ============================================================
// 除外申請メール送信（スプシを.xlsxに変換して添付し、JDSサポートへGmail送信）
// ============================================================

import { google } from 'googleapis';
import { EmailService } from './EmailService';

// JDS（リクルート住宅情報ダウンロードシステム）サポートの除外申請受付先
export const JDS_SUPPORT_EMAIL = 'jds_support@r.recruit.co.jp';

/**
 * GOOGLE_SERVICE_ACCOUNT_JSON（またはBase64）をパースして認証情報を返す。
 * GoogleSheetsClient と同じ読み込みロジック。
 */
function parseServiceAccountKey(): { client_email: string; private_key: string } {
  let jsonString = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonString) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON が設定されていません');
  }
  // JSONとしてパースできなければBase64としてデコード
  try {
    JSON.parse(jsonString);
  } catch {
    jsonString = Buffer.from(jsonString, 'base64').toString('utf8');
  }
  const keyFile = JSON.parse(jsonString);
  if (keyFile.private_key && !keyFile.private_key.includes('\n')) {
    keyFile.private_key = keyFile.private_key.replace(/\\n/g, '\n');
  }
  if (!keyFile.client_email || !keyFile.private_key) {
    throw new Error('service account JSON に client_email / private_key がありません');
  }
  return { client_email: keyFile.client_email, private_key: keyFile.private_key };
}

/**
 * 除外申請スプシ（Googleスプレッドシート）を .xlsx バイナリとして取得する。
 * サービスアカウント（スプシに編集者共有済み）＋ drive.readonly スコープで export する。
 */
async function exportExclusionSheetAsXlsx(): Promise<Buffer> {
  const { client_email, private_key } = parseServiceAccountKey();
  const auth = new google.auth.JWT({
    email: client_email,
    key: private_key,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  await auth.authorize();
  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.export(
    {
      fileId: SUUMO_EXCLUSION_SPREADSHEET_ID,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    },
    { responseType: 'arraybuffer' }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

export interface SendSuumoExclusionMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * SUUMO反響除外申請フォーマット（.xlsx）を添付して、JDSサポートへメール送信する。
 * 送信元: tenant@ifoo-oita.com（Gmail）
 * 宛先: jds_support@r.recruit.co.jp
 */
export async function sendSuumoExclusionRequestMail(): Promise<SendSuumoExclusionMailResult> {
  try {
    // 1) スプシを .xlsx に変換して取得
    const xlsxBuffer = await exportExclusionSheetAsXlsx();

    // 2) 添付用ファイル名（日本語可）
    const now = new Date();
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const ymd = `${jst.getUTCFullYear()}${String(jst.getUTCMonth() + 1).padStart(2, '0')}${String(jst.getUTCDate()).padStart(2, '0')}`;
    const filename = `【SUUMO売却】反響除外申請フォーマット_${ymd}.xlsx`;

    // 3) 件名・本文（確定仕様）
    const subject = '【SUUMO売却】反響除外申請フォーマット送付の件';
    const body = [
      'リクルート　ＪＤＳサポートセンター　ご担当者様',
      '',
      'お世話になっております。株式会社くじら不動産（株式会社いふう）でございます。',
      '',
      '今月分のSUUMO売却反響の除外申請につきまして、所定のフォーマットを添付にて送付いたします。',
      'ご確認のほど、よろしくお願いいたします。',
      '',
      '***************************',
      '株式会社いふう',
      '〒870-0044 大分市舞鶴町1丁目3-30',
      'TEL：097-533-2022',
      'MAIL：tenant@ifoo-oita.com',
      '***************************',
    ].join('\n');

    // 4) Gmailで添付送信（tenant@ から）
    const emailService = new EmailService();
    const result = await emailService.sendBuyerEmail({
      to: JDS_SUPPORT_EMAIL,
      subject,
      body,
      from: 'tenant@ifoo-oita.com',
      attachments: [
        {
          // EmailService.sendBuyerEmail は Multer.File 互換の { originalname, mimetype, buffer } を使う
          fieldname: 'attachments',
          originalname: filename,
          encoding: '7bit',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          size: xlsxBuffer.length,
          buffer: xlsxBuffer,
        } as Express.Multer.File,
      ],
    });

    if (!result.success) {
      return { success: false, error: result.error || 'メール送信に失敗しました' };
    }
    return { success: true, messageId: result.messageId };
  } catch (error: any) {
    console.error('[sendSuumoExclusionRequestMail] エラー:', error.message);
    return { success: false, error: error.message };
  }
}
