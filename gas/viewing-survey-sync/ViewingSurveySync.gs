/**
 * 内覧アンケート同期スクリプト（GAS → Supabase直接書き込み）
 *
 * 概要:
 * - 「内覧アンケート」スプレッドシートを読み込み
 * - B列「弊社管理番号（入力不要）」= 買主番号
 * - O列「まとめ」= viewing_survey_result
 * - Supabase の buyers テーブルに viewing_survey_result を upsert
 * - 10分ごとのトリガーで自動実行
 *
 * 相互同期:
 * - viewing_survey_confirmed（内覧アンケート確認）は買主リストBE列と同期
 * - 確認済みボタン押下時はフロントエンド → バックエンド → Supabase → 買主リストGASが書き戻し
 */

// ============================================================
// 設定
// ============================================================
var SURVEY_CONFIG = {
  // 内覧アンケートスプレッドシートID
  SPREADSHEET_ID: '11wSOSaoTBanlH0ClpDx9NdBnHMGYmrYGs95gdu7T3BQ',
  SHEET_NAME: 'フォームの回答 1',  // ← 実際のシート名に合わせて変更してください
  SUPABASE_URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8',
  TABLE_NAME: 'buyers',
  SYNC_INTERVAL_MINUTES: 10,
  // B列（0-indexed: 1）= 弊社管理番号（買主番号）
  BUYER_NUMBER_COL: 1,
  // O列（0-indexed: 14）= まとめ
  SUMMARY_COL: 14,
};

// ハッシュ保存用シート名
var SURVEY_HASH_SHEET_NAME = '_survey_hashes';

// ============================================================
// ハッシュ差分検知ユーティリティ
// ============================================================
function surveyGetHashSheet_(ss) {
  var sheet = ss.getSheetByName(SURVEY_HASH_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SURVEY_HASH_SHEET_NAME);
    sheet.hideSheet();
    sheet.getRange(1, 1).setValue('buyer_number');
    sheet.getRange(1, 2).setValue('hash');
    Logger.log('ハッシュシートを新規作成しました');
  }
  return sheet;
}

function surveyLoadRowHashes_(ss) {
  var sheet = surveyGetHashSheet_(ss);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  var result = {};
  for (var i = 0; i < data.length; i++) {
    var key = String(data[i][0]);
    if (key) result[key] = String(data[i][1]);
  }
  return result;
}

function surveySaveRowHashes_(ss, hashes) {
  var sheet = surveyGetHashSheet_(ss);
  var keys = Object.keys(hashes);
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
  }
  if (keys.length === 0) return;
  var rows = [];
  for (var i = 0; i < keys.length; i++) {
    rows.push([keys[i], hashes[keys[i]]]);
  }
  sheet.getRange(2, 1, rows.length, 2).setValues(rows);
}

