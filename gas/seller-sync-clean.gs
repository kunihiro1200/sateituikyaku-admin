// ============================================================
// 設定
// ============================================================

var SELLER_SYNC_CONFIG = {
  BACKEND_URL: 'https://sateituikyaku-admin-backend.vercel.app',
  CRON_SECRET: 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=',
  SYNC_INTERVAL_MINUTES: 10
};

var SUPABASE_CONFIG = {
  URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
};

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 行データをオブジェクトに変換（Dateは YYYY/MM/DD 文字列に変換）
 */
function rowToObject(headers, rowData) {
  var obj = {};
  for (var j = 0; j < headers.length; j++) {
    if (headers[j] === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      obj[headers[j]] = (val.getTime() === 0) ? '' :
        val.getFullYear() + '/' +
        String(val.getMonth() + 1).padStart(2, '0') + '/' +
        String(val.getDate()).padStart(2, '0');
    } else {
      obj[headers[j]] = val;
    }
  }
  return obj;
}

/**
 * バックエンドAPIにPOSTリクエストを送信
 */
function postToBackend(path, payload) {
  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SELLER_SYNC_CONFIG.CRON_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  return UrlFetchApp.fetch(SELLER_SYNC_CONFIG.BACKEND_URL + path, options);
}

// ============================================================
// メイン同期（10分トリガー）
// ============================================================

/**
 * 10分ごとに実行: スプレッドシート全体をバックエンドと同期
 */
function syncSellerList() {
  var startTime = new Date();
  Logger.log('=== 売主リスト同期開始: ' + startTime.toISOString() + ' ===');
  try {
    var response = postToBackend('/api/sync/trigger?sellersOnly=true', {});
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(responseText);
      var duration = (new Date() - startTime) / 1000;
      Logger.log('✅ 同期成功');
      Logger.log('  追加: ' + (result.data ? result.data.added : 0) + '件');
      Logger.log('  更新: ' + (result.data ? result.data.updated : 0) + '件');
      Logger.log('  所要時間: ' + duration + '秒');
    } else {
      Logger.log('❌ 同期失敗: HTTP ' + statusCode);
      Logger.log('レスポンス: ' + responseText);
    }
  } catch (e) {
    Logger.log('❌ エラー: ' + e.toString());
    Logger.log(e.stack);
  }
  Logger.log('=== 同期完了 ===');
}

// ============================================================
// 即時同期（onEditトリガー）
// ============================================================

/**
 * スプレッドシート編集時に即時同期
 * ※ setupOnEditTrigger() で登録済みであること
 */
function onEditTrigger(e) {
  try {
    var sheet = e.range.getSheet();
    if (sheet.getName() !== '売主リスト') return;
    var editedRow = e.range.getRow();
    if (editedRow <= 1) return;

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var sellerNumberColIndex = headers.indexOf('売主番号');
    if (sellerNumberColIndex === -1) {
      Logger.log('⚠️ 売主番号列が見つかりません');
      return;
    }

    var rowData = sheet.getRange(editedRow, 1, 1, sheet.getLastColumn()).getValues()[0];
    var sellerNumber = rowData[sellerNumberColIndex];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.startsWith('AA')) return;

    var rowObj = rowToObject(headers, rowData);
    Logger.log('📝 編集検知: ' + sellerNumber + ' (行 ' + editedRow + ')');

    var response = postToBackend('/api/sync/seller-row', rowObj);
    var statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(response.getContentText());
      Logger.log('✅ 即時同期成功: ' + sellerNumber + ' (' + result.action + ')');
    } else {
      Logger.log('❌ 即時同期失敗: HTTP ' + statusCode + ' / ' + response.getContentText());
    }
  } catch (e) {
    Logger.log('❌ onEditTrigger エラー: ' + e.toString());
  }
}

// ============================================================
// トリガー設定（初回のみ手動実行）
// ============================================================

/**
 * 10分ごとの定期同期トリガーを設定
 */
function setupSellerSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncSellerList') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }
  ScriptApp.newTrigger('syncSellerList')
    .timeBased()
    .everyMinutes(SELLER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES)
    .create();
  Logger.log('✅ トリガーを設定しました: ' + SELLER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES + '分ごと');
}

/**
 * onEditトリガーを設定（手動で1回だけ実行）
 */
function setupOnEditTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onEditTrigger') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存のonEditトリガーを削除しました');
    }
  }
  ScriptApp.newTrigger('onEditTrigger')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  Logger.log('✅ onEditトリガーを設定しました');
}

// ============================================================
// テスト・デバッグ用
// ============================================================

/**
 * 定期同期のテスト実行
 */
function testSellerSync() {
  Logger.log('=== テスト同期開始 ===');
  syncSellerList();
  Logger.log('=== テスト同期完了 ===');
}

/**
 * 特定の売主を手動で即時同期
 * sellerNumberStr: 例 'AA13814'
 */
function syncSellerNow(sellerNumberStr) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var sellerNumberCol = headers.indexOf('売主番号');
  var allData = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();

  var targetRow = null;
  for (var r = 0; r < allData.length; r++) {
    if (allData[r][sellerNumberCol] === sellerNumberStr) {
      targetRow = allData[r];
      break;
    }
  }
  if (!targetRow) {
    Logger.log(sellerNumberStr + ' が見つかりません');
    return;
  }

  var rowObj = rowToObject(headers, targetRow);
  var response = postToBackend('/api/sync/seller-row', rowObj);
  Logger.log('ステータス: ' + response.getResponseCode());
  Logger.log('レスポンス: ' + response.getContentText());
}

