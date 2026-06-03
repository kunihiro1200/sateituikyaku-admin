// アットホーム査定依頼メール転記ルート
// 【変更ルール】このファイルはアットホーム専用。イエウール/HOME4U修正時は絶対に触らない。

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { SpreadsheetSyncService } from '../services/SpreadsheetSyncService';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';

const router = Router();

/**
 * SpreadsheetSyncServiceを初期化して返す（Vercelサーバーレス対応）
 */
async function createSpreadsheetSyncService(): Promise<SpreadsheetSyncService | null> {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await sheetsClient.authenticate();
    return new SpreadsheetSyncService(sheetsClient, supabase);
  } catch (err) {
    console.error('⚠️ [SpreadsheetSync] Failed to initialize SpreadsheetSyncService:', err);
    return null;
  }
}

/**
 * POST /api/sellers/athome-transfer
 * アットホーム査定メール本文を受け取り、DB即時転記 + DB→スプシ即時同期を行う
 * CRON_SECRET認証（mail_notify_server.pyから呼び出される）
 */
router.post('/athome-transfer', async (req: Request, res: Response) => {
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
    console.log('[athome-transfer] アットホームメール本文解析開始');

    // 改行で統一
    const lines = mailBody.replace(/\r\n|\n\r|\r/g, '\n');

    // アットホームのメール本文からデータを抽出
    // フォーマット: 「項目名      ：値」
    const extractField = (text: string, fieldName: string): string => {
      const regex = new RegExp(fieldName + '\\s*[：:]\\s*([^\\n]+)');
      const m = text.match(regex);
      return m ? m[1].trim() : '';
    };

    // 受付完了日時
    const receptionDateMatch = lines.match(/受付完了日時\s*[：:]\s*([^\n]+)/);
    const receptionDateRaw = receptionDateMatch ? receptionDateMatch[1].trim() : '';
    // 「2026年05月23日」→ Date
    const dateMatch = receptionDateRaw.match(/(\d{4})年(\d{2})月(\d{2})日/);
    const inquiryDateObj = dateMatch
      ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`)
      : new Date();

    // ユーザ情報
    const name = extractField(lines, 'お名前');
    const furigana = extractField(lines, 'フリガナ');
    const email = extractField(lines, 'メールアドレス');
    const address = extractField(lines, 'ご住所');
    const tel = extractField(lines, '電話番号').replace(/-/g, '');
    const preferredTime = extractField(lines, 'ご希望時間帯');

    // 物件情報
    const propertyTypeRaw = extractField(lines, '物件種目');
    let displayPropertyType = '';
    if (propertyTypeRaw.includes('一戸建て') || propertyTypeRaw.includes('戸建')) displayPropertyType = '戸';
    else if (propertyTypeRaw.includes('マンション')) displayPropertyType = 'マ';
    else if (propertyTypeRaw.includes('土地')) displayPropertyType = '土';
    else displayPropertyType = '戸'; // デフォルト

    // 物件住所（大分県を除去）
    let propertyAddress = extractField(lines, '所在地').replace(/^大分県/, '').replace(/^福岡県/, '').trim();
    // 「所在地」が空の場合は「物件所在地」も試す
    if (!propertyAddress) {
      propertyAddress = extractField(lines, '物件所在地').replace(/^大分県/, '').replace(/^福岡県/, '').trim();
    }

    const buildingName = extractField(lines, '建物名');
    const exclusiveArea = extractField(lines, '専有面積');
    const buildingAreaRaw = extractField(lines, '建物面積');
    const landAreaRaw = extractField(lines, '土地面積');

    // 数値抽出
    const extractNumeric = (str: string): string => {
      if (!str || str === '-') return '';
      const m = str.match(/(\d+(?:\.\d+)?)/);
      return m ? m[1] : '';
    };

    const landArea = extractNumeric(landAreaRaw);
    const buildingArea = extractNumeric(buildingAreaRaw) || extractNumeric(exclusiveArea);

    if (!name || !tel) {
      return res.status(400).json({ success: false, error: `名前または電話番号が取得できませんでした name=${name} tel=${tel}` });
    }

    // ============================================================
    // 重複チェック（同一電話番号が既にDBに存在する場合はスキップ）
    // ============================================================
    {
      const supabaseForCheck = (await import('../config/supabase')).default;
      const { decrypt: decryptForCheck } = await import('../utils/encryption');

      const { data: allSellers, error: fetchError } = await supabaseForCheck
        .from('sellers')
        .select('id, seller_number, phone_number, inquiry_date')
        .is('deleted_at', null);

      if (!fetchError && allSellers) {
        for (const existing of allSellers) {
          if (!existing.phone_number) continue;
          try {
            const decryptedPhone = decryptForCheck(existing.phone_number);
            if (decryptedPhone === tel) {
              console.log(`[athome-transfer] ⏭ 重複スキップ: 電話番号が既存売主 ${existing.seller_number} と一致`);
              return res.json({
                success: true,
                skipped: true,
                message: `重複スキップ: 電話番号が既存売主 ${existing.seller_number} と一致するため登録しませんでした`,
                duplicateSeller: existing.seller_number,
              });
            }
          } catch {
            // 復号失敗はスキップ
          }
        }
      }
    }

    // コメント作成
    const commentParts: string[] = [];
    if (furigana) commentParts.push(`フリガナ: ${furigana}`);
    if (preferredTime && preferredTime !== '-') commentParts.push(`希望時間帯: ${preferredTime}`);
    if (buildingName && buildingName !== '-') commentParts.push(`建物名: ${buildingName}`);
    const comments = `【以下自動転記（アットホーム）】\n${commentParts.join('\n')}`;

    // 売主番号採番（連番スプシから）
    const isFukuoka = propertyAddress.includes('福岡') || address.includes('福岡');
    const prefix = isFukuoka ? 'FI' : 'AA';
    const serialCell = isFukuoka ? 'I2' : 'C2';

    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const serialSheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: '連番',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await serialSheetsClient.authenticate();
    const serialValues = await serialSheetsClient.readRawRange(serialCell);
    const currentNum = parseInt(String(serialValues?.[0]?.[0] || '0'), 10);
    const newNum = currentNum + 1;
    const sellerNumber = `${prefix}${newNum}`;
    await serialSheetsClient.updateRawCell('連番', serialCell, newNum);
    console.log(`[athome-transfer] 売主番号採番: ${sellerNumber}`);

    // DB INSERT
    const { encrypt } = await import('../utils/encryption');
    const supabase = (await import('../config/supabase')).default;

    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstToday = new Date(today.getTime() + jstOffset);
    const mm = String(jstToday.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstToday.getUTCDate()).padStart(2, '0');
    const nextCallDate = `${jstToday.getUTCFullYear()}-${mm}-${dd}`;
    const inquiryDateISO = inquiryDateObj instanceof Date && !isNaN(inquiryDateObj.getTime())
      ? inquiryDateObj.toISOString().split('T')[0]
      : nextCallDate;
    const inquiryYear = inquiryDateObj instanceof Date && !isNaN(inquiryDateObj.getTime())
      ? inquiryDateObj.getFullYear()
      : jstToday.getUTCFullYear();

    const insertData: Record<string, any> = {
      seller_number: sellerNumber,
      name: encrypt(name),
      address: address ? encrypt(address) : null,
      phone_number: encrypt(tel),
      email: email ? encrypt(email) : null,
      property_address: propertyAddress,
      property_type: displayPropertyType,
      inquiry_site: 'ア',
      inquiry_date: inquiryDateISO,
      inquiry_year: inquiryYear,
      inquiry_detailed_datetime: receptionDateRaw || null,
      floor_plan: null,
      build_year: null,
      current_status: null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: buildingArea ? parseFloat(buildingArea) : null,
      status: '追客中',
      next_call_date: nextCallDate,
      comments: comments,
      pinrich_status: '配信中',
      valuation_reason: null,
      is_unreachable: false,
      duplicate_confirmed: false,
    };

    const { data: seller, error: insertError } = await supabase
      .from('sellers')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !seller) {
      console.error('[athome-transfer] DB INSERT エラー:', insertError);
      return res.status(500).json({ success: false, error: `DB INSERT失敗: ${insertError?.message}` });
    }

    console.log(`[athome-transfer] DB INSERT成功: ${sellerNumber} (id: ${seller.id})`);

    // propertiesテーブル用のproperty_type変換
    const propertyTypeForDB = displayPropertyType === 'マ' ? 'マンション'
      : displayPropertyType === '戸' ? '戸建て'
      : displayPropertyType === '土' ? '土地'
      : displayPropertyType || null;

    // propertiesテーブルにも登録
    await supabase.from('properties').insert({
      seller_id: seller.id,
      property_address: propertyAddress,
      property_type: propertyTypeForDB,
      floor_plan: null,
      construction_year: null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: buildingArea ? parseFloat(buildingArea) : null,
    });

    // DB→スプシ即時同期
    try {
      const syncService = await createSpreadsheetSyncService();
      if (syncService) {
        const syncResult = await syncService.syncToSpreadsheet(seller.id);
        if (syncResult.success) {
          console.log(`[athome-transfer] スプシ同期成功: ${sellerNumber}`);
        } else {
          console.warn(`[athome-transfer] スプシ同期失敗（DB登録は成功）: ${syncResult.error}`);
        }
      }
    } catch (syncErr: any) {
      console.warn(`[athome-transfer] スプシ同期エラー（DB登録は成功）: ${syncErr.message}`);
    }

    return res.json({
      success: true,
      sellerNumber,
      sellerId: seller.id,
      message: `${sellerNumber} をDBに登録しました`,
    });

  } catch (error: any) {
    console.error('[athome-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
