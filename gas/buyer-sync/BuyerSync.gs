/**
 * 買主リスト同期スクリプト（GAS → Supabase直接書き込み）
 *
 * 概要:
 * - スプレッドシートの「買主リスト」シートを読み込み
 * - Supabase の buyers テーブルに upsert（buyer_number をキーに）
 * - 10分ごとのトリガーで自動実行
 *
 * セットアップ:
 * 1. このスクリプトをGASエディタに貼り付ける
 * 2. setupTrigger() を一度だけ手動実行してトリガーを設定
 * 3. testSync() で動作確認
 */

// ============================================================
// 設定
// ============================================================
var CONFIG = {
  SPREADSHEET_ID: '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY',
  SHEET_NAME: '買主リスト',
  SUPABASE_URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8',
  TABLE_NAME: 'buyers',
  BATCH_SIZE: 100,  // 1回のupsertで送る行数
  SYNC_INTERVAL_MINUTES: 10
};

// ============================================================
// カラムマッピング（buyer-column-mapping.json と同期）
// ============================================================
var COLUMN_MAPPING = {
  '削除': 'is_deleted',
  '作成日時': 'created_datetime',
  '初動担当': 'initial_assignee',
  '買主ID': 'buyer_id',
  '買主番号': 'buyer_number',
  '受付日': 'reception_date',
  '●氏名・会社名': 'name',
  '建物名/価格 内覧物件は赤表示（★は他社物件）': 'building_name_price',
  '●内覧日(最新）': 'latest_viewing_date',
  '●希望時期': 'desired_timing',
  '後続担当': 'follow_up_assignee',
  '再問合\n（内覧）': 're_inquiry_viewing',
  '●問合時ヒアリング': 'inquiry_hearing',
  '★内覧結果・後続対応': 'viewing_result_follow_up',
  '●問合時確度': 'inquiry_confidence',
  '★最新状況\n': 'latest_status',
  '配信種別': 'distribution_type',
  '★次電日': 'next_call_date',
  'Pinrich': 'pinrich',
  '★エリア': 'desired_area',
  '★希望種別': 'desired_property_type',
  '内覧後売主連絡': 'post_viewing_seller_contact',
  '★築年数': 'desired_building_age',
  '★間取り': 'desired_floor_plan',
  '★温泉あり': 'hot_spring_required',
  '●P台数': 'parking_spaces',
  '★月極でも可': 'monthly_parking_ok',
  '★庭付き': 'garden_required',
  '★眺望良好': 'good_view_required',
  '★ペット可': 'pet_allowed_required',
  '★高層階': 'high_floor_required',
  '★角部屋': 'corner_room_required',
  '内覧シート': 'viewing_sheet',
  'LINE': 'line_id',
  'ニックネーム': 'nickname',
  '●電話番号\n（ハイフン不要）': 'phone_number',
  '●メアド': 'email',
  '●問合せ元': 'inquiry_source',
  '現住居': 'current_residence',
  'athome URL': 'athome_url',
  '2度目以降過去内覧': 'past_viewing_1',
  'キャンペーン　1500万円以上\n（渡した日）': 'campaign_date',
  '電話番号重複件数': 'phone_duplicate_count',
  '物件番号': 'property_number',
  '物件担当者': 'property_assignee',
  'パノラマ削除': 'panorama_deleted',
  'a': 'column_a',
  'メアド確認': 'email_confirmed',
  '物件所在地': 'property_address',
  '公開/非公開': 'public_private'
};

// 型変換ルール
var TYPE_CONVERSIONS = {
  'created_datetime': 'datetime',
  'reception_date': 'date',
  'latest_viewing_date': 'date',
  'next_call_date': 'date',
  'campaign_date': 'date',
  'phone_duplicate_count': 'number',
  'price': 'number'
};

