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
// 日付フォーマットユーティリティ
// ============================================================

/**
 * 日付値を YYYY-MM-DD 形式に変換
 * GASのrowToObjectで既にDate→YYYY/MM/DD変換済みなので文字列処理のみ
 */
function formatDateToISO_(value) {
  if (!value || value === '') return null;
  var str = String(value).trim();

  // YYYY/MM/DD 形式
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    var parts = str.split('/');
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  // YYYY-MM-DD 形式
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    var parts2 = str.split('-');
    return parts2[0] + '-' + parts2[1].padStart(2, '0') + '-' + parts2[2].padStart(2, '0');
  }
  return null;
}

// ============================================================
// Supabase直接更新ユーティリティ
// ============================================================

/**
 * Supabaseのsellersテーブルを seller_number で直接PATCH更新（汎用）
 */
function patchSellerToSupabase_(sellerNumber, updateData) {
  var url = SUPABASE_CONFIG.URL + '/rest/v1/sellers?seller_number=eq.' + encodeURIComponent(sellerNumber);
  var options = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_CONFIG.SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(updateData),
    muteHttpExceptions: true
  };
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) {
    return { success: true };
  } else {
    return { success: false, error: 'HTTP ' + code + ': ' + res.getContentText().substring(0, 300) };
  }
}

/**
 * Supabaseから全売主の更新対象フィールドを取得（ページネーション対応）
 */
function fetchAllSellersFromSupabase_() {
  var allSellers = [];
  var pageSize = 1000;
  var offset = 0;
  var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status';

  while (true) {
    var url = SUPABASE_CONFIG.URL + '/rest/v1/sellers?select=' + fields +
      '&deleted_at=is.null' +
      '&offset=' + offset + '&limit=' + pageSize;
    var options = {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY
      },
      muteHttpExceptions: true
    };
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code !== 200) {
      Logger.log('❌ Supabase取得失敗: HTTP ' + code);
      return null;
    }
    var page = JSON.parse(res.getContentText());
    if (!page || page.length === 0) break;
    allSellers = allSellers.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return allSellers;
}

/**
 * Phase 2: スプレッドシートとSupabaseを直接比較して更新
 * バックエンドAPIを経由しないためVercelのタイムアウト制限を回避
 * ※ 暗号化フィールド（name/phone_number/email/address）は更新しない
 */
