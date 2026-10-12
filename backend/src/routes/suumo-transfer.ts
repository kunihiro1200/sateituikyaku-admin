// SUUMO（リクルートＪＤＳ）売却査定反響メール転記ルート（売主向け）
// 【変更ルール】このファイルはSUUMO(リクルートＪＤＳ)の「売却査定」反響専用（売主リストへ転記）。
//   買主向けの suumo-buyer-transfer.ts や、イエウール/HOME4U/LIFULL/すまいステップ/アットホームの
//   transfer 系は絶対に触らない。
//
// 件名: 「[リクルートＪＤＳ]反響お知らせメール」（Re: 付きのスタッフ返信を転記対象とする）
// 本文: リクルート住宅情報ダウンロードシステム（JDS）の「反響詳細」画面をコピーした内容。
//   例) ■お客様プロフィール / 氏名（漢字） / 電話番号 / メールアドレス / 住所 /
//       ■査定希望物件内容 / 住所 / 物件種別 / 土地面積 / 建物延べ面積 / 売却予定時期 / 査定の要望 ...
//
// mail_notify_server.py から CRON_SECRET 認証で呼び出される。
// sumai-transfer.ts（すまいステップ・売主向け）を踏襲している。

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

// 面積文字列から数値（㎡）を抽出。「約150㎡」「150m2」「約150平米」等に対応。
function extractAreaNumeric(str: string): string {
  if (!str) return '';
  const m = str.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : '';
}

/**
 * POST /api/sellers/suumo-transfer
 * SUUMO（リクルートＪＤＳ）売却査定反響メール本文を受け取り、
 * DB即時転記（売主リスト） + DB→スプシ即時同期を行う。
 * CRON_SECRET認証（mail_notify_server.pyから呼び出される）
 */
