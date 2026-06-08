// アットホーム反響メール（買主向け）転記ルート
// 【変更ルール】このファイルはアットホーム買主反響メール専用。売主向け athome-transfer.ts は絶対に触らない。

import { Router, Request, Response } from 'express';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

const router = Router();

/**
 * POST /api/buyers/athome-buyer-transfer
 * アットホーム反響メール（買主向け）の本文を受け取り、買主リストスプレッドシートに転記する
 * CRON_SECRET認証（mail_notify_server.pyから呼び出される）
 */
router.post('/athome-buyer-transfer', async (req: Request, res: Response) => {
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
    console.log('[athome-buyer-transfer] アットホーム反響メール（買主）本文解析開始');

    // 改行で統一
    const text = mailBody.replace(/\r\n|\n\r|\r/g, '\n');

    // アットホームのメール本文からデータを抽出
    // フォーマット: 「項目名　　　　　　：値」（全角スペースパディング + 全角コロン）
    const extractField = (fieldName: string): string => {
      // 全角スペース・半角スペースでパディングされた後に全角/半角コロンが来るパターン
      const regex = new RegExp(fieldName + '[　\\s]*[：:]\\s*([^\\n]+)');
      const m = text.match(regex);
      return m ? m[1].trim() : '';
    };

    // お客様プロフィールセクション
    const name = extractField('お名前');
    const email = extractField('メールアドレス');
    const tel = extractField('電話番号').replace(/[-\s－　]/g, '');
    const contactTime = extractField('連絡希望の時間帯');
    const desiredTiming = extractField('入居希望時期');

    // 物件情報セクション
    const propertyType = extractField('物件種目');
    const buildingName = extractField('建物名');
    const propertyAddress = extractField('所在地');
    const price = extractField('価格');
    const floorPlan = extractField('間取り');
    const buildingArea = extractField('専有・建物面積');
    const landArea = extractField('土地面積');
    const athomeNumber = extractField('at home 物件番号');
    const companyPropertyNumber = extractField('貴社物件管理番号');

    // お問合せ内容セクション（自由記述）を抽出
    let inquiryContent = '';
    const inquiryMatch = text.match(/＜物件に関するお問合せ内容＞\s*\n([\s\S]*?)(?=\n—————|▼━━)/);
    if (inquiryMatch) {
      inquiryContent = inquiryMatch[1].trim();
    }

    if (!name && !tel && !email) {
      console.log('[athome-buyer-transfer] 名前・電話番号・メール全て取得できず。本文先頭300文字:', text.substring(0, 300));
      return res.status(400).json({ success: false, error: '名前・電話番号・メールアドレスが全て取得できませんでした' });
    }

    console.log(`[athome-buyer-transfer] 抽出データ: name=${name}, tel=${tel}, email=${email}, property=${companyPropertyNumber || buildingName}`);

    // 買主リストスプレッドシートに転記
    const buyerSheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await buyerSheetsClient.authenticate();

    // 買主番号を採番（E列の最大値 + 1）
    const allRows = await buyerSheetsClient.readAll();
    const columnEValues = allRows
      .map(row => row['買主番号'])
      .filter(value => value !== null && value !== undefined)
      .map(value => String(value));

    const maxNumber = columnEValues.length > 0
      ? Math.max(...columnEValues.map(v => parseInt(v) || 0))
      : 0;
    const buyerNumber = maxNumber + 1;
    console.log(`[athome-buyer-transfer] 買主番号採番: ${buyerNumber}`);

    // 重複チェック（同じ電話番号が既にある場合はスキップ）
    if (tel) {
      const existingRow = allRows.find(row => {
        const existingPhone = String(row['●電話番号\n（ハイフン不要）'] || '').replace(/[-\s－　]/g, '');
        return existingPhone === tel;
      });
      if (existingRow) {
        const existingBuyerNumber = existingRow['買主番号'];
        console.log(`[athome-buyer-transfer] ⏭ 重複スキップ: 電話番号が既存買主 ${existingBuyerNumber} と一致`);
        return res.json({
          success: true,
          skipped: true,
          message: `重複スキップ: 電話番号が既存買主 ${existingBuyerNumber} と一致するため登録しませんでした`,
          duplicateBuyer: existingBuyerNumber,
        });
      }
    }

    // ヒアリングコメント作成
    const commentParts: string[] = [];
    if (inquiryContent) commentParts.push(inquiryContent);
    if (buildingName) commentParts.push(`物件名: ${buildingName}`);
    if (propertyAddress) commentParts.push(`所在地: ${propertyAddress}`);
    if (price) commentParts.push(`価格: ${price}`);
    if (floorPlan) commentParts.push(`間取り: ${floorPlan}`);
    if (contactTime) commentParts.push(`連絡希望時間帯: ${contactTime}`);
    if (desiredTiming) commentParts.push(`入居希望時期: ${desiredTiming}`);
    const hearingComment = commentParts.length > 0
      ? `【以下自動転記（アットホーム反響）】\n${commentParts.join('\n')}`
      : '【自動転記（アットホーム反響）】';

    // 受付日（今日の日付）
    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstToday = new Date(today.getTime() + jstOffset);
    const receptionDate = `${jstToday.getUTCFullYear()}/${String(jstToday.getUTCMonth() + 1).padStart(2, '0')}/${String(jstToday.getUTCDate()).padStart(2, '0')}`;

    // フィールドマッピング（publicProperties.tsの/inquiriesと同じカラム名を使用）
    const rowData: Record<string, string> = {
      '買主番号': buyerNumber.toString(),
      '受付日': receptionDate,
      '●氏名・会社名': name || '',
      '●問合時ヒアリング': hearingComment,
      '●電話番号\n（ハイフン不要）': tel || '',
      '●メアド': email || '',
      '●問合せ元': 'アットホーム',
      '物件番号': companyPropertyNumber || '',
      '【問合メール】電話対応': '未',
    };

    console.log('[athome-buyer-transfer] Row data prepared:', JSON.stringify(rowData, null, 2));

    // スプレッドシートに追加
    await buyerSheetsClient.appendRow(rowData);
    console.log(`[athome-buyer-transfer] ✅ 買主リスト転記完了: 買主番号 ${buyerNumber}`);

    return res.json({
      success: true,
      buyerNumber: buyerNumber.toString(),
      message: `買主番号 ${buyerNumber} を買主リストに登録しました`,
    });

  } catch (error: any) {
    console.error('[athome-buyer-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