// ============================================================
// メイン同期関数（トリガーから呼び出される）
// ============================================================
function syncBuyers() {
  var startTime = new Date();
  Logger.log('=== 買主同期開始: ' + startTime.toISOString() + ' ===');

  try {
    // スプレッドシートからデータ取得
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
    var headerRange = sheet.getRange(1, 1, 1, lastCol);
    var headers = headerRange.getValues()[0];

    // データ行を UNFORMATTED_VALUE で取得（日付をシリアル値として取得）
    var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    var rawValues = dataRange.getValues();

    // 各行をDBレコードに変換
    var records = [];
    var skippedCount = 0;

    for (var i = 0; i < rawValues.length; i++) {
      var row = rawValues[i];
      var record = mapRowToRecord(headers, row);

      // buyer_number が空の行はスキップ
      if (!record.buyer_number) {
        skippedCount++;
        continue;
      }

      // updated_at と last_synced_at を現在時刻で設定
      var now = new Date().toISOString();
      record.last_synced_at = now;

      records.push(record);
    }

    Logger.log('変換済みレコード数: ' + records.length + '（スキップ: ' + skippedCount + '）');

    // バッチに分けてupsert
    var successCount = 0;
    var errorCount = 0;

    for (var j = 0; j < records.length; j += CONFIG.BATCH_SIZE) {
      var batch = records.slice(j, j + CONFIG.BATCH_SIZE);
      var result = upsertToSupabase(batch);

      if (result.success) {
        successCount += batch.length;
        Logger.log('バッチ ' + (Math.floor(j / CONFIG.BATCH_SIZE) + 1) + ': ' + batch.length + '件 upsert成功');
      } else {
        errorCount += batch.length;
        Logger.log('バッチ ' + (Math.floor(j / CONFIG.BATCH_SIZE) + 1) + ': エラー - ' + result.error);
      }
    }

    var endTime = new Date();
    var duration = (endTime - startTime) / 1000;
    Logger.log('=== 同期完了: 成功=' + successCount + ', エラー=' + errorCount + ', 所要時間=' + duration + '秒 ===');

  } catch (e) {
    Logger.log('ERROR: 予期しないエラー - ' + e.toString());
    Logger.log(e.stack);
  }
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
    // nullでも必ずキーをセット（Supabaseのupsertはバッチ内でキーが揃っている必要がある）
    record[dbColumn] = converted;
  }

  return record;
}

// ============================================================
// 型変換
// ============================================================
function convertValue(column, value) {
  // 空値はnull
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
    // 起算日: 1899/12/30
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
 * 日時変換
 */
function parseDatetime(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }

  var str = String(value).trim();
  if (!str) return null;

  // YYYY/MM/DD HH:mm:ss
  var match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    var sec = match[6] || '00';
    return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0') +
           'T' + match[4].padStart(2, '0') + ':' + match[5] + ':' + sec;
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
  var url = CONFIG.SUPABASE_URL + '/rest/v1/' + CONFIG.TABLE_NAME;

  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': CONFIG.SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + CONFIG.SUPABASE_SERVICE_KEY,
      'Prefer': 'resolution=merge-duplicates'  // upsert（重複時は更新）
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
    if (triggers[i].getHandlerFunction() === 'syncBuyers') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }

  // 10分ごとのトリガーを作成
  ScriptApp.newTrigger('syncBuyers')
    .timeBased()
    .everyMinutes(CONFIG.SYNC_INTERVAL_MINUTES)
    .create();

  Logger.log('トリガーを設定しました: ' + CONFIG.SYNC_INTERVAL_MINUTES + '分ごとに syncBuyers() を実行');
}

// ============================================================
// テスト用（手動実行で動作確認）
// ============================================================
function testSync() {
  Logger.log('=== テスト同期開始 ===');
  syncBuyers();
  Logger.log('=== テスト同期完了 ===');
}

/**
 * 特定の買主番号だけ同期（デバッグ用）
 */
function syncSingleBuyer(buyerNumber) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    Logger.log('シートが見つかりません');
    return;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // buyer_number の列インデックスを探す
  var buyerNumberColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === '買主番号') {
      buyerNumberColIndex = i;
      break;
    }
  }

  if (buyerNumberColIndex < 0) {
    Logger.log('「買主番号」列が見つかりません');
    return;
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  for (var j = 0; j < allData.length; j++) {
    var row = allData[j];
    if (String(row[buyerNumberColIndex]) === String(buyerNumber)) {
      var record = mapRowToRecord(headers, row);
      record.last_synced_at = new Date().toISOString();
      Logger.log('レコード: ' + JSON.stringify(record));

      var result = upsertToSupabase([record]);
      Logger.log('結果: ' + JSON.stringify(result));
      return;
    }
  }

  Logger.log('買主番号 ' + buyerNumber + ' が見つかりません');
}
