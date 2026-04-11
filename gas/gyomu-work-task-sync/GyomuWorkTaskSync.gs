/**
 * 業務依頼同期スクリプト（GAS → Supabase直接書き込み）
 *
 * 概要:
 * - スプレッドシートの「業務依頼」シートを読み込み
 * - Supabase の work_tasks テーブルに upsert（property_number をキーに）
 * - 10分ごとのトリガーで自動実行
 *
 * セットアップ:
 * 1. このスクリプトをGASエディタに貼り付ける
 * 2. setupTrigger() を一度だけ手動実行してトリガーを設定
 * 3. testSync() で動作確認
 *
 * 修正背景:
 * EnhancedAutoSyncService.runFullSync() の Phase 4 が空実装（コメントのみ）で
 * WorkTaskSyncService.syncAll() を呼び出していなかったため、業務依頼データが
 * 自動同期されていなかった。物件リスト・買主リストと同様に GAS 直接書き込み方式を採用。
 */

// ============================================================
// 設定
// ============================================================
var CONFIG = {
  SPREADSHEET_ID: '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g',
  SHEET_NAME: '業務依頼',
  SUPABASE_URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8',
  TABLE_NAME: 'work_tasks',
  BATCH_SIZE: 100,
  SYNC_INTERVAL_MINUTES: 10
};