// ============================================================
// 訪問事前通知メール担当（CV列）一括同期
// Supabaseに直接PATCHして visit_reminder_assignee のみ更新
// 対象: 訪問日が2026年3月1日以降 かつ CV列に値が入っている売主
// ============================================================

/**
 * Supabaseのsellersテーブルを seller_number で直接PATCH更新
 */
function patchVisitReminderAssignee_(sellerNumber, value) {
  var url = SUPABASE_CONFIG.URL + '/rest/v1/sellers?seller_number=eq.' + encodeURIComponent(sellerNumber);
  var options = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_CONFIG.SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify({ visit_reminder_assignee: value || null }),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    return { success: true };
  } else {
    return { success: false, error: 'HTTP ' + code + ': ' + res.getContentText().substring(0, 200) };
  }
}

/**
 * スプレッドシートから対象行を取得
 */
function getVisitReminderTargets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  if (!sheet) {
    Logger.log('❌ シート「売主リスト」が見つかりません');
    return null;
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var sellerNumberIdx = -1;
  var visitDateIdx = -1;
  var visitReminderIdx = -1;

  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    var hNorm = h.replace(/[\s\n\r]/g, '');
    if (h === '売主番号') sellerNumberIdx = i;
    if (hNorm === '訪問日Y/M/D' || h.indexOf('訪問日') === 0) visitDateIdx = i;
    if (h === '訪問事前通知メール担当') visitReminderIdx = i;
  }

  Logger.log('列インデックス → 売主番号:' + sellerNumberIdx + ' 訪問日:' + visitDateIdx + ' 訪問事前通知メール担当:' + visitReminderIdx);

  if (sellerNumberIdx === -1 || visitReminderIdx === -1) {
    Logger.log('❌ 必要な列が見つかりません');
    return null;
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var threshold = new Date('2026-03-01');
  var targets = [];

  for (var r = 0; r < allData.length; r++) {
    var row = allData[r];
    var sellerNumber = String(row[sellerNumberIdx] || '').trim();
    var reminderVal = String(row[visitReminderIdx] || '').trim();

    if (!sellerNumber.match(/^AA\d+$/)) continue;
    if (!reminderVal) continue;

    if (visitDateIdx >= 0) {
      var raw = row[visitDateIdx];
      var visitDate = null;
      if (raw instanceof Date) {
        visitDate = raw;
      } else if (raw) {
        visitDate = new Date(String(raw).replace(/\//g, '-'));
      }
      if (!visitDate || isNaN(visitDate.getTime()) || visitDate < threshold) continue;
    }

    targets.push({ sellerNumber: sellerNumber, value: reminderVal });
  }

  return targets;
}

/**
 * メイン: 一括同期（訪問日2026/3/1以降 かつ CV列に値あり）
 */
function syncVisitReminderAssignee() {
  var targets = getVisitReminderTargets_();
  if (!targets) return;

  Logger.log('対象件数: ' + targets.length);
  if (targets.length === 0) {
    Logger.log('同期対象がありません');
    return;
  }

  var successCount = 0;
  var errorCount = 0;

  for (var i = 0; i < targets.length; i++) {
    var t = targets[i];
    var result = patchVisitReminderAssignee_(t.sellerNumber, t.value);
    if (result.success) {
      successCount++;
      Logger.log('✅ [' + (i + 1) + '/' + targets.length + '] ' + t.sellerNumber + ' → ' + t.value);
    } else {
      errorCount++;
      Logger.log('❌ [' + (i + 1) + '/' + targets.length + '] ' + t.sellerNumber + ' 失敗: ' + result.error);
    }
    Utilities.sleep(150);
  }

  Logger.log('=== 完了: 成功 ' + successCount + '件 / 失敗 ' + errorCount + '件 ===');
}

/**
 * テスト: AA13607のみ単体で同期
 */
function testSyncAA13607() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  if (!sheet) { Logger.log('❌ シートが見つかりません'); return; }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var sellerNumberIdx = -1;
  var visitReminderIdx = -1;
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i]).trim();
    if (h === '売主番号') sellerNumberIdx = i;
    if (h === '訪問事前通知メール担当') visitReminderIdx = i;
  }

  if (sellerNumberIdx === -1 || visitReminderIdx === -1) {
    Logger.log('❌ 必要な列が見つかりません');
    return;
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var r = 0; r < allData.length; r++) {
    if (String(allData[r][sellerNumberIdx] || '').trim() !== 'AA13607') continue;

    var val = String(allData[r][visitReminderIdx] || '').trim();
    Logger.log('AA13607 訪問事前通知メール担当: "' + val + '"');

    var result = patchVisitReminderAssignee_('AA13607', val);
    if (result.success) {
      Logger.log('✅ AA13607 同期成功');
    } else {
      Logger.log('❌ AA13607 同期失敗: ' + result.error);
    }
    return;
  }
  Logger.log('❌ AA13607が見つかりません');
}
