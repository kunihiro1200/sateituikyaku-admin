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
    // ヘッダー名を正規化（スペース・改行・全角スペースをtrim）
    var headerName = String(headers[j]).replace(/^[\s\u3000\n\r]+|[\s\u3000\n\r]+$/g, '');
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      obj[headerName] = (val.getTime() === 0) ? '' :
        val.getFullYear() + '/' +
        String(val.getMonth() + 1).padStart(2, '0') + '/' +
        String(val.getDate()).padStart(2, '0');
    } else {
      obj[headerName] = val;
    }
  }
  return obj;
}

/**
 * バックエンドAPIにPOSTリクエストを送信
 * タイムアウト: 15秒（Vercelのコールドスタートを考慮）
 */
function postToBackend(path, payload) {
  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SELLER_SYNC_CONFIG.CRON_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
    deadline: 15
  };
  return UrlFetchApp.fetch(SELLER_SYNC_CONFIG.BACKEND_URL + path, options);
}

/**
 * 日付値を YYYY-MM-DD 形式に変換
 */
function formatDateToISO_(value) {
  if (!value || value === '') return null;
  var str = String(value).trim();
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    var parts = str.split('/');
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    var parts2 = str.split('-');
    return parts2[0] + '-' + parts2[1].padStart(2, '0') + '-' + parts2[2].padStart(2, '0');
  }
  return null;
}

/**
 * Supabaseのsellersテーブルを seller_number で直接PATCH更新（単件）
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
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      return { success: false, error: 'HTTP ' + code + ': ' + res.getContentText().substring(0, 300) };
    }
  } catch (e) {
    return { success: false, error: 'Network error: ' + e.toString() };
  }
}

// ============================================================
// ハッシュ管理（差分検知用）
// ============================================================

/**
 * 行データのハッシュ文字列を生成（差分検知用）
 */
function buildRowHash_(row) {
  var keys = [
    '状況（当社）', '次電日', '営担', '不通', 'コメント', '電話担当（任意）',
    '連絡取りやすい日、時間帯', '連絡方法', '契約年月 他決は分かった時点',
    '状況（売主）', 'Pinrich', '訪問事前通知メール担当', '物件所在地',
    '土（㎡）', '建（㎡）', '築年', '構造', '間取り', '反響日付',
    '査定方法', '査定額1', '査定額2', '査定額3',
    '査定額1（自動計算）v', '査定額2（自動計算）v', '査定額3（自動計算）v',
    '訪問取得日\n年/月/日', '訪問取得日', '訪問日 \nY/M/D', '訪問日',
    '訪問時間', '訪問査定取得者', '査定担当', '確度', '競合名',
    '競合名、理由\n（他決、専任）', '競合名、理由', '専任・他決要因', '訪問メモ', '1番電話'
  ];
  var parts = [];
  for (var i = 0; i < keys.length; i++) {
    parts.push(String(row[keys[i]] !== undefined ? row[keys[i]] : ''));
  }
  return parts.join('|');
}

/**
 * ハッシュを _seller_hashes シートに保存
 */
function saveHashesToSheet_(hashes) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = '_seller_hashes';
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.hideSheet();
  }
  sheet.clearContents();
  var keys = Object.keys(hashes);
  if (keys.length === 0) return;
  var data = keys.map(function(k) { return [k, hashes[k]]; });
  sheet.getRange(1, 1, data.length, 2).setValues(data);
}

/**
 * _seller_hashes シートからハッシュを読み込む
 */
function loadHashesFromSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_seller_hashes');
  if (!sheet) return {};
  var lastRow = sheet.getLastRow();
  if (lastRow === 0) return {};
  var data = sheet.getRange(1, 1, lastRow, 2).getValues();
  var hashes = {};
  for (var i = 0; i < data.length; i++) {
    if (data[i][0]) hashes[String(data[i][0])] = String(data[i][1]);
  }
  return hashes;
}

// ============================================================
// Phase 2: 更新同期
// ============================================================

/**
 * スプレッドシートの差分のみSupabaseに直接PATCH（fetchAll並列化）
 * globalStartTime: syncSellerList() 全体の開始時刻（時間制限の基準）
 */