// ============================================================
// カラムマッピング（work-task-column-mapping.json の統合）
// spreadsheetToDatabase + spreadsheetToDatabase2 + spreadsheetToDatabase3
// ============================================================
var COLUMN_MAPPING = {
  // spreadsheetToDatabase
  '物件番号': 'property_number',
  '物件所在': 'property_address',
  '売主': 'seller_name',
  'スプシURL': 'spreadsheet_url',
  '営業担当': 'sales_assignee',
  '媒介形態': 'mediation_type',
  '媒介作成締め日': 'mediation_deadline',
  '媒介作成完了': 'mediation_completed',
  '媒介作成者': 'mediation_creator',
  '媒介備考': 'mediation_notes',
  'サイト登録締め日': 'site_registration_deadline',
  'サイト登録依頼日': 'site_registration_request_date',
  'サイト登録納期予定日': 'site_registration_due_date',
  'サイト登録確認依頼日': 'site_registration_confirm_request_date',
  'サイト登録確認': 'site_registration_confirmed',
  'サイト登録確認者': 'site_registration_confirmer',
  'メール配信': 'email_distribution',
  '配信前確認': 'pre_distribution_check',
  '配信日': 'distribution_date',
  '配信担当': 'distribution_assignee',
  '公開前確認': 'pre_publish_check',
  '公開予定日': 'publish_scheduled_date',
  '字図、地積測量図URL': 'cadastral_map_url',
  '間取り図格納連絡不要': 'floor_plan_no_notification',
  '間取図': 'floor_plan',
  '間取図依頼日': 'floor_plan_request_date',
  '間取図完了予定': 'floor_plan_due_date',
  '間取図完了日': 'floor_plan_completed_date',
  '間取図確認者': 'floor_plan_confirmer',
  '間取図修正回数': 'floor_plan_revision_count',
  '重説・契約書入力納期': 'contract_input_deadline',
  'パノラマ': 'panorama',
  'パノラマ完了': 'panorama_completed',
  '社員が契約書作成': 'employee_contract_creation',
  '添付資料完了': 'attachment_completed',
  'サイト備考': 'site_notes',
  '売買契約締め日': 'sales_contract_deadline',
  '売買契約担当': 'sales_contract_assignee',
  '売買契約確認': 'sales_contract_confirmed',
  '製本予定日': 'binding_scheduled_date',
  '製本完了': 'binding_completed',
  '決済日': 'settlement_date',
  '売買契約備考': 'sales_contract_notes',
  '台帳作成済み': 'ledger_created',
  '保留': 'on_hold',
  '添付資料印刷': 'attachment_printed',
  // spreadsheetToDatabase2
  '仲介手数料（売）': 'brokerage_fee_seller',
  '仲介手数料（買）': 'brokerage_fee_buyer',
  '売・支払方法': 'seller_payment_method',
  '買・支払方法': 'buyer_payment_method',
  '入金確認（売）': 'payment_confirmed_seller',
  '入金確認（買）': 'payment_confirmed_buyer',
  '通常仲介手数料（売）': 'standard_brokerage_fee_seller',
  '通常仲介手数料（買）': 'standard_brokerage_fee_buyer',
  '減額理由': 'discount_reason',
  '減額理由他': 'discount_reason_other',
  '紹介チラシ渡し': 'referral_flyer_given',
  '口コミ登録': 'review_registered',
  '他コメント': 'other_comments',
  '売買価格': 'sales_price',
  'キャンペーン': 'campaign',
  '決済完了チャット': 'settlement_completed_chat',
  '決済予定月': 'settlement_scheduled_month',
  '物件担当チャット': 'property_assignee_chat',
  '経理確認済み': 'accounting_confirmed',
  '契約形態': 'contract_type',
  '融資承認予定日': 'loan_approval_scheduled_date',
  '国広とチャット': 'kunihiro_chat',
  '山本へチャット送信': 'yamamoto_chat',
  '裏へチャット送信': 'ura_chat',
  '角井へチャット送信': 'kadoi_chat',
  '仲介業者': 'broker',
  '仲介業者担当連絡先': 'broker_contact',
  '司法書士': 'judicial_scrivener',
  '司法書士連絡先': 'judicial_scrivener_contact',
  '口コミカウント用': 'review_count_field',
  'サイト登録依頼先': 'site_registration_requester',
  'サイト登録依頼者': 'site_registration_requestor',
  '広瀬さんへ依頼': 'hirose_request',
  '物件一覧に行追加': 'property_list_row_added',
  '物件ファイル': 'property_file',
  // spreadsheetToDatabase3
  'コメント（サイト登録）': 'site_registration_comment',
  'コメント（売買契約）': 'sales_contract_comment',
  '広瀬さんへ依頼（売買契約関連）': 'hirose_request_sales',
  'CWの方へ依頼メール（サイト登録）': 'cw_request_email_site',
  'CWの方へ依頼メール（間取り、区画図）': 'cw_request_email_floor_plan',
  'コメント（間取図関係）': 'floor_plan_comment',
  'CWの方へ依頼メール（2階以上）': 'cw_request_email_2f_above',
  'サイト登録確認OKコメント': 'site_registration_ok_comment',
  '間取図確認OK/修正コメント': 'floor_plan_ok_comment',
  'サイト登録確認OK送信': 'site_registration_ok_sent',
  '間取図確認OK送信': 'floor_plan_ok_sent',
  '格納先URL': 'storage_url',
  '地籍測量図・字図（営業入力）': 'cadastral_map_sales_input',
  '道路寸法': 'road_dimensions',
  '種別': 'property_type',
  '間取図格納済み連絡メール': 'floor_plan_stored_email',
  '添付資料準備納期': 'attachment_prep_deadline',
  '事務担当（売買契約）': 'sales_contract_admin',
  'CW検収（サイト登録）': 'cw_inspection_site',
  'CW検収（図面300円）': 'cw_inspection_plan_300',
  'CW検収（図面500円）': 'cw_inspection_plan_500',
  'サイト登録確認OK廣瀬さん': 'site_registration_ok_hirose',
  '登録完了チャット（廣瀬）': 'registration_completed_chat_hirose',
  '作業完了チャット（廣瀬）': 'work_completed_chat_hirose',
  '登録完了コメント': 'registration_completed_comment',
  '作業完了コメント': 'work_completed_comment',
  'CWへ依頼（売買契約関連）': 'cw_request_sales',
  '廣瀬さんへ完了チャット（売買関連）': 'hirose_completed_chat_sales',
  'CWへ完了メール（売買関連）': 'cw_completed_email_sales',
  '廣瀬さんへ間取り図格納コメント': 'hirose_floor_plan_stored_comment',
  '完了コメント（売買関連）': 'completed_comment_sales',
  '請求書に押印': 'invoice_stamped',
  '公開前配信済み': 'pre_publish_distributed',
  '口コミ(売主)': 'review_seller',
  '口コミ(買主)': 'review_buyer',
  '口コミ取得数': 'review_count',
  '壁芯面積入力': 'wall_core_area_input',
  '一般媒介のため配信不要、即公開': 'general_mediation_no_distribution',
  '地積測量図、字図': 'cadastral_map_field',
  '1社掲載': 'single_listing',
  '1社掲載入力確認': 'single_listing_input_confirmed',
  '方位記号': 'direction_symbol',
  '住居表示確認': 'address_display_confirmed',
  '作業内容': 'work_content',
  '売買関係検収': 'sales_inspection',
  '依頼前に確認': 'pre_request_check',
  'CWの方': 'cw_person'
};