function syncUpdatesToSupabase_(sheetRows) {
  Logger.log('📥 Phase 2: Supabase直接更新同期開始...');

  // Supabaseから全売主データを取得
  var dbSellers = fetchAllSellersFromSupabase_();
  if (!dbSellers) {
    Logger.log('❌ Supabaseからのデータ取得失敗');
    return { updated: 0, errors: 0 };
  }
  Logger.log('📊 DB売主数: ' + dbSellers.length);

  // DBデータをMapに変換（高速検索用）
  var dbMap = {};
  for (var i = 0; i < dbSellers.length; i++) {
    dbMap[dbSellers[i].seller_number] = dbSellers[i];
  }

  var updatedCount = 0;
  var errorCount = 0;
  var batchRequests = [];

  for (var r = 0; r < sheetRows.length; r++) {
    var row = sheetRows[r];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;

    var dbSeller = dbMap[sellerNumber];
    if (!dbSeller) continue; // DBにない売主はPhase 1（追加）で対応

    // 差分チェックと更新データ構築
    var updateData = {};
    var needsUpdate = false;

    // status
    var sheetStatus = row['状況（当社）'] || '';
    if (sheetStatus && sheetStatus !== (dbSeller.status || '')) {
      updateData.status = sheetStatus;
      needsUpdate = true;
    }

    // next_call_date
    var sheetNextCallDate = formatDateToISO_(row['次電日']);
    var dbNextCallDate = dbSeller.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
    if (sheetNextCallDate !== dbNextCallDate) {
      updateData.next_call_date = sheetNextCallDate; // null でもセット（クリア対応）
      needsUpdate = true;
    }

    // visit_assignee（「外す」または空欄 → null）
    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) {
      updateData.visit_assignee = sheetVisitAssignee;
      needsUpdate = true;
    }

    // unreachable_status
    var sheetUnreachable = row['不通'] ? String(row['不通']) : null;
    var dbUnreachable = dbSeller.unreachable_status || null;
    if (sheetUnreachable !== dbUnreachable) {
      updateData.unreachable_status = sheetUnreachable;
      needsUpdate = true;
    }

    // comments
    var sheetComments = row['コメント'] ? String(row['コメント']) : null;
    var dbComments = dbSeller.comments || null;
    if (sheetComments !== dbComments) {
      updateData.comments = sheetComments;
      needsUpdate = true;
    }

    // phone_contact_person
    var sheetPhoneContact = row['電話担当（任意）'] ? String(row['電話担当（任意）']) : null;
    var dbPhoneContact = dbSeller.phone_contact_person || null;
    if (sheetPhoneContact !== dbPhoneContact) {
      updateData.phone_contact_person = sheetPhoneContact;
      needsUpdate = true;
    }

    // preferred_contact_time
    var sheetPreferredTime = row['連絡取りやすい日、時間帯'] ? String(row['連絡取りやすい日、時間帯']) : null;
    var dbPreferredTime = dbSeller.preferred_contact_time || null;
    if (sheetPreferredTime !== dbPreferredTime) {
      updateData.preferred_contact_time = sheetPreferredTime;
      needsUpdate = true;
    }

    // contact_method
    var sheetContactMethod = row['連絡方法'] ? String(row['連絡方法']) : null;
    var dbContactMethod = dbSeller.contact_method || null;
    if (sheetContactMethod !== dbContactMethod) {
      updateData.contact_method = sheetContactMethod;
      needsUpdate = true;
    }

    // contract_year_month
    var sheetContractYM = formatDateToISO_(row['契約年月 他決は分かった時点']);
    var dbContractYM = dbSeller.contract_year_month ? String(dbSeller.contract_year_month).substring(0, 10) : null;
    if (sheetContractYM !== dbContractYM) {
      updateData.contract_year_month = sheetContractYM;
      needsUpdate = true;
    }

    // current_status（状況（売主））
    var sheetCurrentStatus = row['状況（売主）'] ? String(row['状況（売主）']) : null;
    var dbCurrentStatus = dbSeller.current_status || null;
    if (sheetCurrentStatus !== dbCurrentStatus) {
      updateData.current_status = sheetCurrentStatus;
      needsUpdate = true;
    }

    // pinrich_status
    var sheetPinrich = row['Pinrich'] ? String(row['Pinrich']) : null;
    var dbPinrich = dbSeller.pinrich_status || null;
    if (sheetPinrich !== dbPinrich) {
      updateData.pinrich_status = sheetPinrich;
      needsUpdate = true;
    }

    if (!needsUpdate) continue;

    updateData.updated_at = new Date().toISOString();

    // Supabaseに直接PATCH
    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) {
      updatedCount++;
      Logger.log('✅ ' + sellerNumber + ': 更新 (' + Object.keys(updateData).filter(function(k){ return k !== 'updated_at'; }).join(', ') + ')');
    } else {
      errorCount++;
      Logger.log('❌ ' + sellerNumber + ': 更新失敗 - ' + result.error);
    }

    // GASの実行時間制限対策（150ms待機）
    Utilities.sleep(150);
  }

  Logger.log('📊 Phase 2完了: 更新 ' + updatedCount + '件 / エラー ' + errorCount + '件');
  return { updated: updatedCount, errors: errorCount };
}

// ============================================================
// メイン同期（10分トリガー）
// ============================================================

/**
 * 10分ごとに実行: スプレッドシート全体をSupabaseと直接同期
 * Phase 2（更新）はSupabaseに直接PATCHしてVercelタイムアウトを回避
 * Phase 1（追加）・Phase 3（削除）はバックエンドAPIを使用
 */