function syncUpdatesToSupabase_(sheetRows, globalStartTime) {
  Logger.log('📥 Phase 2: スプレッドシート差分検知による更新同期開始...');

  var prevHashes = loadHashesFromSheet_();
  var newHashes = {};

  var changedRows = [];
  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;
    var hash = buildRowHash_(row);
    newHashes[sellerNumber] = hash;
    if (prevHashes[sellerNumber] !== hash) {
      changedRows.push(row);
    }
  }

  Logger.log('📊 変更検知: ' + changedRows.length + '件 / 全' + sheetRows.length + '行');

  if (changedRows.length === 0) {
    saveHashesToSheet_(newHashes);
    Logger.log('✅ 変更なし、スキップ');
    return { updated: 0, errors: 0 };
  }

  function buildUpdateData_(row) {
    var updateData = {};
    updateData.status = row['状況（当社）'] ? String(row['状況（当社）']) : null;
    updateData.next_call_date = formatDateToISO_(row['次電日']);
    var rawVisitAssignee = row['営担'];
    updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    updateData.unreachable_status = row['不通'] ? String(row['不通']) : null;
    updateData.comments = row['コメント'] ? String(row['コメント']) : null;
    updateData.phone_contact_person = row['電話担当（任意）'] ? String(row['電話担当（任意）']) : null;
    updateData.preferred_contact_time = row['連絡取りやすい日、時間帯'] ? String(row['連絡取りやすい日、時間帯']) : null;
    updateData.contact_method = row['連絡方法'] ? String(row['連絡方法']) : null;
    updateData.contract_year_month = formatDateToISO_(row['契約年月 他決は分かった時点']);
    updateData.current_status = row['状況（売主）'] ? String(row['状況（売主）']) : null;
    updateData.pinrich_status = row['Pinrich'] ? String(row['Pinrich']) : null;
    updateData.visit_reminder_assignee = row['訪問事前通知メール担当'] ? String(row['訪問事前通知メール担当']) : null;
    updateData.property_address = row['物件所在地'] ? String(row['物件所在地']) : null;
    updateData.land_area = (row['土（㎡）'] !== '' && row['土（㎡）'] !== undefined && row['土（㎡）'] !== null) ? parseFloat(row['土（㎡）']) : null;
    updateData.building_area = (row['建（㎡）'] !== '' && row['建（㎡）'] !== undefined && row['建（㎡）'] !== null) ? parseFloat(row['建（㎡）']) : null;
    updateData.build_year = (row['築年'] !== '' && row['築年'] !== undefined && row['築年'] !== null) ? parseInt(row['築年'], 10) : null;
    updateData.structure = row['構造'] ? String(row['構造']) : null;
    updateData.floor_plan = row['間取り'] ? String(row['間取り']) : null;
    updateData.inquiry_date = formatDateToISO_(row['反響日付']);
    updateData.valuation_method = row['査定方法'] ? String(row['査定方法']) : null;
    var rawVal1 = (row['査定額1'] !== '' && row['査定額1'] !== undefined && row['査定額1'] !== null) ? row['査定額1'] : (row['査定額1（自動計算）v'] || null);
    var rawVal2 = (row['査定額2'] !== '' && row['査定額2'] !== undefined && row['査定額2'] !== null) ? row['査定額2'] : (row['査定額2（自動計算）v'] || null);
    var rawVal3 = (row['査定額3'] !== '' && row['査定額3'] !== undefined && row['査定額3'] !== null) ? row['査定額3'] : (row['査定額3（自動計算）v'] || null);
    updateData.valuation_amount_1 = (rawVal1 !== null && rawVal1 !== '') ? Math.round(parseFloat(rawVal1) * 10000) : null;
    updateData.valuation_amount_2 = (rawVal2 !== null && rawVal2 !== '') ? Math.round(parseFloat(rawVal2) * 10000) : null;
    updateData.valuation_amount_3 = (rawVal3 !== null && rawVal3 !== '') ? Math.round(parseFloat(rawVal3) * 10000) : null;
    updateData.visit_acquisition_date = formatDateToISO_(row['訪問取得日\n年/月/日'] || row['訪問取得日']);
    updateData.visit_date = formatDateToISO_(row['訪問日 \nY/M/D'] || row['訪問日']);
    updateData.visit_time = row['訪問時間'] ? String(row['訪問時間']) : null;
    updateData.visit_valuation_acquirer = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;
    updateData.valuation_assignee = row['査定担当'] ? String(row['査定担当']) : null;
    updateData.confidence_level = row['確度'] ? String(row['確度']) : null;
    updateData.competitor_name = row['競合名'] ? String(row['競合名']) : null;
    var competitorReason = row['競合名、理由\n（他決、専任）'] || row['競合名、理由'];
    updateData.competitor_name_and_reason = competitorReason ? String(competitorReason) : null;
    updateData.exclusive_other_decision_factor = row['専任・他決要因'] ? String(row['専任・他決要因']) : null;
    updateData.visit_notes = row['訪問メモ'] ? String(row['訪問メモ']) : null;
    var sheetInquiryDate = updateData.inquiry_date;
    if (sheetInquiryDate !== null && sheetInquiryDate >= '2026-03-20') {
      updateData.first_call_person = row['1番電話'] ? String(row['1番電話']) : null;
    }
    updateData.updated_at = new Date().toISOString();
    return updateData;
  }

  var items = changedRows.map(function(row) {
    return { sellerNumber: row['売主番号'], updateData: buildUpdateData_(row) };
  });

  var BATCH_SIZE = 10;
  var baseTime = globalStartTime || new Date();
  var TOTAL_TIME_LIMIT_SEC = 300;
  var updatedCount = 0;
  var errorCount = 0;
  var phaseStartTime = new Date();
  var processedCount = 0; // 処理済みアイテム数を追跡

  for (var start = 0; start < items.length; start += BATCH_SIZE) {
    var elapsed = (new Date() - baseTime) / 1000;
    if (elapsed > TOTAL_TIME_LIMIT_SEC) {
      Logger.log('⏱️ 時間制限に達したため中断 (' + elapsed.toFixed(0) + '秒経過, ' + processedCount + '/' + items.length + '件処理済み)');
      // 未処理分のハッシュを newHashes から削除 → 次回差分ありとして再処理
      for (var ui = start; ui < items.length; ui++) {
        delete newHashes[items[ui].sellerNumber];
      }
      var remainingCount = items.length - processedCount;
      Logger.log('📊 Phase 2中断: 更新 ' + updatedCount + '件 / エラー ' + errorCount + '件 / 残り' + remainingCount + '件（次回同期で再処理） / ' + ((new Date() - phaseStartTime) / 1000).toFixed(1) + '秒');
      saveHashesToSheet_(newHashes);
      return { updated: updatedCount, errors: errorCount };
    }

    var batch = items.slice(start, start + BATCH_SIZE);
    var requests = batch.map(function(item) {
      return {
        url: SUPABASE_CONFIG.URL + '/rest/v1/sellers?seller_number=eq.' + encodeURIComponent(item.sellerNumber),
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_CONFIG.SERVICE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
          'Prefer': 'return=minimal'
        },
        payload: JSON.stringify(item.updateData),
        muteHttpExceptions: true
      };
    });

    var responses;
    try {
      responses = UrlFetchApp.fetchAll(requests);
    } catch (e) {
      Logger.log('❌ fetchAll エラー: ' + e.toString());
      for (var k = 0; k < batch.length; k++) {
        errorCount++;
        processedCount++;
        delete newHashes[batch[k].sellerNumber]; // 失敗分も次回リトライ
      }
      continue;
    }

    for (var j = 0; j < responses.length; j++) {
      var code = responses[j].getResponseCode();
      var sn = batch[j].sellerNumber;
      processedCount++;
      if (code >= 200 && code < 300) {
        updatedCount++;
        Logger.log('✅ ' + sn + ': 更新');
      } else {
        errorCount++;
        delete newHashes[sn]; // 失敗分は次回リトライ
        Logger.log('❌ ' + sn + ': HTTP ' + code);
      }
    }

    if (start + BATCH_SIZE < items.length) {
      Utilities.sleep(200);
    }
  }

  saveHashesToSheet_(newHashes);

  var duration = (new Date() - phaseStartTime) / 1000;
  Logger.log('📊 Phase 2完了: 更新 ' + updatedCount + '件 / エラー ' + errorCount + '件 / ' + duration.toFixed(1) + '秒');
  return { updated: updatedCount, errors: errorCount };
}

