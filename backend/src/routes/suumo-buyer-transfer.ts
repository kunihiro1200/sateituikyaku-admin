// SUUMO反響メール（リクルートＪＤＳ・買主向け）転記ルート
// 【変更ルール】このファイルはSUUMO(リクルートＪＤＳ)買主反響メール専用。
//   売主向けの transfer 系や athome-buyer-transfer.ts は絶対に触らない。
// 件名: 「[リクルートＪＤＳ]反響お知らせメール」
// mail_notify_server.py から CRON_SECRET 認証で呼び出される。

import { Router, Request, Response } from 'express';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

const router = Router();

/**
 * POST /api/buyers/suumo-buyer-transfer
 * SUUMO反響メール（リクルートＪＤＳ・買主向け）の本文を受け取り、買主リストスプレッドシートに転記する
 */
router.post('/suumo-buyer-transfer', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { body: mailBody } = req.body;
  if (!mailBody || typeof mailBody !== 'string') {
    return res.status(400).json({ success: false, error: 'mailBody is required' });
  }

  try {
    console.log('[suumo-buyer-transfer] SUUMO反響メール（買主）本文解析開始');

    // 改行で統一
    const text = mailBody.replace(/\r\n|\n\r|\r/g, '\n');

    // JDS(SUUMO)反響メールは「項目名：値」形式（半角/全角コロン）。
    // 値の後ろに全角スペースや別項目が続く場合があるため、行末までを取り、末尾の空白は trim する。
    const extractField = (fieldName: string): string => {
      const regex = new RegExp(fieldName + '[　\\s]*[：:]\\s*([^\\n]*)');
      const m = text.match(regex);
      return m ? m[1].trim() : '';
    };

    // ===== お客様プロフィールセクション =====
    // 氏名（漢字）を優先。無ければ 氏名（カナ）を使用。
    let name = extractField('氏名（漢字）');
    if (!name) name = extractField('氏名（カナ）');
    if (!name) name = extractField('氏名'); // フォールバック

    const email = extractField('メールアドレス');
    const tel = extractField('電話番号').replace(/[-\s－　]/g, '');
    const postalCode = extractField('郵便番号');
    const customerAddress = extractField('住所');
    const preferredContact = extractField('希望連絡方法');

    // ===== 問合せ物件セクション =====
    const companyName = extractField('会社名');
    const propertyTypeRaw = extractField('物件種別'); // 例: 中古一戸建て
    const buildingName = extractField('物件名');
    const companyPropertyNumber = extractField('貴社物件コード'); // 例: AA5885
    const suumoPropertyCode = extractField('物件コード'); // SUUMO側コード
    const nearestStation = extractField('最寄り駅');
    const propertyAddress = extractField('所在地');
    const price = extractField('価格');
    const floorPlan = extractField('間取り');
    const buildingArea = extractField('建物面積');
    const landArea = extractField('土地面積');
    // 物件詳細画面URL
    const detailUrlMatch = text.match(/物件詳細画面[　\s]*[：:]\s*(https?:\/\/[^\s\n]+)/);
    const detailUrl = detailUrlMatch ? detailUrlMatch[1].trim() : '';

    // 物件種別 → 買主リスト用種別へ簡易変換
    const mapPropertyType = (raw: string): string => {
      if (!raw) return '';
      if (raw.includes('マンション')) return 'マンション';
      if (raw.includes('一戸建て') || raw.includes('戸建')) return '戸建て';
      if (raw.includes('土地')) return '土地';
      return raw;
    };
    const propertyType = mapPropertyType(propertyTypeRaw);

    if (!name && !tel && !email) {
      console.log('[suumo-buyer-transfer] 名前・電話番号・メール全て取得できず。本文先頭400文字:', text.substring(0, 400));
      return res.status(400).json({ success: false, error: '名前・電話番号・メールアドレスが全て取得できませんでした' });
    }

    console.log(`[suumo-buyer-transfer] 抽出データ: name=${name}, tel=${tel}, email=${email}, property=${companyPropertyNumber || buildingName}`);

    // 買主リストスプレッドシートに転記
    const buyerSheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await buyerSheetsClient.authenticate();

    // 買主番号を採番（E列のみ取得して最大値 + 1）
    const rawEColumn = await buyerSheetsClient.readRawRange('E2:E');
    const columnEValues = rawEColumn
      .map(row => row[0])
      .filter(value => value !== null && value !== undefined && value !== '');

    const maxNumber = columnEValues.length > 0
      ? Math.max(...columnEValues.map(v => parseInt(v) || 0))
      : 0;
    const buyerNumber = maxNumber + 1;
    console.log(`[suumo-buyer-transfer] 買主番号採番: ${buyerNumber} (E列の行数: ${columnEValues.length}, 最大値: ${maxNumber})`);

    // 重複チェック（同じ電話番号が既にある場合はスキップ）- skipDuplicateCheck=trueで無視可能
    if (tel && !req.body.skipDuplicateCheck) {
      const headers = await buyerSheetsClient.getHeaders();
      const phoneColIndex = headers.findIndex(h => h.includes('電話番号'));

      if (phoneColIndex >= 0) {
        const colToLetter = (col: number): string => {
          let letter = '';
          let c = col;
          while (c >= 0) {
            letter = String.fromCharCode(65 + (c % 26)) + letter;
            c = Math.floor(c / 26) - 1;
          }
          return letter;
        };
        const phoneColLetter = colToLetter(phoneColIndex);
        const rawPhoneColumn = await buyerSheetsClient.readRawRange(`${phoneColLetter}2:${phoneColLetter}`);

        for (let i = 0; i < rawPhoneColumn.length; i++) {
          const existingPhone = String(rawPhoneColumn[i]?.[0] || '').replace(/[-\s－　]/g, '');
          if (existingPhone === tel) {
            const existingBuyerNumber = rawEColumn[i]?.[0] || '不明';
            console.log(`[suumo-buyer-transfer] ⏭ 重複スキップ: 電話番号が既存買主 ${existingBuyerNumber} と一致`);
            return res.json({
              success: true,
              skipped: true,
              message: `重複スキップ: 電話番号が既存買主 ${existingBuyerNumber} と一致するため登録しませんでした`,
              duplicateBuyer: existingBuyerNumber,
            });
          }
        }
      }
    }

    // ヒアリングコメント作成
    const commentParts: string[] = [];
    if (buildingName) commentParts.push(`物件名: ${buildingName}`);
    if (propertyAddress) commentParts.push(`所在地: ${propertyAddress}`);
    if (price) commentParts.push(`価格: ${price}`);
    if (floorPlan) commentParts.push(`間取り: ${floorPlan}`);
    if (buildingArea) commentParts.push(`建物面積: ${buildingArea}`);
    if (landArea) commentParts.push(`土地面積: ${landArea}`);
    if (nearestStation) commentParts.push(`最寄り駅: ${nearestStation}`);
    if (postalCode || customerAddress) commentParts.push(`お客様住所: 〒${postalCode} ${customerAddress}`.trim());
    if (preferredContact) commentParts.push(`希望連絡方法: ${preferredContact}`);
    if (detailUrl) commentParts.push(`物件詳細: ${detailUrl}`);
    const hearingComment = commentParts.length > 0
      ? `【以下自動転記（SUUMO反響）】\n${commentParts.join('\n')}`
      : '【自動転記（SUUMO反響）】';

    // 受付日（今日の日付・JST）
    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstToday = new Date(today.getTime() + jstOffset);
    const receptionDate = `${jstToday.getUTCFullYear()}/${String(jstToday.getUTCMonth() + 1).padStart(2, '0')}/${String(jstToday.getUTCDate()).padStart(2, '0')}`;

    // フィールドマッピング（athome-buyer-transfer と同じカラム名を使用）
    const rowData: Record<string, string> = {
      '買主番号': buyerNumber.toString(),
      '受付日': receptionDate,
      '●氏名・会社名': name || '',
      '●問合時ヒアリング': hearingComment,
      '●電話番号\n（ハイフン不要）': tel || '',
      '●メアド': email || '',
      '●問合せ元': 'SUUMO',
      '物件番号': companyPropertyNumber || '',
      '【問合メール】電話対応': '未',
    };

    console.log('[suumo-buyer-transfer] Row data prepared:', JSON.stringify(rowData, null, 2));

    // スプレッドシートに追加
    await buyerSheetsClient.appendRow(rowData);
    console.log(`[suumo-buyer-transfer] ✅ 買主リスト転記完了: 買主番号 ${buyerNumber}`);

    return res.json({
      success: true,
      buyerNumber: buyerNumber.toString(),
      message: `買主番号 ${buyerNumber} を買主リストに登録しました`,
    });

  } catch (error: any) {
    console.error('[suumo-buyer-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