// 型変換ルール（work-task-column-mapping.json の typeConversions）
var TYPE_CONVERSIONS = {
  'mediation_deadline': 'date',
  'site_registration_deadline': 'date',
  'site_registration_request_date': 'date',
  'site_registration_due_date': 'date',
  'site_registration_confirm_request_date': 'date',
  'distribution_date': 'date',
  'publish_scheduled_date': 'date',
  'floor_plan_request_date': 'date',
  'floor_plan_due_date': 'datetime',
  'floor_plan_completed_date': 'date',
  'contract_input_deadline': 'date',
  'sales_contract_deadline': 'date',
  'binding_scheduled_date': 'date',
  'settlement_date': 'date',
  'loan_approval_scheduled_date': 'date',
  'attachment_prep_deadline': 'date',
  'brokerage_fee_seller': 'number',
  'brokerage_fee_buyer': 'number',
  'standard_brokerage_fee_seller': 'number',
  'standard_brokerage_fee_buyer': 'number',
  'sales_price': 'number',
  'floor_plan_revision_count': 'number',
  'review_count': 'number'
};

// ============================================================
// メイン同期関数（トリガーから呼び出される）
// ============================================================
function syncGyomuWorkTasks() {
  var startTime = new Date();
  Logger.log('=== 業務依頼同期開始: ' + startTime.toISOString() + ' ===');

  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      Logger.log('ERROR: シート「' + CONFIG.SHEET_NAME + '」が見つかりません');
      return;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      Logger.log('データなし（ヘッダー行のみ）');
      return;
    }

    Logger.log('データ行数: ' + (lastRow - 1));

    // ヘッダー行を取得
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // データ行を取得
    var rawValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // 各行をDBレコードに変換
    var records = [];
    var skippedCount = 0;

    for (var i = 0; i < rawValues.length; i++) {
      var row = rawValues[i];
      var record = mapRowToRecord(headers, row);

      // property_number が空の行はスキップ
      if (!record.property_number) {
        skippedCount++;
        continue;
      }

      records.push(record);
    }

    Logger.log('変換済みレコード数: ' + records.length + '（スキップ: ' + skippedCount + '）');

    // バッチに分けてupsert
    var successCount = 0;
    var errorCount = 0;

    for (var j = 0; j < records.length; j += CONFIG.BATCH_SIZE) {
      var batch = records.slice(j, j + CONFIG.BATCH_SIZE);
      var batchNum = Math.floor(j / CONFIG.BATCH_SIZE) + 1;
      var result = upsertToSupabase(batch);

      if (result.success) {
        successCount += batch.length;
        Logger.log('バッチ ' + batchNum + ': ' + batch.length + '件 upsert成功');
      } else {
        Logger.log('バッチ ' + batchNum + ': エラー - ' + result.error);
        // バッチ失敗時は1件ずつ再試行して問題行を特定
        Logger.log('バッチ ' + batchNum + ': 1件ずつ再試行します...');
        for (var k = 0; k < batch.length; k++) {
          var singleResult = upsertToSupabase([batch[k]]);
          if (singleResult.success) {
            successCount++;
          } else {
            errorCount++;
            Logger.log('  スキップ: property_number=' + batch[k].property_number + ' エラー=' + singleResult.error);
          }
        }
      }
    }

    var endTime = new Date();
    var duration = (endTime - startTime) / 1000;
    Logger.log('=== 同期完了: 成功=' + successCount + ', エラー=' + errorCount + ', 所要時間=' + duration + '秒 ===');

  } catch (e) {
    Logger.log('ERROR: 予期しないエラー - ' + e.toString());
    Logger.log(e.stack);
  }

  // CWカウントを同期（エラーが発生しても業務依頼同期は継続済み）
  syncCwCounts();
}