// ============================================================
// メイン同期（10分トリガー）
// ============================================================

/**
 * 10分ごとに実行: スプレッドシート全体をSupabaseと直接同期
 * Phase 1（追加）・Phase 3（削除）はバックエンドAPI経由
 * Phase 2（更新）はSupabase直接PATCH（Vercelタイムアウト回避）
 */
function syncSellerList() {
  var startTime = new Date();
  Logger.log('=== 売主リスト同期開始: ' + startTime.toISOString() + ' ===');

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

  // Phase 2: 更新同期（Supabase直接PATCH）
  syncUpdatesToSupabase_(sheetRows, startTime);

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
  Logger.log('所要時間: ' + duration + '秒');
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
    var normalizedHeaders = headers.map(function(h) {
      return String(h).replace(/^[\s\u3000\n\r]+|[\s\u3000\n\r]+$/g, '');
    });
    var sellerNumberColIndex = normalizedHeaders.indexOf('売主番号');
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
// メンテナンス
// ============================================================

/**
 * ハッシュキャッシュをリセット（全件再同期したい場合に手動実行）
 * 実行後の次回 syncSellerList() で全行が差分ありとみなされSupabaseに同期される
 */
function resetRowHashCache() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('_seller_hashes');
  if (sheet) {
    sheet.clearContents();
    Logger.log('✅ ハッシュキャッシュをリセットしました。次回同期で全件再同期されます。');
  } else {
    Logger.log('ℹ️ _seller_hashesシートが存在しません（初回実行前）');
  }
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('seller_row_hashes');
  props.deleteProperty('seller_row_hashes_count');
  for (var i = 0; i < 20; i++) props.deleteProperty('seller_row_hashes_' + i);
}
