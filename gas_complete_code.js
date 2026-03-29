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

// ============================================================
// Supabase直接更新ユーティリティ
// ============================================================

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

function fetchAllSellersFromSupabase_() {
  var allSellers = [];
  var pageSize = 1000;
  var offset = 0;
  var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status,visit_reminder_assignee,property_address,land_area,building_area,build_year,structure,floor_plan,inquiry_date,valuation_method,valuation_amount_1,valuation_amount_2,valuation_amount_3,visit_acquisition_date,visit_date,visit_time,visit_valuation_acquirer,valuation_assignee,confidence_level,competitor_name,competitor_name_and_reason,exclusive_other_decision_factor,visit_notes,first_call_person,exclusion_action';
  while (true) {
    var url = SUPABASE_CONFIG.URL + '/rest/v1/sellers?select=' + fields +
      '&deleted_at=is.null&offset=' + offset + '&limit=' + pageSize;
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

function syncUpdatesToSupabase_(sheetRows) {
  Logger.log('📥 Phase 2: Supabase直接更新同期開始...');
  var dbSellers = fetchAllSellersFromSupabase_();
  if (!dbSellers) {
    Logger.log('❌ Supabaseからのデータ取得失敗');
    return { updated: 0, errors: 0 };
  }
  Logger.log('📊 DB売主数: ' + dbSellers.length);
  var dbMap = {};
  for (var i = 0; i < dbSellers.length; i++) {
    dbMap[dbSellers[i].seller_number] = dbSellers[i];
  }

  // 反響日付の降順（新しい順）にソートして直近の売主を優先処理
  sheetRows.sort(function(a, b) {
    var dateA = formatDateToISO_(a['反響日付']) || '';
    var dateB = formatDateToISO_(b['反響日付']) || '';
    if (dateB > dateA) return 1;
    if (dateB < dateA) return -1;
    return 0;
  });
  Logger.log('📅 反響日付の降順にソート完了');

  var updatedCount = 0;
  var errorCount = 0;
  var phaseStartTime = new Date();

  for (var r = 0; r < sheetRows.length; r++) {
    var row = sheetRows[r];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;
    var dbSeller = dbMap[sellerNumber];
    if (!dbSeller) continue;

    var updateData = {};
    var needsUpdate = false;

    var sheetStatus = row['状況（当社）'] ? String(row['状況（当社）']) : null;
    if (sheetStatus !== (dbSeller.status || null)) { updateData.status = sheetStatus; needsUpdate = true; }

    var sheetNextCallDate = formatDateToISO_(row['次電日']);
    var dbNextCallDate = dbSeller.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
    if (sheetNextCallDate !== dbNextCallDate) { updateData.next_call_date = sheetNextCallDate; needsUpdate = true; }

    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }

    var sheetUnreachable = row['不通'] ? String(row['不通']) : null;
    if (sheetUnreachable !== (dbSeller.unreachable_status || null)) { updateData.unreachable_status = sheetUnreachable; needsUpdate = true; }

    var sheetComments = row['コメント'] ? String(row['コメント']) : null;
    if (sheetComments !== (dbSeller.comments || null)) { updateData.comments = sheetComments; needsUpdate = true; }

    var sheetPhoneContact = row['電話担当（任意）'] ? String(row['電話担当（任意）']) : null;
    if (sheetPhoneContact !== (dbSeller.phone_contact_person || null)) { updateData.phone_contact_person = sheetPhoneContact; needsUpdate = true; }

    var sheetPreferredTime = row['連絡取りやすい日、時間帯'] ? String(row['連絡取りやすい日、時間帯']) : null;
    if (sheetPreferredTime !== (dbSeller.preferred_contact_time || null)) { updateData.preferred_contact_time = sheetPreferredTime; needsUpdate = true; }

    var sheetContactMethod = row['連絡方法'] ? String(row['連絡方法']) : null;
    if (sheetContactMethod !== (dbSeller.contact_method || null)) { updateData.contact_method = sheetContactMethod; needsUpdate = true; }

    var sheetContractYM = formatDateToISO_(row['契約年月 他決は分かった時点']);
    var dbContractYM = dbSeller.contract_year_month ? String(dbSeller.contract_year_month).substring(0, 10) : null;
    if (sheetContractYM !== dbContractYM) { updateData.contract_year_month = sheetContractYM; needsUpdate = true; }

    var sheetCurrentStatus = row['状況（売主）'] ? String(row['状況（売主）']) : null;
    if (sheetCurrentStatus !== (dbSeller.current_status || null)) { updateData.current_status = sheetCurrentStatus; needsUpdate = true; }

    var sheetPinrich = row['Pinrich'] ? String(row['Pinrich']) : null;
    if (sheetPinrich !== (dbSeller.pinrich_status || null)) { updateData.pinrich_status = sheetPinrich; needsUpdate = true; }

    var sheetVisitReminder = row['訪問事前通知メール担当'] ? String(row['訪問事前通知メール担当']) : null;
    if (sheetVisitReminder !== (dbSeller.visit_reminder_assignee || null)) { updateData.visit_reminder_assignee = sheetVisitReminder; needsUpdate = true; }

    var sheetPropertyAddress = row['物件所在地'] ? String(row['物件所在地']) : null;
    if (sheetPropertyAddress !== (dbSeller.property_address || null)) { updateData.property_address = sheetPropertyAddress; needsUpdate = true; }

    var sheetLandArea = (row['土（㎡）'] !== '' && row['土（㎡）'] !== undefined && row['土（㎡）'] !== null) ? parseFloat(row['土（㎡）']) : null;
    var dbLandArea = (dbSeller.land_area !== null && dbSeller.land_area !== undefined) ? parseFloat(dbSeller.land_area) : null;
    if (sheetLandArea !== dbLandArea) { updateData.land_area = sheetLandArea; needsUpdate = true; }

    var sheetBuildingArea = (row['建（㎡）'] !== '' && row['建（㎡）'] !== undefined && row['建（㎡）'] !== null) ? parseFloat(row['建（㎡）']) : null;
    var dbBuildingArea = (dbSeller.building_area !== null && dbSeller.building_area !== undefined) ? parseFloat(dbSeller.building_area) : null;
    if (sheetBuildingArea !== dbBuildingArea) { updateData.building_area = sheetBuildingArea; needsUpdate = true; }

    var sheetBuildYear = (row['築年'] !== '' && row['築年'] !== undefined && row['築年'] !== null) ? parseInt(row['築年'], 10) : null;
    var dbBuildYear = (dbSeller.build_year !== null && dbSeller.build_year !== undefined) ? parseInt(dbSeller.build_year, 10) : null;
    if (sheetBuildYear !== dbBuildYear) { updateData.build_year = sheetBuildYear; needsUpdate = true; }

    var sheetStructure = row['構造'] ? String(row['構造']) : null;
    if (sheetStructure !== (dbSeller.structure || null)) { updateData.structure = sheetStructure; needsUpdate = true; }

    var sheetFloorPlan = row['間取り'] ? String(row['間取り']) : null;
    if (sheetFloorPlan !== (dbSeller.floor_plan || null)) { updateData.floor_plan = sheetFloorPlan; needsUpdate = true; }

    var sheetInquiryDate = formatDateToISO_(row['反響日付']);
    var dbInquiryDate = dbSeller.inquiry_date ? String(dbSeller.inquiry_date).substring(0, 10) : null;
    if (sheetInquiryDate !== dbInquiryDate) { updateData.inquiry_date = sheetInquiryDate; needsUpdate = true; }

    var sheetValuationMethod = row['査定方法'] ? String(row['査定方法']) : null;
    if (sheetValuationMethod !== (dbSeller.valuation_method || null)) { updateData.valuation_method = sheetValuationMethod; needsUpdate = true; }

    var rawVal1 = (row['査定額1'] !== '' && row['査定額1'] !== undefined && row['査定額1'] !== null) ? row['査定額1'] : (row['査定額1（自動計算）v'] || null);
    var rawVal2 = (row['査定額2'] !== '' && row['査定額2'] !== undefined && row['査定額2'] !== null) ? row['査定額2'] : (row['査定額2（自動計算）v'] || null);
    var rawVal3 = (row['査定額3'] !== '' && row['査定額3'] !== undefined && row['査定額3'] !== null) ? row['査定額3'] : (row['査定額3（自動計算）v'] || null);
    var sheetVal1 = (rawVal1 !== null && rawVal1 !== '') ? Math.round(parseFloat(rawVal1) * 10000) : null;
    var sheetVal2 = (rawVal2 !== null && rawVal2 !== '') ? Math.round(parseFloat(rawVal2) * 10000) : null;
    var sheetVal3 = (rawVal3 !== null && rawVal3 !== '') ? Math.round(parseFloat(rawVal3) * 10000) : null;
    var dbVal1 = (dbSeller.valuation_amount_1 !== null && dbSeller.valuation_amount_1 !== undefined) ? parseInt(dbSeller.valuation_amount_1, 10) : null;
    var dbVal2 = (dbSeller.valuation_amount_2 !== null && dbSeller.valuation_amount_2 !== undefined) ? parseInt(dbSeller.valuation_amount_2, 10) : null;
    var dbVal3 = (dbSeller.valuation_amount_3 !== null && dbSeller.valuation_amount_3 !== undefined) ? parseInt(dbSeller.valuation_amount_3, 10) : null;
    if (sheetVal1 !== dbVal1) { updateData.valuation_amount_1 = sheetVal1; needsUpdate = true; }
    if (sheetVal2 !== dbVal2) { updateData.valuation_amount_2 = sheetVal2; needsUpdate = true; }
    if (sheetVal3 !== dbVal3) { updateData.valuation_amount_3 = sheetVal3; needsUpdate = true; }

    var sheetVisitAcqDate = formatDateToISO_(row['訪問取得日\n年/月/日'] || row['訪問取得日']);
    var dbVisitAcqDate = dbSeller.visit_acquisition_date ? String(dbSeller.visit_acquisition_date).substring(0, 10) : null;
    if (sheetVisitAcqDate !== dbVisitAcqDate) { updateData.visit_acquisition_date = sheetVisitAcqDate; needsUpdate = true; }

    var sheetVisitDate = formatDateToISO_(row['訪問日 Y/M/D'] || row['訪問日 \nY/M/D'] || row['訪問日']);
    var dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;
    if (sheetVisitDate !== dbVisitDate) { updateData.visit_date = sheetVisitDate; needsUpdate = true; }

    var sheetVisitTime = row['訪問時間'] ? String(row['訪問時間']) : null;
    if (sheetVisitTime !== (dbSeller.visit_time || null)) { updateData.visit_time = sheetVisitTime; needsUpdate = true; }

    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;
    if (sheetVisitValAcq !== (dbSeller.visit_valuation_acquirer || null)) { updateData.visit_valuation_acquirer = sheetVisitValAcq; needsUpdate = true; }

    var sheetValAssignee = row['査定担当'] ? String(row['査定担当']) : null;
    if (sheetValAssignee !== (dbSeller.valuation_assignee || null)) { updateData.valuation_assignee = sheetValAssignee; needsUpdate = true; }

    var sheetConfidence = row['確度'] ? String(row['確度']) : null;
    if (sheetConfidence !== (dbSeller.confidence_level || null)) { updateData.confidence_level = sheetConfidence; needsUpdate = true; }

    var sheetCompetitor = row['競合名'] ? String(row['競合名']) : null;
    if (sheetCompetitor !== (dbSeller.competitor_name || null)) { updateData.competitor_name = sheetCompetitor; needsUpdate = true; }

    var sheetCompetitorReason = (row['競合名、理由\n（他決、専任）'] || row['競合名、理由']) ? String(row['競合名、理由\n（他決、専任）'] || row['競合名、理由']) : null;
    if (sheetCompetitorReason !== (dbSeller.competitor_name_and_reason || null)) { updateData.competitor_name_and_reason = sheetCompetitorReason; needsUpdate = true; }

    var sheetExclusive = row['専任・他決要因'] ? String(row['専任・他決要因']) : null;
    if (sheetExclusive !== (dbSeller.exclusive_other_decision_factor || null)) { updateData.exclusive_other_decision_factor = sheetExclusive; needsUpdate = true; }

    var sheetVisitNotes = row['訪問メモ'] ? String(row['訪問メモ']) : null;
    if (sheetVisitNotes !== (dbSeller.visit_notes || null)) { updateData.visit_notes = sheetVisitNotes; needsUpdate = true; }

    var sheetFirstCallPerson = row['一番TEL'] ? String(row['一番TEL']) : null;
    var dbFirstCallPerson = dbSeller.first_call_person || null;
    if (sheetFirstCallPerson !== dbFirstCallPerson) {
      updateData.first_call_person = sheetFirstCallPerson;
      needsUpdate = true;
    }

    var sheetExclusionAction = row['除外日にすること'] ? String(row['除外日にすること']) : null;
    var dbExclusionAction = dbSeller.exclusion_action || null;
    if (sheetExclusionAction !== dbExclusionAction) {
      updateData.exclusion_action = sheetExclusionAction;
      needsUpdate = true;
    }

    if (!needsUpdate) continue;
    updateData.updated_at = new Date().toISOString();

    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) {
      updatedCount++;
      Logger.log('✅ ' + sellerNumber + ': 更新 (' + Object.keys(updateData).filter(function(k){ return k !== 'updated_at'; }).join(', ') + ')');
    } else {
      errorCount++;
      Logger.log('❌ ' + sellerNumber + ': 更新失敗 - ' + result.error);
    }

    Utilities.sleep(100);
    var elapsed = (new Date() - phaseStartTime) / 1000;
    if (elapsed > 300) {
      Logger.log('⚠️ 実行時間制限に近づいたため中断 (' + elapsed.toFixed(0) + '秒経過, ' + r + '/' + sheetRows.length + '件処理済み)');
      break;
    }
  }

  Logger.log('📊 Phase 2完了: 更新 ' + updatedCount + '件 / エラー ' + errorCount + '件');
  return { updated: updatedCount, errors: errorCount };
}