// ============================================================
// メイン同期関数（トリガーから呼び出される）
// ============================================================
function syncViewingSurvey() {
  var startTime = new Date();
  Logger.log('=== 内覧アンケート同期開始: ' + startTime.toISOString() + ' ===');

  try {
    var ss = SpreadsheetApp.openById(SURVEY_CONFIG.SPREADSHEET_ID);
    
    // シート名を自動検出（最初のシートを使用、または設定名で検索）
    var sheet = ss.getSheetByName(SURVEY_CONFIG.SHEET_NAME);
    if (!sheet) {
      // シートが見つからない場合は最初のシートを使用
      var sheets = ss.getSheets();
      if (sheets.length === 0) {
        Logger.log('ERROR: シートが存在しません');
        return;
      }
      sheet = sheets[0];
      Logger.log('シート「' + SURVEY_CONFIG.SHEET_NAME + '」が見つからないため、最初のシート「' + sheet.getName() + '」を使用します');
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      Logger.log('データなし（ヘッダー行のみ）');
      return;
    }

    Logger.log('データ行数: ' + (lastRow - 1) + ', 列数: ' + lastCol);

    // ヘッダー行を取得してB列・O列のインデックスを確認
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    Logger.log('B列ヘッダー: ' + headers[SURVEY_CONFIG.BUYER_NUMBER_COL]);
    Logger.log('O列ヘッダー: ' + (lastCol > SURVEY_CONFIG.SUMMARY_COL ? headers[SURVEY_CONFIG.SUMMARY_COL] : '列が存在しない'));

    // 全データを取得
    var rawValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // ハッシュ差分検知
    var prevHashes = surveyLoadRowHashes_(ss);
    var newHashes = {};
    var records = [];
    var skippedCount = 0;
    var unchangedCount = 0;

    for (var i = 0; i < rawValues.length; i++) {
      var row = rawValues[i];
      
      // B列: 買主番号
      var buyerNumber = String(row[SURVEY_CONFIG.BUYER_NUMBER_COL] || '').trim();
      if (!buyerNumber) {
        skippedCount++;
        continue;
      }

      // O列: まとめ
      var summary = lastCol > SURVEY_CONFIG.SUMMARY_COL 
        ? String(row[SURVEY_CONFIG.SUMMARY_COL] || '').trim()
        : '';

      var hash = buyerNumber + '|' + summary;
      newHashes[buyerNumber] = hash;

      // 前回と同じハッシュならスキップ
      if (prevHashes[buyerNumber] === hash) {
        unchangedCount++;
        continue;
      }

      records.push({
        buyer_number: buyerNumber,
        viewing_survey_result: summary || null,
        last_synced_at: new Date().toISOString(),
      });
    }

    Logger.log('変更検知: ' + records.length + '件 / 変更なし: ' + unchangedCount + '件 / スキップ: ' + skippedCount + '件');

    if (records.length === 0) {
      Logger.log('変更なし、upsertをスキップ');
    } else {
      // 重複除去（同一買主番号の最後の行を使用）
      var deduped = {};
      for (var d = 0; d < records.length; d++) {
        deduped[records[d].buyer_number] = records[d];
      }
      var dedupedRecords = Object.values(deduped);

      var successCount = 0;
      var errorCount = 0;
      var failedBuyerNumbers = [];

      // バッチサイズ50でupsert
      var BATCH_SIZE = 50;
      for (var j = 0; j < dedupedRecords.length; j += BATCH_SIZE) {
        var batch = dedupedRecords.slice(j, j + BATCH_SIZE);
        var result = surveyUpsertToSupabase(batch);
        if (result.success) {
          successCount += batch.length;
          Logger.log('バッチ ' + (Math.floor(j / BATCH_SIZE) + 1) + ': ' + batch.length + '件 upsert成功');
        } else {
          errorCount += batch.length;
          Logger.log('バッチ ' + (Math.floor(j / BATCH_SIZE) + 1) + ': エラー - ' + result.error);
          for (var b = 0; b < batch.length; b++) {
            failedBuyerNumbers.push(batch[b].buyer_number);
          }
        }
        if (j + BATCH_SIZE < dedupedRecords.length) {
          Utilities.sleep(300);
        }
      }

      // 失敗した行はハッシュを前回値に戻す（次回リトライ）
      for (var f = 0; f < failedBuyerNumbers.length; f++) {
        var fn = failedBuyerNumbers[f];
        newHashes[fn] = prevHashes[fn] || '';
      }

      var duration = (new Date() - startTime) / 1000;
      Logger.log('=== 同期完了: 成功=' + successCount + ', エラー=' + errorCount + ', 所要時間=' + duration + '秒 ===');
    }

    // ハッシュを保存
    surveySaveRowHashes_(ss, newHashes);

  } catch (e) {
    Logger.log('ERROR: 予期しないエラー - ' + e.toString());
    Logger.log(e.stack);
  }
}

