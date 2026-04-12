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
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      return { success: false, error: 'HTTP ' + code + ': ' + res.getContentText().substring(0, 300) };
    }
  } catch (e) {
    // ネットワークエラー（Address unavailable等）は失敗として返し、ループを継続させる
    return { success: false, error: 'Network error: ' + e.toString() };
  }
}

/**
 * 行データのハッシュ文字列を生成（差分検知用）
 * Supabaseへの全件取得を廃止し、スプレッドシート側の変更のみ検知する
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
 * Phase 2: スプレッドシートの差分のみSupabaseに直接PATCH
 * Supabase全件取得を廃止 → UrlFetch消費を大幅削減
 * 前回同期時のハッシュをPropertiesServiceに保存し、変更行のみ更新する
 */
function syncUpdatesToSupabase_(sheetRows) {
  Logger.log('📥 Phase 2: スプレッドシート差分検知による更新同期開始...');

  var props = PropertiesService.getScriptProperties();
  var hashKey = 'seller_row_hashes';
  var storedJson = props.getProperty(hashKey);
  var prevHashes = storedJson ? JSON.parse(storedJson) : {};
  var newHashes = {};

  // 変更があった行を抽出
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
    // ハッシュを保存して終了
    props.setProperty(hashKey, JSON.stringify(newHashes));
    Logger.log('✅ 変更なし、スキップ');
    return { updated: 0, errors: 0 };
  }

  var updatedCount = 0;
  var errorCount = 0;
  var phaseStartTime = new Date();

  // 変更行のみSupabaseにPATCH（Supabase全件取得不要）
  for (var r = 0; r < changedRows.length; r++) {
    var row = changedRows[r];
    var sellerNumber = row['売主番号'];

    // 全フィールドをスプレッドシートの値でそのまま上書き（差分はハッシュ比較済み）
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

    // 査定額（手動入力優先、万円→円変換）
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

    // first_call_person（1番電話）: 反響日付が2026/3/20以降の売主のみ同期
    var sheetInquiryDate = updateData.inquiry_date;
    var firstCallPersonCutoff = '2026-03-20';
    if (sheetInquiryDate !== null && sheetInquiryDate >= firstCallPersonCutoff) {
      updateData.first_call_person = row['1番電話'] ? String(row['1番電話']) : null;
    }

    updateData.updated_at = new Date().toISOString();

    // Supabaseに直接PATCH
    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) {
      updatedCount++;
      Logger.log('✅ ' + sellerNumber + ': 更新');
    } else {
      errorCount++;
      Logger.log('❌ ' + sellerNumber + ': 更新失敗 - ' + result.error);
      // 失敗した行はハッシュを更新しない（次回リトライ）
      newHashes[sellerNumber] = prevHashes[sellerNumber] || '';
    }

    // 更新した行だけ待機（帯域制限対策）
    Utilities.sleep(100);

    // 実行時間チェック: 5分（300秒）を超えたら安全に終了
    var elapsed = (new Date() - phaseStartTime) / 1000;
    if (elapsed > 300) {
      Logger.log('⚠️ 実行時間制限に近づいたため中断 (' + elapsed.toFixed(0) + '秒経過, ' + r + '/' + changedRows.length + '件処理済み)');
      break;
    }
  }

  // 成功分のハッシュを保存（次回の差分検知に使用）
  props.setProperty(hashKey, JSON.stringify(newHashes));

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



/**
 * 一括バックフィル: 状況（当社）に「追客中」を含む売主のみ全フィールドを強制同期
 * 過去データの一括同期用（差分チェックなし、全フィールドを上書き）
 * GASエディタから手動で実行してください
 */