// ============================================================
// メイン同期（10分トリガー）
// ============================================================

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

  // Phase 1: 追加同期
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

  // Phase 2: 更新同期
  var updateResult = syncUpdatesToSupabase_(sheetRows);

  // Phase 3: 削除同期
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

  // ★ サイドバーカウントを更新（seller_sidebar_counts テーブルに書き込み）
  updateSidebarCounts_(sheetRows);

  var duration = (new Date() - startTime) / 1000;
  Logger.log('  所要時間: ' + duration + '秒');
  Logger.log('=== 同期完了 ===');
}

// ============================================================
// 即時同期（onEditトリガー）
// ============================================================

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

function testSellerSync() {
  Logger.log('=== テスト同期開始 ===');
  syncSellerList();
  Logger.log('=== テスト同期完了 ===');
}

function syncSellerNow(sellerNumberStr) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');
  if (!sheet) {
    Logger.log('❌ シート「売主リスト」が見つかりません');
    return;
  }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
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

  var updateData = {};
  var sheetNextCallDate = formatDateToISO_(rowObj['次電日']);
  if (sheetNextCallDate !== null) updateData.next_call_date = sheetNextCallDate;
  var sheetStatus = rowObj['状況（当社）'] || '';
  if (sheetStatus) updateData.status = sheetStatus;
  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);
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

