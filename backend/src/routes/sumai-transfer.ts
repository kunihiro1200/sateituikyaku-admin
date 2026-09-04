// すまいステップ査定依頼メール転記ルート
// 【変更ルール】このファイルはすまいステップ専用。イエウール/HOME4U/LIFULL/アットホーム修正時は絶対に触らない。
// GASの transferSumai() 相当をNode/Express + Supabaseに移植したもの。

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

// 坪→㎡変換（GASのconvertTsuboToHeibeiと同じロジック: 1坪=3.3㎡換算）
function convertTsuboToHeibei(tsubo: string): string {
  const numericValue = parseFloat(tsubo.replace('坪', ''));
  if (isNaN(numericValue)) return '';
  return String(numericValue * 3.3);
}

/**
 * POST /api/sellers/sumai-transfer
 * すまいステップメール本文を受け取り、DB即時転記 + DB→スプシ即時同期を行う
 * CRON_SECRET認証（mail_notify_server.pyから呼び出される）
 */
router.post('/sumai-transfer', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';
  if (authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { body: mailBody } = req.body;
  if (!mailBody || typeof mailBody !== 'string') {
    return res.status(400).json({ success: false, error: 'mailBody is required' });
  }

  // すまいステップの本文条件（GASと同じ: 1年以内の反響のみ閲覧できますという文言が必須）
  if (!mailBody.includes('1年以内の反響のみ閲覧できます')) {
    return res.json({ success: true, skipped: true, message: '「1年以内の反響のみ閲覧できます」が含まれないためスキップ' });
  }

  try {
    console.log('[sumai-transfer] すまいステップメール本文解析開始');

    // 改行をスペースに置き換える（GASと同じ前処理）
    const cleanedBody = mailBody.replace(/\r?\n|\r/g, ' ');

    const extractData = (text: string, from: string, to: string): string => {
      const fromIndex = text.indexOf(from);
      if (fromIndex === -1) return '';
      const start = fromIndex + from.length;
      const toIndex = to ? text.indexOf(to, start) : -1;
      return text.substring(start, toIndex === -1 ? text.length : toIndex).trim();
    };

    const extractNumeric = (str: string): string => {
      if (!str) return '';
      const m = str.match(/(\d+(?:\.\d+)?)/);
      return m ? m[1] : '';
    };

    // メモ・最終更新日時
    const memo = extractData(cleanedBody, 'メモ', '最終更新日時：');
    // 管理番号
    const managementNumber = extractData(cleanedBody, '管理番号', '反響日時');

    // 反響日時
    let inquiryDateTime = '';
    const inquiryMatch = mailBody.match(
      /反響日時\s*[:：]?\s*([0-9]{4}[\/\-年][0-9]{1,2}[\/\-月][0-9]{1,2}[日]?\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/
    );
    if (inquiryMatch) {
      inquiryDateTime = inquiryMatch[1].replace('年', '/').replace('月', '/').replace('日', '').trim();
    }
    console.log(`[sumai-transfer] inquiryDateTime: "${inquiryDateTime}"`);
    // PostgreSQL TIMESTAMP用にISO形式へ変換（「2026/06/16 14:26:33」→「2026-06-16T14:26:33」）
    const inquiryDateTimeISO = inquiryDateTime
      ? inquiryDateTime.replace(/^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/, (_m, y, mo, d, t) => {
          return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${t.length === 5 ? t + ':00' : t}`;
        })
      : null;

    // 物件種別
    const propertyTypeRaw = extractData(cleanedBody, '物件種別', '物件住所');
    let displayPropertyType = propertyTypeRaw;
    if (propertyTypeRaw.includes('一戸建て')) displayPropertyType = '戸';
    else if (propertyTypeRaw.includes('マンション一室') || propertyTypeRaw.includes('マンション')) displayPropertyType = 'マ';
    else if (propertyTypeRaw.includes('土地')) displayPropertyType = '土';

    // 物件住所（大分県を除去）
    let propertyAddress = extractData(cleanedBody, '物件住所', '物件にお住まい').replace(/^大分県/, '').trim();

    // 建物面積（種別により抽出元が異なる：戸建て=延べ床面積、マンション=専有面積）
    let totalFloorArea = '';
    if (displayPropertyType === '戸') {
      totalFloorArea = extractData(cleanedBody, ' 延べ床面積 ', ' 土地面積 ');
    } else if (displayPropertyType === 'マ') {
      totalFloorArea = extractData(cleanedBody, '専有面積', '築年');
    }
    if (/坪/.test(totalFloorArea)) {
      totalFloorArea = convertTsuboToHeibei(totalFloorArea);
    } else if (/m2|㎡/.test(totalFloorArea)) {
      totalFloorArea = extractNumeric(totalFloorArea);
    }

    // 土地面積
    let landArea = extractData(cleanedBody, ' 土地面積 ', ' 築年 ');
    if (/坪/.test(landArea)) {
      landArea = convertTsuboToHeibei(landArea);
    } else if (/m2|㎡/.test(landArea)) {
      landArea = extractNumeric(landArea);
    }

    // 築年
    const builtYearRaw = extractData(cleanedBody, '築年', '間取り');
    const builtYear = builtYearRaw.replace(/年/g, '').trim();

    // 間取り・道路の接面状況・バルコニーの方角
    // マンションの場合のみ「間取り」の後に「道路の接面状況」「バルコニーの方角」が続くため、
    // 「道路の接面状況」の有無で終端マーカーを切り替える（GASのtransferSumaiと同じ分岐）
    const hasRoadAccessField = cleanedBody.indexOf('道路の接面状況') !== -1;
    const layout = hasRoadAccessField
      ? extractData(cleanedBody, '間取り', '道路の接面状況')
      : extractData(cleanedBody, '間取り', '現在の状況');
    const roadAccess = hasRoadAccessField
      ? extractData(cleanedBody, '道路の接面状況', 'バルコニーの方角')
      : '';
    const balconyDirection = hasRoadAccessField
      ? extractData(cleanedBody, 'バルコニーの方角', '現在の状況')
      : '';

    // 現況・賃料
    // 「賃料」フィールドが存在する場合（賃貸中の場合）のみ、現在の状況の終端マーカーを「賃料」に切り替える
    // （GASのtransferSumaiと同じ分岐）
    const hasRentField = cleanedBody.indexOf('賃料') !== -1;
    const currentStatusRaw = hasRentField
      ? extractData(cleanedBody, '現在の状況', '賃料')
      : extractData(cleanedBody, '現在の状況', '物件の関係');
    const rent = hasRentField ? extractData(cleanedBody, '賃料', '物件の関係') : '';
    const convertStatus = (s: string): string => {
      if (!s) return '';
      if (s.includes('居住中')) return '居';
      if (s.includes('空き')) return '空';
      if (s.includes('賃貸')) return '賃';
      return '他';
    };
    const propertyStatus = convertStatus(currentStatusRaw);

    // 物件の関係
    const relationToProperty = extractData(cleanedBody, '物件の関係', '査定の理由');

    // 査定理由・方法・希望時期・要望
    const assessmentReason = extractData(cleanedBody, '査定の理由', '査定の方法');
    const assessmentMethod = extractData(cleanedBody, '査定の方法', '売却の希望時期');
    const desiredSaleTime = extractData(cleanedBody, '売却の希望時期', 'ご要望・ご質問');
    const requests = extractData(cleanedBody, 'ご要望・ご質問', '連絡先');

    // ユーザ情報
    const name = extractData(cleanedBody, '氏名', 'フリガナ');
    const furigana = extractData(cleanedBody, 'フリガナ', '年齢');
    const age = extractData(cleanedBody, '年齢', '電話番号');
    const tel = extractData(cleanedBody, '電話番号', 'メールアドレス').replace(/-/g, '');
    const email = extractData(cleanedBody, 'メールアドレス', '郵便番号');
    const currentAddress = extractData(cleanedBody, 'お住まいの住所', 'アンケート結果');
    const preferredContactTime = extractData(cleanedBody, '連絡が取れやすい時間帯', '売却希望価格');
    const desiredSalePrice = extractData(cleanedBody, '売却希望価格', '売却活動に関する要望');
    // 「売却活動に関する要望」は単一行の回答フィールドのため、そのラベルが書かれた行のみを取得する
    // （Re:メールではこの後に署名やGmail引用ブロックが続く可能性があるため、末尾まで丸ごと取得しない）
    const saleActivityMatch = mailBody.match(/売却活動に関する要望[\s　]*[:：]?[\s　]*([^\r\n]*)/);
    const saleActivityRequests = saleActivityMatch ? saleActivityMatch[1].trim() : '';

    console.log(`[sumai-transfer] 抽出結果: name="${name}" tel="${tel}" address="${propertyAddress}" type="${displayPropertyType}"`);

    if (!name || !tel) {
      return res.status(400).json({ success: false, error: `名前または電話番号が取得できませんでした name=${name} tel=${tel}` });
    }

    // アンケート結果以下を原文の改行のまま取得（GASのextractSurveyResultと同じ）
    // Re:返信メールでは、この後にGmailの引用ブロック（"> "で始まる行、
    // "2026年X月X日(X) HH:MM ... wrote:"等の引用ヘッダー）や署名が続く可能性があるため、
    // そのような境界が見つかった場合はそこで打ち切る
    const surveyResultIdx = mailBody.indexOf('アンケート結果');
    let surveyResult = surveyResultIdx !== -1 ? mailBody.substring(surveyResultIdx) : '';
    const quoteBoundaryMatch = surveyResult.match(/\r?\n[ \t]*(?:>|On .+wrote:|\d{4}年\d{1,2}月\d{1,2}日.*(?:さんが書きました|wrote:))/i);
    if (quoteBoundaryMatch && quoteBoundaryMatch.index !== undefined) {
      surveyResult = surveyResult.substring(0, quoteBoundaryMatch.index);
    }
    surveyResult = surveyResult.trim();

    // コメント作成（GASのtransferSumaiと同じ構成）
    const comments = `${memo ? memo + '\n' : ''}【以下自動転記（すまいステップ）】\n★読み方:${furigana}\n★要望:${requests}\n★査定方法:${assessmentMethod}\n★希望連絡時間：${preferredContactTime}\n★売却活動に対する要望:${saleActivityRequests}\n★アンケート結果:${surveyResult}\n★道路の接面状況:${roadAccess}\n★バルコニーの方角:${balconyDirection}\n★現在の状況:${currentStatusRaw}\n★賃料:${rent}\n★物件の関係:${relationToProperty}\n★査定の理由:${assessmentReason}\n★売却希望時期:${desiredSaleTime}\n★売却希望価格:${desiredSalePrice}\n★年齢${age}`;
    console.log(`[sumai-transfer] comments作成完了: "${comments.substring(0, 100)}"`);

    // ============================================================
    // 重複チェック（同一電話番号 かつ 同一反響日時の場合のみスキップ）
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
              const isSameDatetime = existingDatetime && inquiryDateTimeISO
                ? existingDatetime === inquiryDateTimeISO || existingDatetime.startsWith(inquiryDateTimeISO)
                : !existingDatetime && !inquiryDateTimeISO;

              if (isSameDatetime) {
                console.log(`[sumai-transfer] ⏭ 重複スキップ: 反響日時一致 (既存: ${existing.seller_number})`);
                return res.json({
                  success: true,
                  skipped: true,
                  message: `重複スキップ: 反響日時一致 - 既存売主 ${existing.seller_number}`,
                  duplicateSeller: existing.seller_number,
                });
              } else {
                console.log(`[sumai-transfer] ⚠️ 同一電話番号 ${existing.seller_number} だが反響日時が異なるため重複フラグ付きで登録します`);
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
    // 売主番号採番（連番スプシから。GASと同じロジック）
    // ============================================================
    const isFukuoka = propertyAddress.includes('福岡');
    const prefix = isFukuoka ? 'FI' : 'AA';
    const serialCell = isFukuoka ? 'I2' : 'C2';

    const serialSheetsClient = new GoogleSheetsClient({
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
      console.log(`[sumai-transfer] ⚠️ ${sellerNumber} は既に存在。リトライ ${retryCount + 1}/${maxRetries}`);
      retryCount++;
    }

    console.log(`[sumai-transfer] 売主番号採番: ${sellerNumber}`);

    // ============================================================
    // DB INSERT（暗号化込み）
    // ============================================================
    const { encrypt } = await import('../utils/encryption');
    const supabase = (await import('../config/supabase')).default;

    const today = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const jstToday = new Date(today.getTime() + jstOffset);
    const mm = String(jstToday.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(jstToday.getUTCDate()).padStart(2, '0');
    const nextCallDate = `${jstToday.getUTCFullYear()}-${mm}-${dd}`;

    const requestDateObj = inquiryDateTime ? new Date(inquiryDateTime.replace(/\//g, '-')) : new Date();
    const inquiryDateISO = requestDateObj instanceof Date && !isNaN(requestDateObj.getTime())
      ? requestDateObj.toISOString().split('T')[0]
      : nextCallDate;
    const inquiryYear = requestDateObj instanceof Date && !isNaN(requestDateObj.getTime())
      ? requestDateObj.getFullYear()
      : jstToday.getUTCFullYear();

    const insertData: Record<string, any> = {
      seller_number: sellerNumber,
      name: encrypt(name),
      address: currentAddress ? encrypt(currentAddress) : null,
      phone_number: encrypt(tel),
      phone_number_hash: tel ? crypto.createHash('sha256').update(tel).digest('hex') : null,
      email: email ? encrypt(email) : null,
      email_hash: email ? crypto.createHash('sha256').update(email).digest('hex') : null,
      property_address: propertyAddress,
      property_type: displayPropertyType,
      inquiry_site: 'す',
      inquiry_date: inquiryDateISO,
      inquiry_year: inquiryYear,
      inquiry_detailed_datetime: inquiryDateTimeISO,
      floor_plan: layout || null,
      build_year: builtYear ? parseInt(builtYear) : null,
      current_status: propertyStatus || null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: totalFloorArea ? parseFloat(totalFloorArea) : null,
      status: '追客中',
      next_call_date: nextCallDate,
      comments: comments,
      pinrich_status: '配信中',
      valuation_reason: assessmentReason || null,
      is_unreachable: false,
      duplicate_confirmed: (req as any)._isDuplicate === true,
      inquiry_id: managementNumber || null,
    };

    const { data: seller, error: insertError } = await supabase
      .from('sellers')
      .insert(insertData)
      .select()
      .single();

    if (insertError || !seller) {
      if (insertError?.code === '23505') {
        console.log(`[sumai-transfer] ⏭ UNIQUE制約違反によりスキップ（並行リクエストの重複）: tel_hash=${insertData.phone_number_hash?.substring(0, 8)}... datetime=${inquiryDateTimeISO}`);
        return res.json({
          success: true,
          skipped: true,
          message: '重複スキップ（UNIQUE制約違反 - 並行リクエスト）',
        });
      }
      console.error('[sumai-transfer] DB INSERT エラー:', insertError);
      return res.status(500).json({ success: false, error: `DB INSERT失敗: ${insertError?.message}` });
    }

    console.log(`[sumai-transfer] DB INSERT成功: ${sellerNumber} (id: ${seller.id})`);

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
      floor_plan: layout || null,
      construction_year: builtYear ? parseInt(builtYear) : null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: totalFloorArea ? parseFloat(totalFloorArea) : null,
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
        console.error('⚠️ [sumai-transfer] SidebarCounts update error:', e)
      );
    });

    // ② DB→スプシ同期（バックグラウンド実行）
    createSpreadsheetSyncService().then(syncService => {
      if (!syncService) return;
      syncService.syncToSpreadsheet(seller.id)
        .then(syncResult => {
          if (syncResult.success) {
            console.log(`[sumai-transfer] スプシ同期成功: ${sellerNumber}`);
          } else {
            console.warn(`[sumai-transfer] スプシ同期失敗（DB登録は成功）: ${syncResult.error}`);
          }
        })
        .catch((syncErr: any) => {
          console.warn(`[sumai-transfer] スプシ同期エラー（DB登録は成功）: ${syncErr.message}`);
        });
    }).catch((syncErr: any) => {
      console.warn(`[sumai-transfer] スプシ同期初期化エラー（DB登録は成功）: ${syncErr.message}`);
    });

  } catch (error: any) {
    console.error('[sumai-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