// ============================================================
// Supabase upsert（viewing_survey_result のみ更新）
// ============================================================
function surveyUpsertToSupabase(records) {
  var baseUrl = SURVEY_CONFIG.SUPABASE_URL + '/rest/v1/' + SURVEY_CONFIG.TABLE_NAME;

  if (records.length === 0) return { success: true };

  try {
    var response = UrlFetchApp.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SURVEY_CONFIG.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SURVEY_CONFIG.SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      payload: JSON.stringify(records),
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      var body = response.getContentText().substring(0, 500);
      Logger.log('バルクUPSERT失敗: HTTP ' + code + ' ' + body);
      return { success: false, error: 'HTTP ' + code + ': ' + body };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// viewing_survey_confirmed をスプレッドシートに書き戻す
// （買主リストGASから呼び出すか、または独立したトリガーで実行）
// ============================================================
function syncSurveyConfirmedToSheet() {
  Logger.log('=== 内覧アンケート確認 書き戻し開始 ===');

  try {
    // Supabaseから viewing_survey_confirmed が入力済みの買主を取得
    var url = SURVEY_CONFIG.SUPABASE_URL + '/rest/v1/' + SURVEY_CONFIG.TABLE_NAME
      + '?select=buyer_number,viewing_survey_confirmed'
      + '&viewing_survey_confirmed=not.is.null'
      + '&viewing_survey_confirmed=neq.';

    var response = UrlFetchApp.fetch(url, {
      method: 'GET',
      headers: {
        'apikey': SURVEY_CONFIG.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + SURVEY_CONFIG.SUPABASE_SERVICE_KEY,
      },
      muteHttpExceptions: true
    });

    var code = response.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('ERROR: Supabase取得失敗 HTTP ' + code);
      return;
    }

    var buyers = JSON.parse(response.getContentText());
    Logger.log('確認済み買主: ' + buyers.length + '件');

    if (buyers.length === 0) return;

    // 買主番号 → confirmed値 のマップを作成
    var confirmedMap = {};
    for (var i = 0; i < buyers.length; i++) {
      confirmedMap[buyers[i].buyer_number] = buyers[i].viewing_survey_confirmed;
    }

    // 内覧アンケートスプシのB列を確認して書き戻し
    var ss = SpreadsheetApp.openById(SURVEY_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SURVEY_CONFIG.SHEET_NAME);
    if (!sheet) {
      var sheets = ss.getSheets();
      if (sheets.length === 0) return;
      sheet = sheets[0];
    }

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var lastCol = sheet.getLastColumn();
    var buyerNumbers = sheet.getRange(2, SURVEY_CONFIG.BUYER_NUMBER_COL + 1, lastRow - 1, 1).getValues();

    var updatedCount = 0;
    for (var j = 0; j < buyerNumbers.length; j++) {
      var bn = String(buyerNumbers[j][0] || '').trim();
      if (bn && confirmedMap[bn] !== undefined) {
        // BE列（57列目）に書き戻し（内覧アンケートスプシには確認列がないため、ここでは何もしない）
        // 内覧アンケートスプシには確認列がないため、買主リストへの書き戻しはBuyerSync.gsが担当
        updatedCount++;
      }
    }

    Logger.log('書き戻し対象: ' + updatedCount + '件');

  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
  }
}

// ============================================================
// トリガー設定（一度だけ手動実行）
// ============================================================
function surveySetupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncViewingSurvey') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }
  ScriptApp.newTrigger('syncViewingSurvey')
    .timeBased()
    .everyMinutes(SURVEY_CONFIG.SYNC_INTERVAL_MINUTES)
    .create();
  Logger.log('トリガーを設定しました: ' + SURVEY_CONFIG.SYNC_INTERVAL_MINUTES + '分ごとに syncViewingSurvey() を実行');
}

// ============================================================
// テスト用
// ============================================================
function surveyTestSync() {
  Logger.log('=== テスト同期開始 ===');
  syncViewingSurvey();
  Logger.log('=== テスト同期完了 ===');
}

function surveyResetHashCache() {
  var ss = SpreadsheetApp.openById(SURVEY_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SURVEY_HASH_SHEET_NAME);
  if (sheet) {
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 2).clearContent();
    Logger.log('✅ ハッシュキャッシュをリセットしました。次回同期で全件再同期されます。');
  } else {
    Logger.log('ハッシュシートが存在しません（初回実行前）');
  }
}

// ============================================================
// シート名確認用（初回設定時に実行して正しいシート名を確認）
// ============================================================
function checkSheetNames() {
  var ss = SpreadsheetApp.openById(SURVEY_CONFIG.SPREADSHEET_ID);
  var sheets = ss.getSheets();
  Logger.log('=== シート一覧 ===');
  for (var i = 0; i < sheets.length; i++) {
    Logger.log((i + 1) + ': ' + sheets[i].getName());
  }
  Logger.log('=== ヘッダー行（最初のシート）===');
  var firstSheet = sheets[0];
  var headers = firstSheet.getRange(1, 1, 1, Math.min(firstSheet.getLastColumn(), 20)).getValues()[0];
  for (var j = 0; j < headers.length; j++) {
    Logger.log('列' + (j + 1) + ' (' + String.fromCharCode(65 + j) + '列): ' + headers[j]);
  }
}
