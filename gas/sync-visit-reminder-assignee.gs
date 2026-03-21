/**
 * 訪問事前通知メール担当（CV列）一括同期スクリプト
 *
 * 対象: 訪問日が2026年3月1日以降 かつ CV列に値が入っている売主
 * 方法: Supabaseに直接PATCHして visit_reminder_assignee のみ更新
 *
 * 実行方法:
 *   1. testSyncAA13607() でAA13607単体テスト
 *   2. 成功したら syncVisitReminderAssignee() で一括同期
 */

var VISIT_REMINDER_SUPABASE = {
  URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8',
  SHEET_NAME: '売主リスト',
  VISIT_DATE_FROM: '2026-03-01'
};

/**
 * Supabaseのsellersテーブルを seller_number で直接PATCH更新
 */
function patchVisitReminderAssignee_(sellerNumber, value) {
  var url = VISIT_REMINDER_SUPABASE.URL + '/rest/v1/sellers?seller_number=eq.' + encodeURIComponent(sellerNumber);
  var options = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': VISIT_REMINDER_SUPABASE.SERVICE_KEY,
      'Authorization': 'Bearer ' + VISIT_REMINDER_SUPABASE.SERVICE_KEY,
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
 * 条件: 訪問日が2026/3/1以降 かつ CV列（訪問事前通知メール担当）に値あり
 */
function getVisitReminderTargets_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(VISIT_REMINDER_SUPABASE.SHEET_NAME);
  if (!sheet) {
    Logger.log('❌ シート「' + VISIT_REMINDER_SUPABASE.SHEET_NAME + '」が見つかりません');
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
    if (hNorm === '訪問日Y/M/D' || hNorm === '訪問日\nY/M/D' || h.indexOf('訪問日') === 0) visitDateIdx = i;
    if (h === '訪問事前通知メール担当') visitReminderIdx = i;
  }

  Logger.log('列インデックス → 売主番号:' + sellerNumberIdx + ' 訪問日:' + visitDateIdx + ' 訪問事前通知メール担当:' + visitReminderIdx);

  if (sellerNumberIdx === -1 || visitReminderIdx === -1) {
    Logger.log('❌ 必要な列が見つかりません（売主番号:' + sellerNumberIdx + ' 訪問事前通知メール担当:' + visitReminderIdx + '）');
    return null;
  }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var threshold = new Date(VISIT_REMINDER_SUPABASE.VISIT_DATE_FROM);
  var targets = [];

  for (var r = 0; r < allData.length; r++) {
    var row = allData[r];
    var sellerNumber = String(row[sellerNumberIdx] || '').trim();
    var reminderVal = String(row[visitReminderIdx] || '').trim();

    if (!sellerNumber.match(/^AA\d+$/)) continue;
    if (!reminderVal) continue;

    // 訪問日チェック
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
  var sheet = ss.getSheetByName(VISIT_REMINDER_SUPABASE.SHEET_NAME);
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
    Logger.log('❌ 必要な列が見つかりません（売主番号:' + sellerNumberIdx + ' 訪問事前通知メール担当:' + visitReminderIdx + '）');
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