// ============================================================
// スプレッドシート行 → DBレコード変換
// ============================================================
function mapRowToRecord(headers, row) {
  var record = {};

  for (var i = 0; i < headers.length; i++) {
    var header = headers[i];
    var dbColumn = COLUMN_MAPPING[header];
    if (!dbColumn) continue;

    var value = row[i];
    var converted = convertValue(dbColumn, value);
    record[dbColumn] = converted;
  }

  return record;
}

// ============================================================
// 型変換
// ============================================================
function convertValue(column, value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  var type = TYPE_CONVERSIONS[column];

  if (type === 'date') {
    return parseDate(value);
  }

  if (type === 'datetime') {
    return parseDatetime(value);
  }

  if (type === 'number') {
    return parseNumber(value);
  }

  // boolean / チェックボックス → Y/N 変換
  if (typeof value === 'boolean') {
    return value ? 'Y' : 'N';
  }
  var strLower = String(value).trim().toLowerCase();
  if (strLower === 'true') return 'Y';
  if (strLower === 'false') return 'N';

  // デフォルト: 文字列
  var str = String(value).trim();
  return str === '' ? null : str;
}

/**
 * 日付変換
 * GASの getValues() は Date オブジェクトを返す場合がある
 */
function parseDate(value) {
  if (!value) return null;

  // GASのDateオブジェクト
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    var y = value.getFullYear();
    var m = String(value.getMonth() + 1).padStart(2, '0');
    var d = String(value.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  // 数値（Googleスプレッドシートのシリアル値）
  if (typeof value === 'number') {
    var date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (isNaN(date.getTime())) return null;
    var y2 = date.getUTCFullYear();
    var m2 = String(date.getUTCMonth() + 1).padStart(2, '0');
    var d2 = String(date.getUTCDate()).padStart(2, '0');
    return y2 + '-' + m2 + '-' + d2;
  }

  var str = String(value).trim();
  if (!str) return null;

  // YYYY/MM/DD or YYYY-MM-DD
  var match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) {
    return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
  }

  // MM/DD/YYYY
  var match2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match2) {
    return match2[3] + '-' + match2[1].padStart(2, '0') + '-' + match2[2].padStart(2, '0');
  }

  return null;
}

/**
 * 日時変換（タイムスタンプ）
 * ISO 8601形式（例: "2026-03-18T14:30:00.000Z"）で返す
 */
function parseDatetime(value) {
  if (!value) return null;

  // GASのDateオブジェクト
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  // 数値（Googleスプレッドシートのシリアル値）
  if (typeof value === 'number') {
    var date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  var str = String(value).trim();
  if (!str) return null;

  var date2 = new Date(str);
  if (!isNaN(date2.getTime())) {
    return date2.toISOString();
  }

  return null;
}

/**
 * 数値変換
 */
function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;

  var str = String(value).replace(/[,，円￥\s]/g, '').trim();
  if (!str) return null;

  var num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ============================================================
// Supabase upsert
// ============================================================
function upsertToSupabase(records) {
  var url = CONFIG.SUPABASE_URL + '/rest/v1/' + CONFIG.TABLE_NAME + '?on_conflict=property_number';

  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates,return=minimal'
    },
    payload: JSON.stringify(records),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode >= 200 && statusCode < 300) {
      return { success: true };
    } else {
      var body = response.getContentText();
      return { success: false, error: 'HTTP ' + statusCode + ': ' + body };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// トリガー設定（一度だけ手動実行）
// ============================================================
function setupTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncGyomuWorkTasks') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }

  // 10分ごとのトリガーを作成
  ScriptApp.newTrigger('syncGyomuWorkTasks')
    .timeBased()
    .everyMinutes(CONFIG.SYNC_INTERVAL_MINUTES)
    .create();

  Logger.log('トリガーを設定しました: ' + CONFIG.SYNC_INTERVAL_MINUTES + '分ごとに syncGyomuWorkTasks() を実行');
}

// ============================================================
// テスト用（手動実行で動作確認）
// ============================================================
function testSync() {
  Logger.log('=== テスト同期開始 ===');
  syncGyomuWorkTasks();
  Logger.log('=== テスト同期完了 ===');
}

/**
 * 特定の物件番号だけ同期（デバッグ用）
 * 例: syncSingleWorkTask('AA9195')
 */
