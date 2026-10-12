/**
 * PropertySheetSyncService
 *
 * 物件別スプレッドシートの変更をDBと業務依頼集計表に同期するオーケストレーター。
 *
 * 同期の順序：
 *   1. 個別スプレッドシートから41項目を読み取り
 *   2. work_tasks テーブルに UPSERT（既存のDB独自項目は上書きしない）
 *   3. 業務依頼集計表の対応行を更新（なければ追加）
 *   4. property_spreadsheet_registry を更新
 *   5. drive_sync_log に記録
 *
 * ②の問題（WorkTaskSyncServiceとの競合）への対応：
 *   - 41項目のみ UPSERT する。業務管理系カラムには触れない。
 *   - site_registration_ok_comment / floor_plan_ok_comment は
 *     COALESCE で「既存値がなければ初期値を設定」する。
 *   - DB独自管理フィールド（storage_url等）は更新対象外。
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { google, sheets_v4 } from 'googleapis';
import { PropertySheetReadService, PropertySheetData } from './PropertySheetReadService';

// ───── 定数 ─────────────────────────────────────────────────────────────────

/** 業務依頼集計表のID */
const MASTER_SPREADSHEET_ID = '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g';
const MASTER_SHEET_NAME = '業務依頼';

/** リトライ上限 */
const MAX_RETRY = 3;

/**
 * WorkTaskSyncService が画面入力値として保護しているカラム。
 * 個別スプレッドシートには存在しないため、直接同期で上書きしない。
 */
const DB_ONLY_FIELDS = new Set([
  'storage_url',
  'site_registration_requester',
  'site_registration_requestor',
  'cw_request_email_site',
  'cw_request_email_floor_plan',
  'cw_request_email_2f_above',
  'site_registration_confirmed',
  'site_registration_confirm_request_date',
  'site_registration_ok_sent',
  'mediation_completed',
  'mediation_creator',
]);

/**
 * 集計表に書き込む41カラムの定義。
 * colName: 業務依頼集計表のヘッダー名
 * field:   PropertySheetData のキー
 * type:    値の型（'date' は yyyy/MM/dd 形式で書く）
 */
interface ColDef {
  colName: string;
  field: keyof PropertySheetData;
  type?: 'date' | 'number' | 'text';
  initialOnly?: boolean;  // true = 空のときのみ書く
}

const COL_DEFS: ColDef[] = [
  { colName: '物件番号',              field: 'property_number' },
  { colName: '物件所在',              field: 'property_address' },
  { colName: '売主',                  field: 'seller_name' },
  { colName: 'スプシURL',             field: 'spreadsheet_url' },
  { colName: '営業担当',              field: 'sales_assignee' },
  { colName: '媒介形態',              field: 'mediation_type' },
  { colName: '媒介作成締め日',        field: 'mediation_deadline',           type: 'date' },
  { colName: 'サイト登録締め日',      field: 'site_registration_deadline',   type: 'date' },
  { colName: 'メール配信',            field: 'email_distribution' },
  { colName: '売買契約締め日',        field: 'sales_contract_deadline',      type: 'date' },
  { colName: '決済日',                field: 'settlement_date',              type: 'date' },
  { colName: '仲介手数料（売）',      field: 'brokerage_fee_seller',         type: 'number' },
  { colName: '仲介手数料（買）',      field: 'brokerage_fee_buyer',          type: 'number' },
  { colName: '減額理由',              field: 'discount_reason' },
  { colName: '売買価格',              field: 'sales_price',                  type: 'number' },
  { colName: 'キャンペーン',          field: 'campaign' },
  { colName: '決済予定月',            field: 'settlement_scheduled_month' },
  { colName: '契約形態',              field: 'contract_type' },
  { colName: '融資承認予定日',        field: 'loan_approval_scheduled_date', type: 'date' },
  { colName: 'サイト登録確認OKコメント', field: 'site_registration_ok_comment', initialOnly: true },
  { colName: '間取図確認OK/修正コメント', field: 'floor_plan_ok_comment',        initialOnly: true },
  { colName: '種別',                  field: 'property_type' },
  { colName: '事務担当（売買契約）',  field: 'sales_contract_admin' },
  { colName: '仲介業者',              field: 'broker' },
  { colName: '仲介業者担当連絡先',    field: 'broker_contact' },
  { colName: '司法書士',              field: 'judicial_scrivener' },
  { colName: '司法書士連絡先',        field: 'judicial_scrivener_contact' },
  { colName: '1社掲載',               field: 'single_listing' },
  { colName: '地籍測量図・字図（営業入力）', field: 'cadastral_map_sales_input' },
  { colName: '道路寸法',              field: 'road_dimensions' },
  { colName: '売主名前',              field: 'seller_contact_name' },
  { colName: '売主メアド',            field: 'seller_contact_email' },
  { colName: '売主TEL',               field: 'seller_contact_tel' },
  { colName: '買主名前',              field: 'buyer_contact_name' },
  { colName: '買主メアド',            field: 'buyer_contact_email' },
  { colName: '買主TEL',               field: 'buyer_contact_tel' },
  { colName: 'ローン',                field: 'loan' },
  { colName: '金融機関名',            field: 'financial_institution' },
  { colName: '引き渡し予定',          field: 'delivery_scheduled_date',      type: 'date' },
  { colName: 'お渡し手段',            field: 'mediation_delivery_method' },
  { colName: '郵送前営業確認',        field: 'mediation_pre_mail_check' },
];

