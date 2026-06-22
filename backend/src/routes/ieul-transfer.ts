// イエウール査定依頼メール転記ルート
// 【変更ルール】このファイルはイエウール専用。HOME4U/アットホーム修正時は絶対に触らない。

import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
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
 * POST /api/sellers/ieul-transfer
 * イエウールメール本文を受け取り、DB即時転記 + DB→スプシ即時同期を行う
 * CRON_SECRET認証（mail_notify.pyから呼び出される）
 */
router.post('/ieul-transfer', async (req: Request, res: Response) => {
  // CRON_SECRET認証（認証ミドルウェアをバイパスするため手動チェック）
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
    console.log('[ieul-transfer] イエウールメール本文解析開始');

    // ============================================================
    // 1. メール本文解析（GASのtransferIeuru相当）
    // ============================================================

    // Gmailスレッドヘッダー除去:
    // 返信スレッドで届いた場合、本文先頭に「イエウール運営事務局\n6:20 (XX 分前)\nTo 自分\n...」
    // のようなヘッダーが混入する。「■ 査定依頼情報」または「============」が出現する直前までを除去する。
    let processedMailBody = mailBody;
    const bodyStartPatterns = [
      /={10,}/,          // ===...===
      /■\s*査定依頼情報/,
    ];
    for (const pattern of bodyStartPatterns) {
      const m = processedMailBody.match(pattern);
      if (m && m.index !== undefined && m.index > 0) {
        // パターンより前にGmailヘッダーがある可能性があるので、
        // 「詳細は下記URLで」が含まれている行以降を本文とする
        const urlLineIdx = processedMailBody.indexOf('詳細は下記URLでご確認ください');
        if (urlLineIdx !== -1 && urlLineIdx < m.index) {
          // URL行から始まる部分を本文として使う
          processedMailBody = processedMailBody.slice(urlLineIdx);
          console.log('[ieul-transfer] Gmailスレッドヘッダーを除去しました');
          break;
        }
      }
    }

    // Gmailスレッド形式（スペース区切り1行）の場合、
    // 「物件住所」の後に改行がなくスペースで区切られるケースに対応するため
    // 「■ 不動産情報」以降のブロックを改行区切りに正規化する
    // （スペース区切りの場合: "物件住所　　　　: 福岡県... マンション名..." のように1行になる）
    const hasLineBreaks = /物件住所[\s　]*:[\s　]*(.*?)[\r\n]/.test(processedMailBody);
    if (!hasLineBreaks) {
      // スペース区切り形式の場合、「■」や主要フィールドラベルの前に改行を挿入して正規化
      console.log('[ieul-transfer] スペース区切り形式を検出 → 改行を正規化します');
      processedMailBody = processedMailBody
        .replace(/ (■ 査定依頼情報)/g, '\n$1')
        .replace(/ (■ 不動産情報)/g, '\n$1')
        .replace(/ (■ ユーザ情報)/g, '\n$1')
        .replace(/ (依頼日時[\s　]*[:：])/g, '\n$1')
        .replace(/ (同時査定社数[\s　]*[:：])/g, '\n$1')
        .replace(/ (物件種別[\s　　]*[:：])/g, '\n$1')
        .replace(/ (物件住所[\s　　]*[:：])/g, '\n$1')
        .replace(/ (マンション名[\s　　]*[:：])/g, '\n$1')
        .replace(/ (部屋番号[\s　　]*[:：])/g, '\n$1')
        .replace(/ (建物名[\s　　]*[:：])/g, '\n$1')
        .replace(/ (専有面積[\s　　]*[:：])/g, '\n$1')
        .replace(/ (建物面積[\s　　]*[:：])/g, '\n$1')
        .replace(/ (土地面積[\s　　]*[:：])/g, '\n$1')
        .replace(/ (延べ床面積[\s　　]*[:：])/g, '\n$1')
        .replace(/ (間取り[\s　　]*[:：])/g, '\n$1')
        .replace(/ (築年数[\s　　]*[:：])/g, '\n$1')
        .replace(/ (物件の状況[\s　　]*[:：])/g, '\n$1')
        .replace(/ (物件との関係[\s　　]*[:：])/g, '\n$1')
        .replace(/ (氏名[\s　　]*[:：])/g, '\n$1')
        .replace(/ (フリガナ[\s　　]*[:：])/g, '\n$1')
        .replace(/ (年齢[\s　　]*[:：])/g, '\n$1')
        .replace(/ (住所[\s　　]*[:：])/g, '\n$1')
        .replace(/ (電話番号[\s　　]*[:：])/g, '\n$1')
        .replace(/ (Email[\s　　]*[:：])/g, '\n$1')
        .replace(/ (希望連絡時間[\s　　]*[:：])/g, '\n$1')
        .replace(/ (査定理由[\s　　]*[:：])/g, '\n$1')
        .replace(/ (査定会社への要望[:：])/g, '\n$1')
        .replace(/ (買い替え有無[\s　　]*[:：])/g, '\n$1')
        .replace(/ (査定方法[\s　　]*[:：])/g, '\n$1')
        .replace(/ (コメント[\s　　]*[:：])/g, '\n$1');
    }

    const cleanedBody = processedMailBody.replace(/\r?\n|\r/g, ' ');

    const extractData = (text: string, from: string, to: string): string => {
      const fromIndex = text.indexOf(from);
      if (fromIndex === -1) return '';
      const start = fromIndex + from.length;
      const toIndex = text.indexOf(to, start);
      return text.substring(start, toIndex === -1 ? text.length : toIndex).trim();
    };

    const extractNumeric = (str: string): string => {
      if (!str) return '';
      const m = str.match(/(\d+(?:\.\d+)?)/);
      return m ? m[1] : '';
    };

    const extractYear = (str: string): string => {
      if (!str) return '';
      const m = str.match(/(\d{4})/);
      return m ? m[1] : '';
    };

    const convertStatus = (status: string): string => {
      if (!status) return '';
      if (status.includes('居住中')) return '居';
      if (status.includes('空き')) return '空';
      if (status.includes('賃貸')) return '賃';
      return '他';
    };

    // 依頼日時
    const requestDateMatch = cleanedBody.match(
      /依頼日時[\s　]*[:：][\s　]*([0-9]{4}[-\/][0-9]{1,2}[-\/][0-9]{1,2}[\s　]+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/
    );
    const requestDate = requestDateMatch ? requestDateMatch[1].trim() : '';
    const requestDateObj = requestDate ? new Date(requestDate) : new Date();

    // 不動産情報
    const propertyTypeRaw = extractData(cleanedBody, '物件種別　　　　: ', '物件住所');
    let displayPropertyType = propertyTypeRaw;
    if (propertyTypeRaw.includes('一戸建て')) displayPropertyType = '戸';
    else if (propertyTypeRaw.includes('マンション')) displayPropertyType = 'マ';
    else if (propertyTypeRaw.includes('土地')) displayPropertyType = '土';

    // 物件住所（改行ありの本文から直接抽出）
    // 「物件住所」〜「マンション名」の間を取得（スペース数が可変なので \s* で対応）
    // processedMailBody（改行正規化済み）から取得する
    const addrMatch = processedMailBody.match(/物件住所[\s　]*:[\s　]*(.*?)[\r\n]/);
    const fullPropertyAddress = addrMatch ? addrMatch[1].replace(/^大分県/, '').trim() : '';
    console.log(`[ieul-transfer] 物件住所抽出: "${fullPropertyAddress}"`);

    const mansionName = extractData(cleanedBody, 'マンション名　　: ', '部屋番号');
    const roomNumber = extractData(cleanedBody, '部屋番号　　　　: ', '建物名');
    const exclusiveArea = extractData(cleanedBody, '専有面積　　　　: ', '建物面積');
    const buildingArea = extractData(cleanedBody, '建物面積　　　　: ', '土地面積');
    const landArea = extractData(cleanedBody, '土地面積　　　　: ', '延べ床面積');
    const layout = extractData(cleanedBody, '間取り　　　　　: ', '築年数');
    const builtYear = extractYear(extractData(cleanedBody, '築年数　　　　　: ', '物件の状況'));
    const propertyStatus = convertStatus(extractData(cleanedBody, '物件の状況　　　: ', '物件との関係'));
    const areaValue = propertyTypeRaw.includes('マンション')
      ? extractNumeric(exclusiveArea)
      : extractNumeric(buildingArea);
    const landAreaNum = extractNumeric(landArea);

    // ユーザ情報
    const name = extractData(cleanedBody, '氏名　　　　　　: ', 'フリガナ');
    const furigana = extractData(cleanedBody, 'フリガナ　　　　: ', '年齢');
    const age = extractData(cleanedBody, '年齢　　　　　　: ', '住所');
    const address = extractData(cleanedBody, '住所　　　　　　: ', '電話番号');
    const tel = extractData(cleanedBody, '電話番号　　　　: ', 'Email').replace(/-/g, '');
    // Emailフィールドのスペースは可変（"Email 　　　　　: " または "Email　　　　　 : "）
    const emailMatch = cleanedBody.match(/Email[\s　]+:[\s　]*([^\s　\r\n]+)/);
    const email = emailMatch ? emailMatch[1].trim() : '';
    const contactTime = extractData(cleanedBody, '希望連絡時間　　: ', '査定理由');
    const reasonForEstimate = extractData(cleanedBody, '査定理由　　　　: ', '査定会社への要望');
    const requestToCompany = extractData(cleanedBody, '査定会社への要望: ', '買い替え有無');
    const estimateCount = extractData(cleanedBody, '同時査定社数　　: ', '■ 不動産情報');
    const detailUrl = extractData(cleanedBody, '詳細は下記URLでご確認ください。', '============================================================');

    // コメント抽出
    const commentStart = cleanedBody.indexOf('コメント');
    let commentToAdd = '';
    if (commentStart !== -1) {
      let sub = cleanedBody.slice(commentStart + 'コメント'.length);
      const endIdx = sub.indexOf('============================================================');
      if (endIdx !== -1) sub = sub.slice(0, endIdx);
      commentToAdd = sub.trim();
    }

    const commentParts: string[] = [];
    if (furigana) commentParts.push(`フリガナ: ${furigana}`);
    if (age) commentParts.push(`年齢: ${age}`);
    if (contactTime) commentParts.push(`希望連絡時間: ${contactTime}`);
    if (requestToCompany) commentParts.push(`査定会社への要望: ${requestToCompany}`);
    if (estimateCount) commentParts.push(`同時送信社数: ${estimateCount}`);
    if (commentToAdd) commentParts.push(`コメント: ${commentToAdd}`);
    const comments = `【以下自動転記（イエウール）】\n${commentParts.join('\n')}`;

    if (!name || !tel) {
      return res.status(400).json({ success: false, error: `名前または電話番号が取得できませんでした name=${name} tel=${tel}` });
    }

    // ============================================================
    // 1.5. 重複チェック（同一電話番号 かつ 同一反響日時の場合のみスキップ）
    // イエウールも同じ案件を複数社に配信する可能性があるため、
    // 直近10分以内の同一電話番号登録もスキップする。
    // 過去に同じ人から別の時期に依頼が来た場合は新規登録する
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
              // 電話番号が一致しても、反響日時が異なれば別依頼として登録する
              // 反響日時が同じ（または両方nullで日時不明）の場合のみスキップ
              const existingDatetime = existing.inquiry_detailed_datetime;
              const isSameDatetime = existingDatetime && requestDate
                ? existingDatetime === requestDate || existingDatetime.startsWith(requestDate.replace(' ', 'T'))
                : !existingDatetime && !requestDate; // 両方nullの場合のみ重複とみなす

              if (isSameDatetime) {
                // 同一電話番号 + 同一反響日時 = 完全に同じメールの二重処理 → スキップ
                console.log(`[ieul-transfer] ⏭ 重複スキップ: 反響日時一致 (既存: ${existing.seller_number})`);
                return res.json({
                  success: true,
                  skipped: true,
                  message: `重複スキップ: 反響日時一致 - 既存売主 ${existing.seller_number}`,
                  duplicateSeller: existing.seller_number,
                });
              } else {
                // 同一電話番号 + 反響日時が異なる = 別時期の依頼 → duplicate_confirmed: true でDB登録
                console.log(`[ieul-transfer] ⚠️ 同一電話番号 ${existing.seller_number} だが反響日時が異なるため重複フラグ付きで登録します (既存: ${existingDatetime}, 今回: ${requestDate})`);
                // ループを抜けて登録処理へ（duplicate_confirmed = true をセットするフラグを立てる）
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

    const { GoogleSheetsClient } = await import('../services/GoogleSheetsClient');
    const serialSheetsClient = new GoogleSheetsClient({
      spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
      sheetName: '連番',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    await serialSheetsClient.authenticate();

    // 現在値を読んで+1した値を書き込む（GASと同じ動作）
    // 重複時はリトライ（同時実行による競合対策）
    let sellerNumber = '';
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      const serialValues = await serialSheetsClient.readRawRange(serialCell);
      const currentNum = parseInt(String(serialValues?.[0]?.[0] || '0'), 10);
      const newNum = currentNum + 1;
      sellerNumber = `${prefix}${newNum}`;
      await serialSheetsClient.updateRawCell('連番', serialCell, newNum);

      // 既に同じ番号がDBに存在するか確認
      const supabaseCheck = (await import('../config/supabase')).default;
      const { data: existing } = await supabaseCheck
        .from('sellers')
        .select('id')
        .eq('seller_number', sellerNumber)
        .maybeSingle();

      if (!existing) break; // 重複なし → 採番成功
      console.log(`[ieul-transfer] ⚠️ ${sellerNumber} は既に存在。リトライ ${retryCount + 1}/${maxRetries}`);
      retryCount++;
    }

    console.log(`[ieul-transfer] 売主番号採番: ${sellerNumber}`);

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
      address: address ? encrypt(address) : null,
      phone_number: encrypt(tel),
      phone_number_hash: tel ? crypto.createHash('sha256').update(tel).digest('hex') : null,
      email: email ? encrypt(email) : null,
      email_hash: email ? crypto.createHash('sha256').update(email).digest('hex') : null,
      property_address: fullPropertyAddress + mansionName + roomNumber,
      property_type: displayPropertyType,
      inquiry_site: 'ウ',
      inquiry_date: inquiryDateISO,
      inquiry_year: inquiryYear,
      inquiry_detailed_datetime: requestDate ? requestDate : null,
      floor_plan: layout || null,
      build_year: builtYear ? parseInt(builtYear) : null,
      current_status: propertyStatus || null,
      land_area: landAreaNum ? parseFloat(landAreaNum) : null,
      building_area: areaValue ? parseFloat(areaValue) : null,
      status: '追客中',
      next_call_date: nextCallDate,
      comments: comments,
      pinrich_status: '配信中',
      site_url: detailUrl || null,
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
      // UNIQUE制約違反（23505）= 並行リクエストによる重複INSERT → スキップ扱い
      if (insertError?.code === '23505') {
        console.log(`[ieul-transfer] ⏭ UNIQUE制約違反によりスキップ（並行リクエストの重複）: tel_hash=${insertData.phone_number_hash?.substring(0, 8)}... datetime=${requestDate}`);
        return res.json({
          success: true,
          skipped: true,
          message: '重複スキップ（UNIQUE制約違反 - 並行リクエスト）',
        });
      }
      console.error('[ieul-transfer] DB INSERT エラー:', insertError);
      return res.status(500).json({ success: false, error: `DB INSERT失敗: ${insertError?.message}` });
    }

    console.log(`[ieul-transfer] DB INSERT成功: ${sellerNumber} (id: ${seller.id})`);

    // propertiesテーブル用のproperty_type変換（マ→マンション等）
    const propertyTypeForDB = displayPropertyType === 'マ' ? 'マンション'
      : displayPropertyType === '戸' ? '戸建て'
      : displayPropertyType === '土' ? '土地'
      : displayPropertyType || null;

    // propertiesテーブルにも登録
    await supabase.from('properties').insert({
      seller_id: seller.id,
      property_address: fullPropertyAddress + mansionName + roomNumber,
      property_type: propertyTypeForDB,
      floor_plan: layout || null,
      construction_year: builtYear ? parseInt(builtYear) : null,
      land_area: landAreaNum ? parseFloat(landAreaNum) : null,
      building_area: areaValue ? parseFloat(areaValue) : null,
    });

    // DB INSERT完了後すぐにレスポンスを返す（スプシ同期はバックグラウンドで実行）
    res.json({
      success: true,
      sellerNumber,
      sellerId: seller.id,
      message: `${sellerNumber} をDBに登録しました`,
    });

    // ① サイドバーカウントを最優先で即時更新（未着手カテゴリーへの反映）
    import('../services/SellerSidebarCountsUpdateService').then(({ SellerSidebarCountsUpdateService }) => {
      const { createClient } = require('@supabase/supabase-js');
      const supabaseForCounts = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
      const updateService = new SellerSidebarCountsUpdateService(supabaseForCounts);
      updateService.updateSellerSidebarCounts().catch((e: any) =>
        console.error('⚠️ [ieul-transfer] SidebarCounts update error:', e)
      );
    });

    // ② DB→スプシ同期（バックグラウンド実行 - サイドバー更新の後）
    createSpreadsheetSyncService().then(syncService => {
      if (!syncService) return;
      syncService.syncToSpreadsheet(seller.id)
        .then(syncResult => {
          if (syncResult.success) {
            console.log(`[ieul-transfer] スプシ同期成功: ${sellerNumber}`);
          } else {
            console.warn(`[ieul-transfer] スプシ同期失敗（DB登録は成功）: ${syncResult.error}`);
          }
        })
        .catch((syncErr: any) => {
          console.warn(`[ieul-transfer] スプシ同期エラー（DB登録は成功）: ${syncErr.message}`);
        });
    }).catch((syncErr: any) => {
      console.warn(`[ieul-transfer] スプシ同期初期化エラー（DB登録は成功）: ${syncErr.message}`);
    });

  } catch (error: any) {
    console.error('[ieul-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});
export default router;