function syncSingleWorkTask(propertyNumber) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    Logger.log('シートが見つかりません');
    return;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // property_number の列インデックスを探す
  var propertyNumberColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === '物件番号') {
      propertyNumberColIndex = i;
      break;
    }
  }

  if (propertyNumberColIndex < 0) {
    Logger.log('「物件番号」列が見つかりません');
    return;
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var j = 0; j < allData.length; j++) {
    var row = allData[j];
    if (String(row[propertyNumberColIndex]) === String(propertyNumber)) {
      var record = mapRowToRecord(headers, row);
      Logger.log('レコード: ' + JSON.stringify(record));

      var result = upsertToSupabase([record]);
      Logger.log('結果: ' + JSON.stringify(result));
      return;
    }
  }

  Logger.log('物件番号 ' + propertyNumber + ' が見つかりません');
}

// ============================================================
// デバッグ用：ヘッダー名の確認（手動実行のみ）
// ============================================================
function debugHeaders() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 問題のフィールドを検索
  var targets = [
    'CWの方へ依頼メール（サイト登録）',
    'サイト登録依頼者',
    'CWの方へ依頼メール（間取り、区画図）',
    '間取図確認OK送信',
    '間取図格納済み連絡メール',
    'メール配信',
    'サイト登録納期予定日'
  ];

  targets.forEach(function(target) {
    var found = false;
    for (var i = 0; i < headers.length; i++) {
      if (headers[i] === target) {
        Logger.log('✅ 見つかった: "' + target + '" → 列' + (i + 1));
        found = true;
        break;
      }
    }
    if (!found) {
      // 部分一致で探す
      for (var j = 0; j < headers.length; j++) {
        if (headers[j] && headers[j].toString().indexOf(target.substring(0, 5)) >= 0) {
          Logger.log('⚠️ 近似一致: "' + target + '" → 実際は "' + headers[j] + '" (列' + (j + 1) + ')');
        }
      }
      Logger.log('❌ 見つからない: "' + target + '"');
    }
  });
}

// ============================================================
// デバッグ用：全ヘッダーを出力（手動実行のみ）
// ============================================================
function debugAllHeaders() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  Logger.log('=== 全ヘッダー一覧（' + lastCol + '列）===');
  for (var i = 0; i < headers.length; i++) {
    if (headers[i]) {
      var mapped = COLUMN_MAPPING[headers[i]] ? '→ ' + COLUMN_MAPPING[headers[i]] : '❌ マッピングなし';
      Logger.log('列' + (i + 1) + ': "' + headers[i] + '" ' + mapped);
    }
  }

  // AA9195の問題フィールドを重点確認
  Logger.log('');
  Logger.log('=== 問題フィールドの確認 ===');
  var targets = [
    'CWの方へ依頼メール（サイト登録）',
    'サイト登録依頼者',
    'CWの方へ依頼メール（間取り、区画図）',
    '間取図確認OK送信',
    '間取図格納済み連絡メール',
    'メール配信'
  ];

  targets.forEach(function(target) {
    var found = false;
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i]).trim() === target) {
        Logger.log('✅ "' + target + '" → 列' + (i + 1) + ' マッピング: ' + (COLUMN_MAPPING[target] || '❌ なし'));
        found = true;
        break;
      }
    }
    if (!found) {
      Logger.log('❌ "' + target + '" が見つからない');
      // 類似ヘッダーを探す
      for (var j = 0; j < headers.length; j++) {
        var h = String(headers[j]);
        if (h && (h.indexOf('CW') >= 0 || h.indexOf('サイト登録') >= 0 || h.indexOf('間取') >= 0 || h.indexOf('メール配信') >= 0)) {
          Logger.log('  候補: 列' + (j + 1) + ' "' + h + '"');
        }
      }
    }
  });
}

// ============================================================
// AA9195を単体同期（手動実行用）
// ============================================================
function testAA9195() {
  Logger.log('=== AA9195 単体同期テスト ===');
  syncSingleWorkTask('AA9195');
  Logger.log('=== 完了 ===');
}