// ───── ヘルパー ──────────────────────────────────────────────────────────────

/** ISO日付文字列（YYYY-MM-DD）を集計表向けの yyyy/MM/dd 形式に変換 */
function isoToSheetDate(iso: string | null): string {
  if (!iso) return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : '';
}

/** PropertySheetData の値を集計表用のセル値に変換 */
function toSheetValue(data: PropertySheetData, def: ColDef): string | number {
  const v = data[def.field];
  if (v === null || v === undefined) return '';
  if (def.type === 'date') return isoToSheetDate(v as string);
  if (def.type === 'number') return (v as number) ?? '';
  return String(v);
}

// ───── サービス ──────────────────────────────────────────────────────────────

export class PropertySheetSyncService {
  private supabase: SupabaseClient;
  private reader: PropertySheetReadService;
  private sheets: sheets_v4.Sheets | null = null;

  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    this.reader = new PropertySheetReadService();
  }

  // ─── Sheets API 認証（読み書き権限） ────────────────────────────────────

  private async initSheets(): Promise<sheets_v4.Sheets> {
    if (this.sheets) return this.sheets;
    const scopes = ['https://www.googleapis.com/auth/spreadsheets'];

    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      try {
        let j = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
        let key: any;
        try { key = JSON.parse(j); } catch { key = JSON.parse(Buffer.from(j, 'base64').toString('utf8')); }
        if (key.private_key && !key.private_key.includes('\n')) key.private_key = key.private_key.replace(/\\n/g, '\n');
        const auth = new google.auth.JWT({ email: key.client_email, key: key.private_key, scopes });
        await auth.authorize();
        this.sheets = google.sheets({ version: 'v4', auth });
        return this.sheets;
      } catch { /* fall through */ }
    }
    if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
      const auth = new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        scopes,
      });
      await auth.authorize();
      this.sheets = google.sheets({ version: 'v4', auth });
      return this.sheets;
    }
    const fs = require('fs');
    const kp = process.env.GOOGLE_SERVICE_ACCOUNT_PATH || 'google-service-account.json';
    if (fs.existsSync(kp)) {
      const auth = new google.auth.GoogleAuth({ keyFile: kp, scopes });
      this.sheets = google.sheets({ version: 'v4', auth: await auth.getClient() as any });
      return this.sheets;
    }
    throw new Error('[PropertySheetSyncService] No Google auth credentials');
  }

  // ─── メイン同期処理 ──────────────────────────────────────────────────────

  /**
   * ファイルIDで対象スプレッドシートを同期する。
   * logId を渡すと drive_sync_log を更新する。
   */
  async syncFile(
    fileId: string,
    spreadsheetUrl: string,
    logId?: string,
  ): Promise<{ success: boolean; propertyNumber: string | null; error?: string }> {
    const spreadsheetId = fileId;

    try {
      // Step 1: 個別スプレッドシートを読み取る
      const data = await this.reader.readPropertyData(spreadsheetId, spreadsheetUrl);
      if (!data) {
        // 媒介依頼シートなし・除外物件などはスキップ（エラーではない）
        if (logId) await this.updateLog(logId, 'success', null, null);
        return { success: true, propertyNumber: null };
      }

      console.log(`[PropertySheetSyncService] Syncing ${data.property_number} from ${fileId}`);

      // Step 2: work_tasks テーブルを UPSERT
      await this.upsertWorkTask(data);

      // Step 3: 業務依頼集計表を更新
      await this.updateMasterSheet(data);

      // Step 4: property_spreadsheet_registry を更新
      await this.supabase
        .from('property_spreadsheet_registry')
        .upsert({
          file_id: fileId,
          property_number: data.property_number,
          spreadsheet_url: spreadsheetUrl,
          last_synced_at: new Date().toISOString(),
        }, { onConflict: 'file_id' });

      // Step 5: ログ更新
      if (logId) await this.updateLog(logId, 'success', data.property_number, null);

      console.log(`[PropertySheetSyncService] ✅ Done: ${data.property_number}`);
      return { success: true, propertyNumber: data.property_number };

    } catch (e: any) {
      console.error(`[PropertySheetSyncService] ❌ Error syncing ${fileId}:`, e.message);
      if (logId) await this.updateLog(logId, 'failed', null, e.message);
      return { success: false, propertyNumber: null, error: e.message };
    }
  }

  // ─── DB UPSERT ──────────────────────────────────────────────────────────

  /**
   * work_tasks テーブルを UPSERT する。
   *
   * ② の対応：
   *   - 41項目のみ更新し、DB独自管理フィールドは触れない
   *   - site_registration_ok_comment / floor_plan_ok_comment は
   *     COALESCE（既存値があれば保持）
   *   - 個別スプシが空のフィールドは null を書く（スプシ = 正本）
   */
  private async upsertWorkTask(data: PropertySheetData): Promise<void> {
    const now = new Date().toISOString();

    // 既存レコードの comment フィールドを確認（COALESCE 相当の処理）
    const { data: existing } = await this.supabase
      .from('work_tasks')
      .select('site_registration_ok_comment, floor_plan_ok_comment')
      .eq('property_number', data.property_number)
      .maybeSingle();

    const record: Record<string, any> = {
      property_number:              data.property_number,
      property_address:             data.property_address,
      seller_name:                  data.seller_name,
      spreadsheet_url:              data.spreadsheet_url,
      sales_assignee:               data.sales_assignee,
      mediation_type:               data.mediation_type,
      mediation_deadline:           data.mediation_deadline,
      site_registration_deadline:   data.site_registration_deadline,
      email_distribution:           data.email_distribution,
      sales_contract_deadline:      data.sales_contract_deadline,
      settlement_date:              data.settlement_date,
      brokerage_fee_seller:         data.brokerage_fee_seller,
      brokerage_fee_buyer:          data.brokerage_fee_buyer,
      discount_reason:              data.discount_reason,
      sales_price:                  data.sales_price,
      campaign:                     data.campaign,
      settlement_scheduled_month:   data.settlement_scheduled_month,
      contract_type:                data.contract_type,
      loan_approval_scheduled_date: data.loan_approval_scheduled_date,
      // COALESCE: 既存値があれば保持、なければ初期値をセット
      site_registration_ok_comment:
        existing?.site_registration_ok_comment || data.site_registration_ok_comment,
      floor_plan_ok_comment:
        existing?.floor_plan_ok_comment || data.floor_plan_ok_comment,
      property_type:                data.property_type,
      sales_contract_admin:         data.sales_contract_admin,
      broker:                       data.broker,
      broker_contact:               data.broker_contact,
      judicial_scrivener:           data.judicial_scrivener,
      judicial_scrivener_contact:   data.judicial_scrivener_contact,
      single_listing:               data.single_listing,
      cadastral_map_sales_input:    data.cadastral_map_sales_input,
      road_dimensions:              data.road_dimensions,
      seller_contact_name:          data.seller_contact_name,
      seller_contact_email:         data.seller_contact_email,
      seller_contact_tel:           data.seller_contact_tel,
      buyer_contact_name:           data.buyer_contact_name,
      buyer_contact_email:          data.buyer_contact_email,
      buyer_contact_tel:            data.buyer_contact_tel,
      loan:                         data.loan,
      financial_institution:        data.financial_institution,
      delivery_scheduled_date:      data.delivery_scheduled_date,
      mediation_delivery_method:    data.mediation_delivery_method,
      mediation_pre_mail_check:     data.mediation_pre_mail_check,
      synced_at: now,
    };

    const { error } = await this.supabase
      .from('work_tasks')
      .upsert(record, { onConflict: 'property_number' });

    if (error) throw new Error(`DB upsert failed: ${error.message}`);
  }

  // ─── 業務依頼集計表 更新 ────────────────────────────────────────────────

  /**
   * 業務依頼集計表の対応行を更新する。
   * 行が存在しなければ追加する。
   * 既存の列・書式・並び順は変更しない。
   */
  private async updateMasterSheet(data: PropertySheetData): Promise<void> {
    const sheets = await this.initSheets();

    // ヘッダー行と物件番号列（A列）を取得
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SPREADSHEET_ID,
      range: `${MASTER_SHEET_NAME}!1:1`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const headers = (headerRes.data.values?.[0] || []).map((h: any) => String(h).trim());

    const colARes = await sheets.spreadsheets.values.get({
      spreadsheetId: MASTER_SPREADSHEET_ID,
      range: `${MASTER_SHEET_NAME}!A:A`,
      valueRenderOption: 'FORMATTED_VALUE',
    });
    const colA = (colARes.data.values || []).map((r: any[]) => String(r[0] || '').trim());

    // 対象行を特定（1始まり; ヘッダー=1行目）
    let rowIndex = colA.findIndex(
      (v, i) => i > 0 && v === data.property_number,
    );

    const isNewRow = rowIndex === -1;
    if (isNewRow) {
      // 新規行: まず空行を追加
      await sheets.spreadsheets.values.append({
        spreadsheetId: MASTER_SPREADSHEET_ID,
        range: `${MASTER_SHEET_NAME}!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[data.property_number]] },
      });
      // 追加後の行番号を再取得
      const colARes2 = await sheets.spreadsheets.values.get({
        spreadsheetId: MASTER_SPREADSHEET_ID,
        range: `${MASTER_SHEET_NAME}!A:A`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      const colA2 = (colARes2.data.values || []).map((r: any[]) => String(r[0] || '').trim());
      rowIndex = colA2.findIndex((v, i) => i > 0 && v === data.property_number);
      if (rowIndex === -1) throw new Error('Failed to locate newly added row');
    }

    const sheetRowNumber = rowIndex + 1;  // Sheets API は 1-indexed

    // 現在のcommentセルの値を確認（空のときのみ初期値を書くため）
    const commentInitialCols = ['サイト登録確認OKコメント', '間取図確認OK/修正コメント'];
    const existingComments: Record<string, string> = {};
    for (const colName of commentInitialCols) {
      const colIdx = headers.indexOf(colName);
      if (colIdx === -1) continue;
      const letter = indexToColLetter(colIdx);
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId: MASTER_SPREADSHEET_ID,
        range: `${MASTER_SHEET_NAME}!${letter}${sheetRowNumber}`,
        valueRenderOption: 'FORMATTED_VALUE',
      });
      existingComments[colName] = String(res.data.values?.[0]?.[0] || '').trim();
    }

    // 書き込む ValueRange リストを構築
    const batchData: sheets_v4.Schema$ValueRange[] = [];

    for (const def of COL_DEFS) {
      const colIdx = headers.indexOf(def.colName);
      if (colIdx === -1) continue;  // ヘッダーに存在しない列はスキップ

      const letter = indexToColLetter(colIdx);
      const cellRange = `${MASTER_SHEET_NAME}!${letter}${sheetRowNumber}`;

      // initialOnly: 既存値がある場合はスキップ
      if (def.initialOnly) {
        if (existingComments[def.colName]) continue;  // 既に値あり → 上書きしない
      }

      const cellValue = toSheetValue(data, def);
      batchData.push({ range: cellRange, values: [[cellValue]] });
    }

    if (batchData.length === 0) return;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: MASTER_SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: batchData,
      },
    });

    console.log(`[PropertySheetSyncService] Sheet updated: ${data.property_number} (row ${sheetRowNumber}, ${batchData.length} cells)`);
  }

  // ─── drive_sync_log 管理 ────────────────────────────────────────────────

  /** 同期ログを記録してIDを返す */
  async createLog(fileId: string): Promise<string> {
    const { data } = await this.supabase
      .from('drive_sync_log')
      .insert({ file_id: fileId, status: 'pending' })
      .select('id')
      .single();
    return data?.id || '';
  }

  async updateLog(
    logId: string,
    status: 'success' | 'failed',
    propertyNumber: string | null,
    errorMessage: string | null,
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.supabase
      .from('drive_sync_log')
      .update({
        status,
        property_number: propertyNumber,
        error_message: errorMessage,
        synced_at: status === 'success' ? now : null,
        next_retry_at:
          status === 'failed'
            ? new Date(Date.now() + 5 * 60 * 1000).toISOString()
            : null,
      })
      .eq('id', logId);
  }

  /** 失敗レコードを取得してリトライする（/api/cron/drive-retry から呼び出す） */
  async retryFailed(): Promise<{ retried: number; succeeded: number; failed: number }> {
    const now = new Date().toISOString();
    const { data: failedLogs } = await this.supabase
      .from('drive_sync_log')
      .select('*')
      .eq('status', 'failed')
      .lt('next_retry_at', now)
      .lt('retry_count', MAX_RETRY)
      .order('next_retry_at', { ascending: true })
      .limit(20);

    if (!failedLogs || failedLogs.length === 0) {
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    let succeeded = 0;
    let failed = 0;

    for (const log of failedLogs) {
      // registry からURLを取得
      const { data: reg } = await this.supabase
        .from('property_spreadsheet_registry')
        .select('spreadsheet_url')
        .eq('file_id', log.file_id)
        .maybeSingle();

      const url = reg?.spreadsheet_url || `https://docs.google.com/spreadsheets/d/${log.file_id}`;

      const result = await this.syncFile(log.file_id, url);

      // リトライ回数を更新
      const newCount = (log.retry_count || 0) + 1;
      if (result.success) {
        succeeded++;
        await this.supabase
          .from('drive_sync_log')
          .update({ status: 'success', retry_count: newCount, synced_at: new Date().toISOString() })
          .eq('id', log.id);
      } else {
        failed++;
        const nextRetry = newCount >= MAX_RETRY
          ? null
          : new Date(Date.now() + Math.pow(6, newCount) * 60 * 1000).toISOString();
        await this.supabase
          .from('drive_sync_log')
          .update({
            status: newCount >= MAX_RETRY ? 'max_retry' : 'failed',
            retry_count: newCount,
            error_message: result.error || null,
            next_retry_at: nextRetry,
          })
          .eq('id', log.id);
      }
    }

    return { retried: failedLogs.length, succeeded, failed };
  }

  /**
   * 定期照合（/api/cron/drive-reconcile から呼び出す）。
   * last_synced_at が古い物件を再同期して通知漏れを補完する。
   */
  async reconcile(thresholdHours = 2): Promise<{ checked: number; synced: number }> {
    const threshold = new Date(Date.now() - thresholdHours * 3600 * 1000).toISOString();

    const { data: stale } = await this.supabase
      .from('property_spreadsheet_registry')
      .select('file_id, spreadsheet_url')
      .or(`last_synced_at.lt.${threshold},last_synced_at.is.null`)
      .limit(30)
      .order('last_synced_at', { ascending: true, nullsFirst: true });

    if (!stale || stale.length === 0) return { checked: 0, synced: 0 };

    let synced = 0;
    for (const row of stale) {
      const logId = await this.createLog(row.file_id);
      const res = await this.syncFile(row.file_id, row.spreadsheet_url || '', logId);
      if (res.success) synced++;
    }

    return { checked: stale.length, synced };
  }
}

// ───── ユーティリティ ─────────────────────────────────────────────────────────

/** 0始まりの列インデックス → A1記法の列文字（A, B, ..., Z, AA, ...） */
function indexToColLetter(index: number): string {
  let letter = '';
  let n = index;
  while (n >= 0) {
    letter = String.fromCharCode((n % 26) + 65) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}