function syncAA907() {
  syncSellerNow('AA907');
}


// ============================================================
// サイドバーカウント更新（seller_sidebar_counts テーブルへ書き込み）
// ============================================================

function updateSidebarCounts_(sheetRows) {
  Logger.log('📊 サイドバーカウント更新開始...');
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');

  // 曜日判定（木曜訪問は2日前、それ以外は1日前）
  function isVisitDayBefore(visitDateStr) {
    if (!visitDateStr) return false;
    var visitDate = new Date(visitDateStr);
    visitDate.setHours(0, 0, 0, 0);
    var visitDay = visitDate.getDay(); // 0=日,1=月,...,4=木
    var daysBeforeVisit = (visitDay === 4) ? 2 : 1; // 木曜のみ2日前
    var notifyDate = new Date(visitDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
    return today.getTime() === notifyDate.getTime();
  }

  function isTodayOrBefore(dateStr) {
    if (!dateStr) return false;
    return dateStr <= todayStr;
  }

  function isValidContactValue(v) {
    if (!v) return false;
    var s = String(v).trim();
    return s !== '' && s.toLowerCase() !== 'null' && s.toLowerCase() !== 'undefined';
  }

  function hasContactInfo(row) {
    return isValidContactValue(row['連絡方法']) ||
           isValidContactValue(row['連絡取りやすい日、時間帯']) ||
           isValidContactValue(row['電話担当（任意）']);
  }

  function getContactLabel(row) {
    if (isValidContactValue(row['連絡方法'])) return String(row['連絡方法']).trim();
    if (isValidContactValue(row['連絡取りやすい日、時間帯'])) return String(row['連絡取りやすい日、時間帯']).trim();
    if (isValidContactValue(row['電話担当（任意）'])) return String(row['電話担当（任意）']).trim();
    return '';
  }

  // カウント集計
  var counts = {
    todayCall: 0,
    todayCallWithInfo: {},   // label -> count
    todayCallAssigned: {},   // assignee -> count
    visitDayBefore: 0,
    visitCompleted: {},      // assignee -> count
    unvaluated: 0,
    mailingPending: 0,
    todayCallNotStarted: 0,
    pinrichEmpty: 0
  };

  var cutoffDate = '2025-12-08';
  var cutoffDate2 = '2026-01-01';

  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;

    var status = String(row['状況（当社）'] || '');
    var nextCallDate = formatDateToISO_(row['次電日']);
    var visitAssignee = row['営担'];
    var isVisitAssigneeValid = visitAssignee && visitAssignee !== '外す';
    var visitDateStr = formatDateToISO_(row['訪問日 \nY/M/D'] || row['訪問日']);
    var inquiryDateStr = formatDateToISO_(row['反響日付']);
    var unreachable = row['不通'] ? String(row['不通']) : '';
    var pinrich = row['Pinrich'] ? String(row['Pinrich']) : '';
    var mailingStatus = row['郵送ステータス'] ? String(row['郵送ステータス']) : '';

    // 訪問日前日
    if (isVisitAssigneeValid && visitDateStr && isVisitDayBefore(visitDateStr)) {
      counts.visitDayBefore++;
    }

    // 訪問済み
    if (isVisitAssigneeValid && visitDateStr && visitDateStr < todayStr) {
      var assigneeKey = String(visitAssignee);
      counts.visitCompleted[assigneeKey] = (counts.visitCompleted[assigneeKey] || 0) + 1;
    }

    // 当日TEL系（追客中 + 次電日が今日以前）
    if (status.indexOf('追客中') !== -1 && nextCallDate && isTodayOrBefore(nextCallDate)) {
      if (isVisitAssigneeValid) {
        // 当日TEL（担当）
        var aKey = String(visitAssignee);
        counts.todayCallAssigned[aKey] = (counts.todayCallAssigned[aKey] || 0) + 1;
      } else if (hasContactInfo(row)) {
        // 当日TEL（内容）
        var label = getContactLabel(row);
        if (label) {
          counts.todayCallWithInfo[label] = (counts.todayCallWithInfo[label] || 0) + 1;
        }
      } else {
        // 当日TEL分
        counts.todayCall++;
        // 当日TEL_未着手（不通空欄 + 反響日付2026/1/1以降）
        if (!unreachable && inquiryDateStr && inquiryDateStr >= cutoffDate2) {
          counts.todayCallNotStarted++;
        }
        // Pinrich空欄
        if (!pinrich) {
          counts.pinrichEmpty++;
        }
      }
    }

    // 未査定
    var val1 = row['査定額1'] || row['査定額1（自動計算）v'];
    var val2 = row['査定額2'] || row['査定額2（自動計算）v'];
    var val3 = row['査定額3'] || row['査定額3（自動計算）v'];
    var hasValuation = !!(val1 || val2 || val3);
    var valuationMethod = row['査定方法'] ? String(row['査定方法']) : '';
    var isValuationNotNeeded = valuationMethod === '査定不要';
    // 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
    var confidence = row['確度'] ? String(row['確度']) : '';
    var exclusionDate = row['除外日にすること'] ? String(row['除外日にすること']) : '';
    var isTodayCallNotStarted = (
      status === '追客中' &&
      nextCallDate && isTodayOrBefore(nextCallDate) &&
      !isVisitAssigneeValid &&
      !hasContactInfo(row) &&
      !unreachable &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      !exclusionDate &&
      inquiryDateStr && inquiryDateStr >= cutoffDate2
    );
    if (status.indexOf('追客中') !== -1 &&
        !hasValuation &&
        !isValuationNotNeeded &&
        !isVisitAssigneeValid &&
        inquiryDateStr && inquiryDateStr >= cutoffDate &&
        !isTodayCallNotStarted) {
      counts.unvaluated++;
    }

    // 査定（郵送）
    if (mailingStatus === '未') {
      counts.mailingPending++;
    }
  }

  // seller_sidebar_counts テーブルにUPSERT
  var upsertRows = [];
  var now = new Date().toISOString();

  upsertRows.push({ category: 'todayCall', count: counts.todayCall, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'visitDayBefore', count: counts.visitDayBefore, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'unvaluated', count: counts.unvaluated, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'mailingPending', count: counts.mailingPending, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'todayCallNotStarted', count: counts.todayCallNotStarted, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'pinrichEmpty', count: counts.pinrichEmpty, label: null, assignee: null, updated_at: now });

  for (var assignee in counts.todayCallAssigned) {
    upsertRows.push({ category: 'todayCallAssigned', count: counts.todayCallAssigned[assignee], label: null, assignee: assignee, updated_at: now });
  }
  for (var infoLabel in counts.todayCallWithInfo) {
    upsertRows.push({ category: 'todayCallWithInfo', count: counts.todayCallWithInfo[infoLabel], label: infoLabel, assignee: null, updated_at: now });
  }
  for (var va in counts.visitCompleted) {
    upsertRows.push({ category: 'visitCompleted', count: counts.visitCompleted[va], label: null, assignee: va, updated_at: now });
  }

  // 既存データを全削除してから挿入（シンプルな方式）
  var delUrl = SUPABASE_CONFIG.URL + '/rest/v1/seller_sidebar_counts?category=neq.___never___';
  var delOptions = {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_CONFIG.SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    muteHttpExceptions: true
  };
  UrlFetchApp.fetch(delUrl, delOptions);

  // バッチINSERT（最大500件ずつ）
  var batchSize = 500;
  for (var b = 0; b < upsertRows.length; b += batchSize) {
    var batch = upsertRows.slice(b, b + batchSize);
    var insUrl = SUPABASE_CONFIG.URL + '/rest/v1/seller_sidebar_counts';
    var insOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    };
    var insRes = UrlFetchApp.fetch(insUrl, insOptions);
    var insCode = insRes.getResponseCode();
    if (insCode >= 200 && insCode < 300) {
      Logger.log('✅ seller_sidebar_counts INSERT成功: ' + batch.length + '件');
    } else {
      Logger.log('❌ seller_sidebar_counts INSERT失敗: HTTP ' + insCode + ' / ' + insRes.getContentText().substring(0, 200));
    }
  }

  Logger.log('📊 サイドバーカウント更新完了: 合計 ' + upsertRows.length + '行');
}