// ============================================================
// デバッグ用：AA9195の問題フィールドの値を確認
// ============================================================
function debugAA9195Fields() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 物件番号列を探す
  var pnCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === '物件番号') { pnCol = i; break; }
  }
  if (pnCol < 0) { Logger.log('物件番号列が見つかりません'); return; }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var j = 0; j < allData.length; j++) {
    if (String(allData[j][pnCol]) === 'AA9195') {
      var row = allData[j];
      Logger.log('=== AA9195 問題フィールドの値 ===');
      var targets = [
        'CWの方へ依頼メール（サイト登録）',
        'サイト登録依頼者',
        'CWの方へ依頼メール（間取り、区画図）',
        '間取図確認OK送信',
        '間取図格納済み連絡メール',
        'メール配信'
      ];
      targets.forEach(function(target) {
        for (var k = 0; k < headers.length; k++) {
          if (String(headers[k]).trim() === target) {
            Logger.log('"' + target + '" (列' + (k+1) + '): "' + row[k] + '"');
            return;
          }
        }
        Logger.log('"' + target + '": ヘッダーが見つからない');
      });
      return;
    }
  }
  Logger.log('AA9195が見つかりません');
}

// ============================================================
// CWカウント同期
// ============================================================

/**
 * CWカウントシートから指定項目の「現在計」を取得するヘルパー関数
 * @param {Sheet} sheet - CWカウントシート
 * @param {string} itemName - 検索する項目名
 * @returns {string|null} 現在計の値、見つからない場合は null
 */
function getCwCountValue(sheet, itemName) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2 || lastCol < 1) return null;

  // シート構造: 1行目がヘッダー（A1=「項目」、B1以降=各項目名）
  //             2行目以降がデータ（A列=行ラベル、B列以降=値）
  // 例: A1=項目, B1=サイト登録, C1=間取図（300円）
  //     A2=回数, B2=236, C2=148

  // 1行目から itemName の列インデックスを探す
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var itemColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === itemName) {
      itemColIndex = i;
      break;
    }
  }

  if (itemColIndex < 0) {
    Logger.log('CWカウント: 「' + itemName + '」列が見つかりません');
    return null;
  }

  // 2行目の値を取得（回数行）
  var val = sheet.getRange(2, itemColIndex + 1).getValue();
  var strVal = String(val).trim();
  return strVal === '' ? null : strVal;
}

/**
 * CWカウントシートのデータを Supabase cw_counts テーブルに同期する
 * エラー時はログに記録してスキップ（業務依頼同期は継続）
 */
function syncCwCounts() {
  Logger.log('--- CWカウント同期開始 ---');

  try {
    // CWカウントシートを開く（業務依頼シートと同じスプレッドシートID）
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var cwSheet = ss.getSheetByName('CWカウント');

    if (!cwSheet) {
      Logger.log('CWカウント: シート「CWカウント」が見つかりません。スキップします。');
      return;
    }

    // 同期対象の項目
    var targets = [
      '間取図（300円）',
      'サイト登録'
    ];

    var records = [];
    for (var i = 0; i < targets.length; i++) {
      var itemName = targets[i];
      var currentTotal = getCwCountValue(cwSheet, itemName);

      if (currentTotal === null) {
        Logger.log('CWカウント: 「' + itemName + '」の値が見つかりません。スキップします。');
        continue;
      }

      records.push({
        item_name: itemName,
        current_total: currentTotal,
        synced_at: new Date().toISOString()
      });

      Logger.log('CWカウント: 「' + itemName + '」= ' + currentTotal);
    }

    if (records.length === 0) {
      Logger.log('CWカウント: 同期対象レコードなし。スキップします。');
      return;
    }

    // Supabase cw_counts テーブルへ upsert（item_name をキーに）
    var url = CONFIG.SUPABASE_URL + '/rest/v1/cw_counts?on_conflict=item_name';
    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': CONFIG.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + CONFIG.SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      payload: JSON.stringify(records),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode >= 200 && statusCode < 300) {
      Logger.log('CWカウント: ' + records.length + '件 upsert成功');
    } else {
      var body = response.getContentText();
      Logger.log('CWカウント: upsertエラー HTTP ' + statusCode + ': ' + body);
    }

  } catch (e) {
    Logger.log('CWカウント: 予期しないエラー - ' + e.toString());
    // エラーが発生しても業務依頼同期は継続するためここで return しない
  }

  Logger.log('--- CWカウント同期完了 ---');
}