function bulkSyncActiveSellersFull() {
  var startTime = new Date();
  Logger.log('=== 追客中売主 一括フルバックフィル開始: ' + startTime.toISOString() + ' ===');

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

  // 「追客中」を含む行のみ抽出
  var targetRows = [];
  for (var i = 0; i < allData.length; i++) {
    var rowObj = rowToObject(headers, allData[i]);
    var sellerNumber = rowObj['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;
    var status = String(rowObj['状況（当社）'] || '');
    if (status.indexOf('追客中') === -1) continue;
    targetRows.push(rowObj);
  }
  Logger.log('📊 対象件数（追客中）: ' + targetRows.length + '件');

  var successCount = 0;
  var errorCount = 0;
  var skipCount = 0;

  for (var r = 0; r < targetRows.length; r++) {
    var row = targetRows[r];
    var sellerNumber = row['売主番号'];

    // 全フィールドを強制的にupdateDataに詰める（差分チェックなし）
    var updateData = {};

    // テキスト系
    if (row['状況（当社）']) updateData.status = String(row['状況（当社）']);
    if (row['状況（売主）']) updateData.current_status = String(row['状況（売主）']);
    if (row['不通']) updateData.unreachable_status = String(row['不通']);
    if (row['コメント']) updateData.comments = String(row['コメント']);
    if (row['Pinrich']) updateData.pinrich_status = String(row['Pinrich']);
    if (row['訪問事前通知メール担当']) updateData.visit_reminder_assignee = String(row['訪問事前通知メール担当']);
    if (row['物件所在地']) updateData.property_address = String(row['物件所在地']);
    if (row['構造']) updateData.structure = String(row['構造']);
    if (row['間取り']) updateData.floor_plan = String(row['間取り']);
    if (row['査定方法']) updateData.valuation_method = String(row['査定方法']);
    if (row['訪問時間']) updateData.visit_time = String(row['訪問時間']);
    if (row['訪問査定取得者']) updateData.visit_valuation_acquirer = String(row['訪問査定取得者']);
    if (row['査定担当']) updateData.valuation_assignee = String(row['査定担当']);
    if (row['確度']) updateData.confidence_level = String(row['確度']);
    if (row['競合名']) updateData.competitor_name = String(row['競合名']);
    if (row['専任・他決要因']) updateData.exclusive_other_decision_factor = String(row['専任・他決要因']);
    if (row['訪問メモ']) updateData.visit_notes = String(row['訪問メモ']);
    if (row['1番電話']) updateData.first_call_person = String(row['1番電話']);
    if (row['電話担当（任意）']) updateData.phone_contact_person = String(row['電話担当（任意）']);
    if (row['連絡取りやすい日、時間帯']) updateData.preferred_contact_time = String(row['連絡取りやすい日、時間帯']);
    if (row['連絡方法']) updateData.contact_method = String(row['連絡方法']);

    // 競合名・理由（改行含むキー対応）
    var competitorReason = row['競合名、理由\n（他決、専任）'] || row['競合名、理由'];
    if (competitorReason) updateData.competitor_name_and_reason = String(competitorReason);

    // 営担（「外す」または空欄 → null）
    var rawVisitAssignee = row['営担'];
    updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);

    // 日付系
    var nextCallDate = formatDateToISO_(row['次電日']);
    if (nextCallDate !== null) updateData.next_call_date = nextCallDate;

    var contractYM = formatDateToISO_(row['契約年月 他決は分かった時点']);
    if (contractYM !== null) updateData.contract_year_month = contractYM;

    var inquiryDate = formatDateToISO_(row['反響日付']);
    if (inquiryDate !== null) updateData.inquiry_date = inquiryDate;

    var visitAcqDate = formatDateToISO_(row['訪問取得日\n年/月/日'] || row['訪問取得日']);
    if (visitAcqDate !== null) updateData.visit_acquisition_date = visitAcqDate;

    var visitDate = formatDateToISO_(row['訪問日 \nY/M/D'] || row['訪問日']);
    if (visitDate !== null) updateData.visit_date = visitDate;

    // 数値系
    var landArea = row['土（㎡）'];
    if (landArea !== '' && landArea !== undefined && landArea !== null) updateData.land_area = parseFloat(landArea);

    var buildingArea = row['建（㎡）'];
    if (buildingArea !== '' && buildingArea !== undefined && buildingArea !== null) updateData.building_area = parseFloat(buildingArea);

    var buildYear = row['築年'];
    if (buildYear !== '' && buildYear !== undefined && buildYear !== null) updateData.build_year = parseInt(buildYear, 10);

    // 査定額（手動入力優先、万円→円変換）
    var rawVal1 = row['査定額1'] !== '' && row['査定額1'] !== undefined && row['査定額1'] !== null ? row['査定額1'] : (row['査定額1（自動計算）v'] || null);
    var rawVal2 = row['査定額2'] !== '' && row['査定額2'] !== undefined && row['査定額2'] !== null ? row['査定額2'] : (row['査定額2（自動計算）v'] || null);
    var rawVal3 = row['査定額3'] !== '' && row['査定額3'] !== undefined && row['査定額3'] !== null ? row['査定額3'] : (row['査定額3（自動計算）v'] || null);
    if (rawVal1 !== null && rawVal1 !== '') updateData.valuation_amount_1 = Math.round(parseFloat(rawVal1) * 10000);
    if (rawVal2 !== null && rawVal2 !== '') updateData.valuation_amount_2 = Math.round(parseFloat(rawVal2) * 10000);
    if (rawVal3 !== null && rawVal3 !== '') updateData.valuation_amount_3 = Math.round(parseFloat(rawVal3) * 10000);

    if (Object.keys(updateData).length === 0) {
      skipCount++;
      continue;
    }

    updateData.updated_at = new Date().toISOString();

    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) {
      successCount++;
      if (successCount % 50 === 0) {
        Logger.log('⏳ 進捗: ' + successCount + '/' + targetRows.length + ' 完了');
      }
    } else {
      errorCount++;
      Logger.log('❌ ' + sellerNumber + ': 失敗 - ' + result.error);
    }

    Utilities.sleep(150);
  }

  var duration = (new Date() - startTime) / 1000;
  Logger.log('=== 完了: 成功 ' + successCount + '件 / 失敗 ' + errorCount + '件 / スキップ ' + skipCount + '件 / 所要時間 ' + duration + '秒 ===');
}

/**
 * AA907を手動で即時同期（引数なしで実行可能）
 */
function syncAA907() {
  syncSellerNow('AA907');
}

/**
 * ハッシュキャッシュをリセット（全件再同期したい場合に手動実行）
 * 実行後の次回syncSellerList()で全行が差分ありとみなされSupabaseに同期される
 */
function resetRowHashCache() {
  PropertiesService.getScriptProperties().deleteProperty('seller_row_hashes');
  Logger.log('✅ ハッシュキャッシュをリセットしました。次回同期で全件再同期されます。');
}
