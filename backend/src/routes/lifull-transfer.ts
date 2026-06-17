// LIFULL HOME'S査定依頼メール転記ルート
// 【変更ルール】このファイルはLIFULL HOME'S専用。イエウール/HOME4U/アットホーム修正時は絶対に触らない。

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
    console.error('[SpreadsheetSync] Failed to initialize SpreadsheetSyncService:', err);
    return null;
  }
}

/**
 * POST /api/sellers/lifull-transfer
 * LIFULL HOME'Sメール本文を受け取り、DB即時転記 + DB→スプシ即時同期を行う
 * CRON_SECRET認証（mail_notify.pyから呼び出される）
 */
router.post('/lifull-transfer', async (req: Request, res: Response) => {
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
    console.log('[lifull-transfer] LIFULL HOME\'Sメール本文解析開始');

    // ============================================================
    // 1. メール本文解析
    // LIFULL HOME'Sのフォーマット:
    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    //   査定ID（問合せ番号）：XXXXXXXX
    //   物件種別：一戸建て
    //   所在地：大分県大分市...
    //   間取り：4K/DK
    //   建物面積：40m2
    //   土地面積：90m2
    //   築年：西暦XXXX年(昭和XX年) 築XX年
    //   現況：...
    //   名義：...
    //   売却理由：...
    //   売却希望時期：...
    //   ご要望：...
    //   お名前：...
    //   フリガナ：...
    //   ご住所：...
    //   電話番号：...
    //   メールアドレス：...
    //   希望の連絡時間：...
    //   希望の連絡方法：...
    //   同時送信社数：...
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
    // ============================================================

    // 本文から罫線ブロック内のデータを抽出
    const cleanedBody = mailBody.replace(/\r?\n|\r/g, ' ');

    // LIFULL用フィールド抽出関数（全角スペース・半角スペース対応）
    const extractField = (text: string, label: string): string => {
      // 「ラベル：値」形式で抽出（全角コロン）
      const pattern = new RegExp(label + '[\\s　]*[：:]([^┗]*?)(?=\\s{2,}[\\S]|$)');
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
      return '';
    };

    // より正確な抽出（次のフィールドまでを取る）
    const extractBetween = (text: string, from: string, to: string): string => {
      const fromIdx = text.indexOf(from);
      if (fromIdx === -1) return '';
      const start = fromIdx + from.length;
      // 「：」の後の値を取る
      const colonIdx = text.indexOf('：', start);
      if (colonIdx === -1 || colonIdx > start + from.length + 5) {
        // fromがすでに「ラベル：」形式の場合
        const valueStart = text.indexOf('：', fromIdx) !== -1 ? text.indexOf('：', fromIdx) + 1 : start;
        const toIdx = text.indexOf(to, valueStart);
        return text.substring(valueStart, toIdx === -1 ? text.length : toIdx).trim();
      }
      const valueStart = colonIdx + 1;
      const toIdx = text.indexOf(to, valueStart);
      return text.substring(valueStart, toIdx === -1 ? text.length : toIdx).trim();
    };

    // LIFULLフォーマット用の正規表現抽出
    const extractByRegex = (text: string, pattern: RegExp): string => {
      const match = text.match(pattern);
      return match ? match[1].trim() : '';
    };

    // 受信日時
    const receivedDateMatch = mailBody.match(/受信日時[：:][\s]*(\d{4}\/\d{2}\/\d{2}\s+\d{2}:\d{2}:\d{2})/);
    const receivedDate = receivedDateMatch ? receivedDateMatch[1] : '';
    const requestDateObj = receivedDate ? new Date(receivedDate.replace(/\//g, '-')) : new Date();

    // 物件種別
    const propertyTypeRaw = extractByRegex(cleanedBody, /物件種別[：:]([^　\s]+?)(?=\s{2,}|\s*所在地)/);
    let displayPropertyType = propertyTypeRaw;
    if (propertyTypeRaw.includes('一戸建て')) displayPropertyType = '戸';
    else if (propertyTypeRaw.includes('マンション')) displayPropertyType = 'マ';
    else if (propertyTypeRaw.includes('土地')) displayPropertyType = '土';

    // 所在地
    const addressMatch = cleanedBody.match(/所在地[：:][\s　]*([^\s　](?:.*?)?)(?=\s{2,}[\S]|\s*間取り)/);
    const fullPropertyAddress = addressMatch ? addressMatch[1].replace(/^大分県/, '').trim() : '';
    console.log(`[lifull-transfer] 物件所在地抽出: "${fullPropertyAddress}"`);

    // 間取り
    const layoutMatch = cleanedBody.match(/間取り[：:][\s　]*([^\s　]+?)(?=\s{2,}|\s*建物面積)/);
    const layout = layoutMatch ? layoutMatch[1].trim() : '';

    // 建物面積
    const buildingAreaMatch = cleanedBody.match(/建物面積[：:][\s　]*(\d+(?:\.\d+)?)/);
    const buildingArea = buildingAreaMatch ? buildingAreaMatch[1] : '';

    // 土地面積
    const landAreaMatch = cleanedBody.match(/土地面積[：:][\s　]*(\d+(?:\.\d+)?)/);
    const landArea = landAreaMatch ? landAreaMatch[1] : '';

    // 築年（西暦XXXX年）
    const builtYearMatch = cleanedBody.match(/築年[：:].*?西暦(\d{4})年/);
    const builtYear = builtYearMatch ? builtYearMatch[1] : '';

    // 現況
    const currentStatusRaw = extractByRegex(cleanedBody, /現況[：:][\s　]*(.*?)(?=\s{2,}[\S]|\s*名義)/);
    let propertyStatus = '';
    if (currentStatusRaw.includes('居住中')) propertyStatus = '居';
    else if (currentStatusRaw.includes('空き') || currentStatusRaw.includes('空家')) propertyStatus = '空';
    else if (currentStatusRaw.includes('賃貸')) propertyStatus = '賃';
    else if (currentStatusRaw) propertyStatus = '他';

    // 売却理由
    const reasonMatch = cleanedBody.match(/売却理由[：:][\s　]*(.*?)(?=\s{2,}[\S]|\s*売却希望時期)/);
    const reasonForEstimate = reasonMatch ? reasonMatch[1].trim() : '';

    // お名前
    const nameMatch = cleanedBody.match(/お名前[：:][\s　]*([^\s　]+(?:[\s　][^\s　]+)?)/);
    const name = nameMatch ? nameMatch[1].trim() : '';

    // フリガナ
    const furiganaMatch = cleanedBody.match(/フリガナ[：:][\s　]*([^\s　]+(?:[\s　][^\s　]+)?)/);
    const furigana = furiganaMatch ? furiganaMatch[1].trim() : '';

    // ご住所
    const userAddressMatch = cleanedBody.match(/ご住所[：:][\s　]*([^\s　](?:.*?)?)(?=\s{2,}[\S]|\s*電話番号)/);
    const userAddress = userAddressMatch ? userAddressMatch[1].trim() : '';

    // 電話番号
    const telMatch = cleanedBody.match(/電話番号[：:][\s　]*([\d\-]+)/);
    const tel = telMatch ? telMatch[1].replace(/-/g, '') : '';

    // メールアドレス
    const emailMatch = cleanedBody.match(/メールアドレス[：:][\s　]*([^\s　]+@[^\s　]+)/);
    const email = emailMatch ? emailMatch[1].trim() : '';

    // 希望の連絡時間
    const contactTimeMatch = cleanedBody.match(/希望の連絡時間[：:][\s　]*(.*?)(?=\s{2,}[\S]|\s*希望の連絡方法)/);
    const contactTime = contactTimeMatch ? contactTimeMatch[1].trim() : '';

    // 同時送信社数
    const estimateCountMatch = cleanedBody.match(/同時送信社数[：:][\s　]*(\d+社?)/);
    const estimateCount = estimateCountMatch ? estimateCountMatch[1].trim() : '';

    // 売却希望時期
    const sellTimingMatch = cleanedBody.match(/売却希望時期[：:][\s　]*(.*?)(?=\s{2,}[\S]|\s*ご要望)/);
    const sellTiming = sellTimingMatch ? sellTimingMatch[1].trim() : '';

    // ご要望
    const requestMatch = cleanedBody.match(/ご要望[：:][\s　]*(.*?)(?=\s{2,}[\S]|\s*お名前)/);
    const requestToCompany = requestMatch ? requestMatch[1].trim() : '';

    // Manager URL
    const managerUrlMatch = mailBody.match(/(https:\/\/manager\.homes\.co\.jp\/[^\s]+)/);
    const managerUrl = managerUrlMatch ? managerUrlMatch[1].trim() : '';

    // 面積値の設定
    const areaValue = propertyTypeRaw.includes('マンション')
      ? buildingArea  // マンションは専有面積
      : buildingArea; // 戸建ては建物面積

    console.log(`[lifull-transfer] 抽出結果: name="${name}" tel="${tel}" address="${fullPropertyAddress}" type="${displayPropertyType}"`);

    // コメント作成
    const commentParts: string[] = [];
    if (furigana) commentParts.push(`フリガナ: ${furigana}`);
    if (contactTime && contactTime !== '指定なし') commentParts.push(`希望連絡時間: ${contactTime}`);
    if (sellTiming) commentParts.push(`売却希望時期: ${sellTiming}`);
    if (requestToCompany) commentParts.push(`ご要望: ${requestToCompany}`);
    if (estimateCount) commentParts.push(`同時送信社数: ${estimateCount}`);
    if (reasonForEstimate) commentParts.push(`売却理由: ${reasonForEstimate}`);
    const comments = `【以下自動転記（LIFULL HOME'S）】\n${commentParts.join('\n')}`;

    if (!name || !tel) {
      return res.status(400).json({ success: false, error: `名前または電話番号が取得できませんでした name=${name} tel=${tel}` });
    }

    // ============================================================
    // 1.5. 重複チェック（同一電話番号 かつ 同一反響日時の場合のみスキップ）
    // ============================================================
    {
      const { decrypt: decryptForCheck } = await import('../utils/encryption');
      const supabaseForCheck = (await import('../config/supabase')).default;

      const { data: allSellers, error: fetchError } = await supabaseForCheck
        .from('sellers')
        .select('id, seller_number, phone_number, inquiry_detailed_datetime, created_at')
        .is('deleted_at', null);

      if (!fetchError && allSellers) {
        for (const existing of allSellers) {
          if (!existing.phone_number) continue;
          try {
            const decryptedPhone = decryptForCheck(existing.phone_number);
            if (decryptedPhone === tel) {
              const existingDatetime = existing.inquiry_detailed_datetime;
              // receivedDateは「2026/06/16 14:26:33」形式 → 「2026-06-16 14:26:33」に統一して比較
              const normalizedReceived = receivedDate ? receivedDate.replace(/\//g, '-') : '';
              const normalizedExisting = existingDatetime
                ? existingDatetime.replace('T', ' ').substring(0, 19)
                : '';
              const isSameDatetime = normalizedReceived && normalizedExisting
                ? normalizedExisting === normalizedReceived || normalizedExisting.startsWith(normalizedReceived)
                : !normalizedReceived && !normalizedExisting;

              if (isSameDatetime) {
                // 同一電話番号 + 同一反響日時 = 完全に同じメールの二重処理 → スキップ
                console.log(`[lifull-transfer] ⏭ 重複スキップ: 反響日時一致 (既存: ${existing.seller_number})`);
                return res.json({
                  success: true,
                  skipped: true,
                  message: `重複スキップ: 反響日時一致 - 既存売主 ${existing.seller_number}`,
                  duplicateSeller: existing.seller_number,
                });
              } else {
                // 同一電話番号 + 反響日時が異なる = 別時期の依頼 → duplicate_confirmed: true でDB登録
                console.log(`[lifull-transfer] ⚠️ 同一電話番号 ${existing.seller_number} だが反響日時が異なるため重複フラグ付きで登録します`);
                (req as any)._isDuplicate = true;
                (req as any)._duplicateSeller = existing.seller_number;
                break;
              }
            }
          } catch {
            // 復号失敗はスキップ
          }
        }
      }
    }

    // ============================================================
    // 2. 売主番号採番（連番スプシから。GASと同じロジック）
    // ============================================================
    const isFukuoka = fullPropertyAddress.includes('福岡');
    const prefix = isFukuoka ? 'FI' : 'AA';
    const serialCell = isFukuoka ? 'I2' : 'C2';

    const { GoogleSheetsClient: GSClient } = await import('../services/GoogleSheetsClient');
    const serialSheetsClient = new GSClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: '連番',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await serialSheetsClient.authenticate();

    let sellerNumber = '';
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      const serialValues = await serialSheetsClient.readRawRange(serialCell);
      const currentNum = parseInt(String(serialValues?.[0]?.[0] || '0'), 10);
      const newNum = currentNum + 1;
      sellerNumber = `${prefix}${newNum}`;
      await serialSheetsClient.updateRawCell('連番', serialCell, newNum);

      const supabaseCheck = (await import('../config/supabase')).default;
      const { data: existing } = await supabaseCheck
        .from('sellers')
        .select('id')
        .eq('seller_number', sellerNumber)
        .maybeSingle();

      if (!existing) break;
      console.log(`[lifull-transfer] ⚠️ ${sellerNumber} は既に存在。リトライ ${retryCount + 1}/${maxRetries}`);
      retryCount++;
    }

    console.log(`[lifull-transfer] 売主番号採番: ${sellerNumber}`);

    // ============================================================
    // 3. DB INSERT（暗号化込み）
    // ============================================================
    const { encrypt } = await import('../utils/encryption');
    const supabase = (await import('../config/supabase')).default;

    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstToday = new Date(today.getTime() + jstOffset);
    const mm = String(jstToday.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstToday.getUTCDate()).padStart(2, '0');
    const nextCallDate = `${jstToday.getUTCFullYear()}-${mm}-${dd}`;

    const inquiryDateISO = requestDateObj.toISOString().split('T')[0];
    const inquiryYear = requestDateObj.getFullYear();

    const insertData: Record<string, any> = {
      seller_number: sellerNumber,
      name: encrypt(name),
      address: userAddress ? encrypt(userAddress) : null,
      phone_number: encrypt(tel),
      email: email ? encrypt(email) : null,
      property_address: fullPropertyAddress,
      property_type: displayPropertyType,
      inquiry_site: 'L',
      inquiry_date: inquiryDateISO,
      inquiry_year: inquiryYear,
      inquiry_detailed_datetime: receivedDate ? receivedDate : null,
      floor_plan: layout || null,
      build_year: builtYear ? parseInt(builtYear) : null,
      current_status: propertyStatus || null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: areaValue ? parseFloat(areaValue) : null,
      status: '追客中',
      next_call_date: nextCallDate,
      comments: comments,
      pinrich_status: '配信中',
      site_url: managerUrl || null,
      valuation_reason: reasonForEstimate || null,
      is_unreachable: false,
      duplicate_confirmed: (req as any)._isDuplicate === true,
    };

    const { data: seller, error: insertError } = await supabase
      .from('sellers')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !seller) {
      console.error('[lifull-transfer] DB INSERT エラー:', insertError);
      return res.status(500).json({ success: false, error: `DB INSERT失敗: ${insertError?.message}` });
    }

    console.log(`[lifull-transfer] DB INSERT成功: ${sellerNumber} (id: ${seller.id})`);

    // propertiesテーブル用のproperty_type変換
    const propertyTypeForDB = displayPropertyType === 'マ' ? 'マンション'
      : displayPropertyType === '戸' ? '戸建て'
      : displayPropertyType === '土' ? '土地'
      : displayPropertyType || null;

    // propertiesテーブルにも登録
    await supabase.from('properties').insert({
      seller_id: seller.id,
      property_address: fullPropertyAddress,
      property_type: propertyTypeForDB,
      floor_plan: layout || null,
      construction_year: builtYear ? parseInt(builtYear) : null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: areaValue ? parseFloat(areaValue) : null,
    });

    // DB INSERT完了後すぐにレスポンスを返す（スプシ同期はバックグラウンドで実行）
    res.json({
      success: true,
      sellerNumber,
      sellerId: seller.id,
      message: `${sellerNumber} をDBに登録しました`,
    });

    // ① サイドバーカウントを最優先で即時更新
    import('../services/SellerSidebarCountsUpdateService').then(({ SellerSidebarCountsUpdateService }) => {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseForCounts = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
      const updateService = new SellerSidebarCountsUpdateService(supabaseForCounts);
      updateService.updateSellerSidebarCounts().catch((e: any) =>
        console.error('[lifull-transfer] SidebarCounts update error:', e)
      );
    });

    // ② DB→スプシ同期（バックグラウンド実行）
    createSpreadsheetSyncService().then(syncService => {
      if (!syncService) return;
      syncService.syncToSpreadsheet(seller.id)
        .then(syncResult => {
          if (syncResult.success) {
            console.log(`[lifull-transfer] スプシ同期成功: ${sellerNumber}`);
          } else {
            console.warn(`[lifull-transfer] スプシ同期失敗（DB登録は成功）: ${syncResult.error}`);
          }
        })
        .catch((syncErr: any) => {
          console.warn(`[lifull-transfer] スプシ同期エラー（DB登録は成功）: ${syncErr.message}`);
        });
    }).catch((syncErr: any) => {
      console.warn(`[lifull-transfer] スプシ同期初期化エラー（DB登録は成功）: ${syncErr.message}`);
    });

  } catch (error: any) {
    console.error('[lifull-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