function syncSellerList() {
  var startTime = new Date();
  Logger.log('=== 売主リスト同期開始: ' + startTime.toISOString() + ' ===');

  // スプレッドシートから全データを読み込む（Phase 1・2で共用）
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  if (!sheet) {
    Logger.log('❌ シート「売主リスト」が見つかりません');
    return;
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var sheetRows = [];
  for (var i = 0; i < allData.length; i++) {
    sheetRows.push(rowToObject(headers, allData[i]));
  }
  Logger.log('📊 スプレッドシート行数: ' + sheetRows.length);

  // Phase 1: 追加同期（バックエンドAPI経由 - 暗号化が必要なため）
  try {
    var response = postToBackend('/api/sync/trigger?additionOnly=true', {});
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();
    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(responseText);
      Logger.log('✅ 追加同期成功: ' + (result.data ? result.data.added : 0) + '件追加');
    } else {
      Logger.log('⚠️ 追加同期失敗: HTTP ' + statusCode + ' (新規売主は次回以降に同期)');
    }
  } catch (e) {
    Logger.log('⚠️ 追加同期エラー: ' + e.toString());
  }

  // Phase 2: 更新同期（Supabase直接PATCH - Vercelタイムアウト回避）
  var updateResult = syncUpdatesToSupabase_(sheetRows);

  // Phase 3: 削除同期（バックエンドAPI経由）
  try {
    var delResponse = postToBackend('/api/sync/trigger?deletionOnly=true', {});
    var delStatusCode = delResponse.getResponseCode();
    var delResponseText = delResponse.getContentText();
    if (delStatusCode >= 200 && delStatusCode < 300) {
      var delResult = JSON.parse(delResponseText);
      Logger.log('✅ 削除同期成功: ' + (delResult.data ? delResult.data.deleted : 0) + '件削除');
    } else {
      Logger.log('❌ 削除同期失敗: HTTP ' + delStatusCode);
      Logger.log('レスポンス: ' + delResponseText);
    }
  } catch (e) {
    Logger.log('❌ 削除同期エラー: ' + e.toString());
  }

  var duration = (new Date() - startTime) / 1000;
  Logger.log('  所要時間: ' + duration + '秒');
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
 * 特定の売主を手動で即時同期（Supabase直接PATCH）
 * sellerNumberStr: 例 'AA907'
 */
function syncSellerNow(sellerNumberStr) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');
  if (!sheet) {
    Logger.log('❌ シート「売主リスト」が見つかりません');
    return;
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  // 売主番号列を探す（ループで確実に検索）
  var sellerNumberCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === '売主番号') {
      sellerNumberCol = i;
      break;
    }
  }
  if (sellerNumberCol === -1) {
    Logger.log('❌ 売主番号列が見つかりません');
    return;
  }
  Logger.log('売主番号列インデックス: ' + sellerNumberCol);

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  var targetRow = null;
  for (var r = 0; r < allData.length; r++) {
    var cellVal = String(allData[r][sellerNumberCol] || '').trim();
    if (cellVal === sellerNumberStr) {
      targetRow = allData[r];
      Logger.log('✅ ' + sellerNumberStr + ' を行 ' + (r + 2) + ' で発見');
      break;
    }
  }
  if (!targetRow) {
    Logger.log('❌ ' + sellerNumberStr + ' が見つかりません（全 ' + allData.length + ' 行を検索）');
    return;
  }

  var rowObj = rowToObject(headers, targetRow);
  Logger.log('次電日: ' + rowObj['次電日']);
  Logger.log('状況（当社）: ' + rowObj['状況（当社）']);

  // Supabase直接PATCHで更新
  var updateData = {};
  var needsUpdate = false;

  var sheetNextCallDate = formatDateToISO_(rowObj['次電日']);
  if (sheetNextCallDate !== null) {
    updateData.next_call_date = sheetNextCallDate;
    needsUpdate = true;
  }

  var sheetStatus = rowObj['状況（当社）'] || '';
  if (sheetStatus) {
    updateData.status = sheetStatus;
    needsUpdate = true;
  }

  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
  needsUpdate = true;

  if (rowObj['コメント']) updateData.comments = String(rowObj['コメント']);
  if (rowObj['不通']) updateData.unreachable_status = String(rowObj['不通']);
  if (rowObj['Pinrich']) updateData.pinrich_status = String(rowObj['Pinrich']);

  var sheetContractYM = formatDateToISO_(rowObj['契約年月 他決は分かった時点']);
  if (sheetContractYM !== null) updateData.contract_year_month = sheetContractYM;

  updateData.updated_at = new Date().toISOString();

  Logger.log('更新データ: ' + JSON.stringify(updateData));

  var result = patchSellerToSupabase_(sellerNumberStr, updateData);
  if (result.success) {
    Logger.log('✅ ' + sellerNumberStr + ' Supabase更新成功');
  } else {
    Logger.log('❌ ' + sellerNumberStr + ' Supabase更新失敗: ' + result.error);
  }
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
 * AA907を手動で即時同期（引数なしで実行可能）
 */
function syncAA907() {
  syncSellerNow('AA907');
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