// ============================================================
// 手動一括同期: 訪問日 Y/M/D に値がある売主を全件同期
// GASエディタから手動実行してください
// ============================================================

function syncVisitDateSellers() {
  var startTime = new Date();
  Logger.log('=== 訪問日一括同期開始: ' + startTime.toISOString() + ' ===');

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

  // 訪問日 Y/M/D 列のインデックスを取得
  var visitDateColIndex = headers.indexOf('訪問日 Y/M/D');
  if (visitDateColIndex === -1) {
    Logger.log('❌ 「訪問日 Y/M/D」列が見つかりません。ヘッダー一覧: ' + headers.join(', '));
    return;
  }
  Logger.log('✅ 「訪問日 Y/M/D」列: ' + (visitDateColIndex + 1) + '列目');

  // 訪問日がある行のみ抽出
  var visitRows = [];
  for (var i = 0; i < allData.length; i++) {
    var visitDateVal = allData[i][visitDateColIndex];
    if (visitDateVal && visitDateVal !== '') {
      visitRows.push(rowToObject(headers, allData[i]));
    }
  }
  Logger.log('📊 訪問日あり: ' + visitRows.length + '件');

  // 反響日付の降順にソート
  visitRows.sort(function(a, b) {
    var dateA = formatDateToISO_(a['反響日付']) || '';
    var dateB = formatDateToISO_(b['反響日付']) || '';
    if (dateB > dateA) return 1;
    if (dateB < dateA) return -1;
    return 0;
  });

  // Supabaseから全売主を取得
  var dbSellers = fetchAllSellersFromSupabase_();
  if (!dbSellers) {
    Logger.log('❌ Supabaseからのデータ取得失敗');
    return;
  }
  var dbMap = {};
  for (var j = 0; j < dbSellers.length; j++) {
    dbMap[dbSellers[j].seller_number] = dbSellers[j];
  }

  var updatedCount = 0;
  var errorCount = 0;
  var skippedCount = 0;

  for (var r = 0; r < visitRows.length; r++) {
    var row = visitRows[r];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) {
      skippedCount++;
      continue;
    }
    var dbSeller = dbMap[sellerNumber];
    if (!dbSeller) {
      Logger.log('⚠️ ' + sellerNumber + ': DBに存在しない（スキップ）');
      skippedCount++;
      continue;
    }

    var sheetVisitDate = formatDateToISO_(row['訪問日 Y/M/D']);
    var dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;

    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = (rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined) ? null : String(rawVisitAssignee);

    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;
    var sheetVisitAcqDate = formatDateToISO_(row['訪問取得日\n年/月/日'] || row['訪問取得日']);
    var sheetVisitTime = row['訪問時間'] ? String(row['訪問時間']) : null;

    var updateData = {};
    var needsUpdate = false;

    if (sheetVisitDate !== dbVisitDate) { updateData.visit_date = sheetVisitDate; needsUpdate = true; }
    if (sheetVisitAssignee !== (dbSeller.visit_assignee || null)) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    if (sheetVisitValAcq !== (dbSeller.visit_valuation_acquirer || null)) { updateData.visit_valuation_acquirer = sheetVisitValAcq; needsUpdate = true; }
    if (sheetVisitAcqDate !== (dbSeller.visit_acquisition_date ? String(dbSeller.visit_acquisition_date).substring(0, 10) : null)) { updateData.visit_acquisition_date = sheetVisitAcqDate; needsUpdate = true; }
    if (sheetVisitTime !== (dbSeller.visit_time || null)) { updateData.visit_time = sheetVisitTime; needsUpdate = true; }

    if (!needsUpdate) {
      skippedCount++;
      continue;
    }

    updateData.updated_at = new Date().toISOString();
    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) {
      updatedCount++;
      Logger.log('✅ ' + sellerNumber + ': 更新 (' + Object.keys(updateData).filter(function(k){ return k !== 'updated_at'; }).join(', ') + ')');
    } else {
      errorCount++;
      Logger.log('❌ ' + sellerNumber + ': 更新失敗 - ' + result.error);
    }

    Utilities.sleep(50);

    // 実行時間制限チェック（5分）
    var elapsed = (new Date() - startTime) / 1000;
    if (elapsed > 280) {
      Logger.log('⚠️ 実行時間制限に近づいたため中断 (' + r + '/' + visitRows.length + '件処理済み)');
      break;
    }
  }

  Logger.log('=== 訪問日一括同期完了 ===');
  Logger.log('更新: ' + updatedCount + '件 / エラー: ' + errorCount + '件 / スキップ: ' + skippedCount + '件');
  Logger.log('所要時間: ' + ((new Date() - startTime) / 1000).toFixed(1) + '秒');
}