router.post('/suumo-transfer', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { body: mailBody } = req.body;
  if (!mailBody || typeof mailBody !== 'string') {
    return res.status(400).json({ success: false, error: 'mailBody is required' });
  }

  // JDS反響詳細画面の本文であることの最低条件。
  // スタッフが反響詳細をコピーすると必ず「査定希望物件」もしくは「お客様プロフィール」が含まれる。
  // 通知のみの元メール（反響詳細を含まない自動通知）は転記しない。
  if (!mailBody.includes('査定希望物件') && !mailBody.includes('お客様プロフィール')) {
    return res.json({
      success: true,
      skipped: true,
      message: 'JDS反響詳細（査定希望物件／お客様プロフィール）が含まれないためスキップ',
    });
  }

  try {
    console.log('[suumo-transfer] SUUMO(JDS)売却査定反響メール本文解析開始');

    // 改行を統一
    const text = mailBody.replace(/\r\n|\n\r|\r/g, '\n');

    // 「項目名：値」形式（半角/全角コロン）。値は行末まで取り、末尾空白を trim する。
    const extractField = (fieldName: string): string => {
      const regex = new RegExp(fieldName + '[　\\s]*[：:]?[　\\s]*([^\\n]*)');
      const m = text.match(regex);
      return m ? m[1].trim() : '';
    };

    // ===== お客様プロフィール =====
    // 氏名（漢字）を優先。無ければ 氏名（カナ）、さらに無ければ 氏名。
    let name = extractField('氏名（漢字）');
    if (!name) name = extractField('氏名（カナ）');
    if (!name) name = extractField('氏名');
    const furigana = extractField('氏名（カナ）');
    const email = extractField('メールアドレス');
    const tel = extractField('電話番号').replace(/[-\s－　]/g, '');
    const postalCode = extractField('郵便番号');
    // お客様の現住所（「住所」は査定希望物件側にもあるため、プロフィール側の最初の出現を使う）
    const customerAddress = extractField('住所');
    const preferredContact = extractField('希望連絡方法');

    // ===== 問合せ情報 =====
    // 反響日時 = JDSの「お問合せ日時」（例: 2026/10/11 22:10:13）
    let inquiryDateTime = '';
    const inquiryMatch = text.match(
      /お問合せ日時[　\s]*[：:]?[　\s]*([0-9]{4}[\/\-年][0-9]{1,2}[\/\-月][0-9]{1,2}[日]?\s+[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/
    );
    if (inquiryMatch) {
      inquiryDateTime = inquiryMatch[1]
        .replace('年', '/')
        .replace('月', '/')
        .replace('日', '')
        .trim();
    }
    console.log(`[suumo-transfer] inquiryDateTime: "${inquiryDateTime}"`);
    // PostgreSQL TIMESTAMP用にISO形式へ（「2026/10/11 22:10:13」→「2026-10-11T22:10:13」）
    const inquiryDateTimeISO = inquiryDateTime
      ? inquiryDateTime.replace(
          /^(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}:\d{2}(?::\d{2})?)$/,
          (_m, y, mo, d, t) =>
            `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${t.length === 5 ? t + ':00' : t}`
        )
      : null;

    // 管理番号（連番）。JDSは「連番」もしくは「反響送付先コード」が候補だが、
    // 一意管理番号としては「連番」を inquiry_id に格納する。
    const managementNumber = extractField('連番');

    // ===== 査定希望物件内容 =====
    // 物件住所は「査定希望物件内容」セクションの「住所」。プロフィールの住所と同じ場合も多い。
    // セクション以降の最初の「住所」を優先的に拾う。
    let propertyAddress = '';
    const assessSectionIdx = text.indexOf('査定希望物件');
    if (assessSectionIdx !== -1) {
      const section = text.substring(assessSectionIdx);
      const addrMatch = section.match(/住所[　\s]*[：:]?[　\s]*([^\n]*)/);
      if (addrMatch) propertyAddress = addrMatch[1].trim();
    }
    if (!propertyAddress) propertyAddress = customerAddress;
    // 郵便番号表記（〒812-0861　）を除去
    propertyAddress = propertyAddress.replace(/〒?\s*\d{3}-?\d{4}\s*[　\s]*/, '').trim();

    // 物件種別 → 売主リスト用1文字コードへ変換
    const propertyTypeRaw = extractField('物件種別');
    let displayPropertyType = propertyTypeRaw;
    if (propertyTypeRaw.includes('一戸建て') || propertyTypeRaw.includes('戸建')) displayPropertyType = '戸';
    else if (propertyTypeRaw.includes('マンション')) displayPropertyType = 'マ';
    else if (propertyTypeRaw.includes('土地')) displayPropertyType = '土';
    else if (propertyTypeRaw) displayPropertyType = '他';

    // 間取り（間取りタイプ）
    const layout = extractField('間取りタイプ') || extractField('間取り');
    // 築後年数（「築後1年くらい」等）→ 数字のみ build_year ではなく築年数の目安なので null にせず参考情報として扱う
    const builtAgeRaw = extractField('築後年数');
    // 土地面積・建物延べ面積（㎡数値のみ）
    const landAreaRaw = extractField('土地面積');
    const buildingAreaRaw = extractField('建物延べ面積') || extractField('建物面積');
    const landArea = extractAreaNumeric(landAreaRaw);
    const buildingArea = extractAreaNumeric(buildingAreaRaw);

    // 売却予定時期・査定の要望・詳細要望
    const desiredSaleTime = extractField('売却予定時期');
    const desiredSalePrice = extractField('売却希望価格');
    const assessmentRequest = extractField('査定の要望');
    const detailRequest = extractField('詳細・要望');
    const planName = extractField('お問合せ企画');

    console.log(
      `[suumo-transfer] 抽出結果: name="${name}" tel="${tel}" address="${propertyAddress}" type="${displayPropertyType}"`
    );

    if (!name || !tel) {
      console.log('[suumo-transfer] 本文先頭400文字:', text.substring(0, 400));
      return res
        .status(400)
        .json({ success: false, error: `名前または電話番号が取得できませんでした name=${name} tel=${tel}` });
    }

    // コメント作成（sumai-transfer と同じ構成に合わせる）
    const comments = `【以下自動転記（SUUMO／リクルートＪＤＳ）】\n★読み方:${furigana}\n★お問合せ企画:${planName}\n★査定の要望:${assessmentRequest}\n★詳細・要望:${detailRequest}\n★希望連絡方法:${preferredContact}\n★売却予定時期:${desiredSaleTime}\n★売却希望価格:${desiredSalePrice}\n★築後年数:${builtAgeRaw}\n★土地面積:${landAreaRaw}\n★建物延べ面積:${buildingAreaRaw}\n★郵便番号:${postalCode}\n★現住所:${customerAddress}\n★連番:${managementNumber}`;
    console.log(`[suumo-transfer] comments作成完了: "${comments.substring(0, 100)}"`);

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
                console.log(`[suumo-transfer] ⏭ 重複スキップ: 反響日時一致 (既存: ${existing.seller_number})`);
                return res.json({
                  success: true,
                  skipped: true,
                  message: `重複スキップ: 反響日時一致 - 既存売主 ${existing.seller_number}`,
                  duplicateSeller: existing.seller_number,
                });
              } else {
                console.log(`[suumo-transfer] ⚠️ 同一電話番号 ${existing.seller_number} だが反響日時が異なるため重複フラグ付きで登録します`);
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
    // 売主番号採番（連番スプシから。sumai-transfer と同じロジック）
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
      console.log(`[suumo-transfer] ⚠️ ${sellerNumber} は既に存在。リトライ ${retryCount + 1}/${maxRetries}`);
      retryCount++;
    }

    console.log(`[suumo-transfer] 売主番号採番: ${sellerNumber}`);

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
    const inquiryDateISO =
      requestDateObj instanceof Date && !isNaN(requestDateObj.getTime())
        ? requestDateObj.toISOString().split('T')[0]
        : nextCallDate;
    const inquiryYear =
      requestDateObj instanceof Date && !isNaN(requestDateObj.getTime())
        ? requestDateObj.getFullYear()
        : jstToday.getUTCFullYear();

    const insertData: Record<string, any> = {
      seller_number: sellerNumber,
      name: encrypt(name),
      address: customerAddress ? encrypt(customerAddress) : null,
      phone_number: encrypt(tel),
      phone_number_hash: tel ? crypto.createHash('sha256').update(tel).digest('hex') : null,
      email: email ? encrypt(email) : null,
      email_hash: email ? crypto.createHash('sha256').update(email).digest('hex') : null,
      property_address: propertyAddress,
      property_type: displayPropertyType,
      inquiry_site: 'ス',
      inquiry_date: inquiryDateISO,
      inquiry_year: inquiryYear,
      inquiry_detailed_datetime: inquiryDateTimeISO,
      floor_plan: layout || null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: buildingArea ? parseFloat(buildingArea) : null,
      status: '追客中',
      next_call_date: nextCallDate,
      comments: comments,
      pinrich_status: '配信中',
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
        console.log(`[suumo-transfer] ⏭ UNIQUE制約違反によりスキップ（並行リクエストの重複）: tel_hash=${insertData.phone_number_hash?.substring(0, 8)}... datetime=${inquiryDateTimeISO}`);
        return res.json({
          success: true,
          skipped: true,
          message: '重複スキップ（UNIQUE制約違反 - 並行リクエスト）',
        });
      }
      console.error('[suumo-transfer] DB INSERT エラー:', insertError);
      return res.status(500).json({ success: false, error: `DB INSERT失敗: ${insertError?.message}` });
    }

    console.log(`[suumo-transfer] DB INSERT成功: ${sellerNumber} (id: ${seller.id})`);

    // propertiesテーブル用のproperty_type変換
    const propertyTypeForDB =
      displayPropertyType === 'マ' ? 'マンション'
      : displayPropertyType === '戸' ? '戸建て'
      : displayPropertyType === '土' ? '土地'
      : displayPropertyType || null;

    // propertiesテーブルにも登録
    await supabase.from('properties').insert({
      seller_id: seller.id,
      property_address: propertyAddress,
      property_type: propertyTypeForDB,
      floor_plan: layout || null,
      land_area: landArea ? parseFloat(landArea) : null,
      building_area: buildingArea ? parseFloat(buildingArea) : null,
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
        console.error('⚠️ [suumo-transfer] SidebarCounts update error:', e)
      );
    });

    // ② DB→スプシ同期（バックグラウンド実行）
    createSpreadsheetSyncService().then(syncService => {
      if (!syncService) return;
      syncService.syncToSpreadsheet(seller.id)
        .then(syncResult => {
          if (syncResult.success) {
            console.log(`[suumo-transfer] スプシ同期成功: ${sellerNumber}`);
          } else {
            console.warn(`[suumo-transfer] スプシ同期失敗（DB登録は成功）: ${syncResult.error}`);
          }
        })
        .catch((syncErr: any) => {
          console.warn(`[suumo-transfer] スプシ同期エラー（DB登録は成功）: ${syncErr.message}`);
        });
    }).catch((syncErr: any) => {
      console.warn(`[suumo-transfer] スプシ同期初期化エラー（DB登録は成功）: ${syncErr.message}`);
    });

  } catch (error: any) {
    console.error('[suumo-transfer] エラー:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
