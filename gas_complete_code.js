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
  // 反響詳細日時は時刻情報が必要なため、Dateオブジェクトをそのまま保持する列
  var datetimeColumns = { '反響詳細日時': true };
  for (var j = 0; j < headers.length; j++) {
    // ヘッダー名を正規化（trim処理）
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else if (datetimeColumns[headerName]) {
        // 日時列はDateオブジェクトをそのまま保持（syncUpdatesToSupabase_でtoISOString()する）
        obj[headerName] = val;
      } else {
        obj[headerName] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    } else {
      // 売主番号は必ず文字列型に変換（数値型のまま保持すると、別のGASで文字列連結バグが発生する）
      if (headerName === '売主番号' && val !== null && val !== undefined && val !== '') {
        obj[headerName] = String(val);
      } else {
        obj[headerName] = val;
      }
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
  
  // 数値（Excelシリアル値）の場合
  if (typeof value === 'number') {
    // Excelのシリアル値を日付に変換（1900年1月1日からの日数）
    var excelEpoch = new Date(1899, 11, 30); // 1899年12月30日
    var days = value > 60 ? value - 1 : value; // Excelの1900年閏年バグ対応
    var date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
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
  var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status,visit_reminder_assignee,property_address,land_area,building_area,build_year,structure,floor_plan,inquiry_date,inquiry_detailed_datetime,valuation_method,valuation_amount_1,valuation_amount_2,valuation_amount_3,visit_acquisition_date,visit_date,visit_time,visit_valuation_acquirer,valuation_assignee,confidence_level,competitor_name,competitor_name_and_reason,exclusive_other_decision_factor,visit_notes,first_call_person,exclusion_action';
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
    var sheetVisitAssignee = rawVisitAssignee ? String(rawVisitAssignee) : null;
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
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
    if (sheetFirstCallPerson !== (dbSeller.first_call_person || null)) { updateData.first_call_person = sheetFirstCallPerson; needsUpdate = true; }
    // 反響詳細日時（inquiry_detailed_datetime）の同期
    var sheetInquiryDetailedDatetime = null;
    var rawDetailedDatetime = row['反響詳細日時'];
    if (rawDetailedDatetime && rawDetailedDatetime !== '') {
      var dtStr = String(rawDetailedDatetime).trim();
      // Dateオブジェクトの場合はISOStringに変換
      if (rawDetailedDatetime instanceof Date) {
        sheetInquiryDetailedDatetime = rawDetailedDatetime.toISOString();
      } else if (dtStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(:\d{2})?$/)) {
        // "YYYY/MM/DD HH:mm" or "YYYY/MM/DD HH:mm:ss" 形式
        var normalized = dtStr.replace(/\//g, '-');
        sheetInquiryDetailedDatetime = new Date(normalized).toISOString();
      } else if (dtStr.match(/^\d{4}-\d{1,2}-\d{1,2}T/)) {
        // すでにISO形式
        sheetInquiryDetailedDatetime = dtStr;
      }
    }
    var dbInquiryDetailedDatetime = dbSeller.inquiry_detailed_datetime ? String(dbSeller.inquiry_detailed_datetime) : null;
    // 秒以下を無視して比較（スプレッドシートは秒精度まで）
    var sheetDtCompare = sheetInquiryDetailedDatetime ? sheetInquiryDetailedDatetime.substring(0, 16) : null;
    var dbDtCompare = dbInquiryDetailedDatetime ? dbInquiryDetailedDatetime.substring(0, 16) : null;
    if (sheetDtCompare !== dbDtCompare) { updateData.inquiry_detailed_datetime = sheetInquiryDetailedDatetime; needsUpdate = true; }
    var sheetExclusionAction = row['除外日にすること'] ? String(row['除外日にすること']) : null;
    if (sheetExclusionAction !== (dbSeller.exclusion_action || null)) { updateData.exclusion_action = sheetExclusionAction; needsUpdate = true; }
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
  if (!sheet) { Logger.log('❌ シート「売主リスト」が見つかりません'); return; }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var sheetRows = [];
  for (var i = 0; i < allData.length; i++) { sheetRows.push(rowToObject(headers, allData[i])); }
  Logger.log('📊 スプレッドシート行数: ' + sheetRows.length);
  try {
    var response = postToBackend('/api/sync/trigger?additionOnly=true', {});
    var statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(response.getContentText());
      Logger.log('✅ 追加同期成功: ' + (result.data ? result.data.added : 0) + '件追加');
    } else {
      Logger.log('⚠️ 追加同期失敗: HTTP ' + statusCode);
    }
  } catch (e) { Logger.log('⚠️ 追加同期エラー: ' + e.toString()); }
  syncUpdatesToSupabase_(sheetRows);
  try {
    var delResponse = postToBackend('/api/sync/trigger?deletionOnly=true', {});
    var delStatusCode = delResponse.getResponseCode();
    if (delStatusCode >= 200 && delStatusCode < 300) {
      var delResult = JSON.parse(delResponse.getContentText());
      Logger.log('✅ 削除同期成功: ' + (delResult.data ? delResult.data.deleted : 0) + '件削除');
    } else {
      Logger.log('❌ 削除同期失敗: HTTP ' + delStatusCode);
    }
  } catch (e) { Logger.log('❌ 削除同期エラー: ' + e.toString()); }
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
    if (sellerNumberColIndex === -1) { Logger.log('⚠️ 売主番号列が見つかりません'); return; }
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
  } catch (e) { Logger.log('❌ onEditTrigger エラー: ' + e.toString()); }
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
  ScriptApp.newTrigger('syncSellerList').timeBased().everyMinutes(SELLER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES).create();
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
  ScriptApp.newTrigger('onEditTrigger').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
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
  if (!sheet) { Logger.log('❌ シート「売主リスト」が見つかりません'); return; }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var sellerNumberCol = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === '売主番号') { sellerNumberCol = i; break; }
  }
  if (sellerNumberCol === -1) { Logger.log('❌ 売主番号列が見つかりません'); return; }
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var targetRow = null;
  for (var r = 0; r < allData.length; r++) {
    if (String(allData[r][sellerNumberCol] || '').trim() === sellerNumberStr) {
      targetRow = allData[r];
      Logger.log('✅ ' + sellerNumberStr + ' を行 ' + (r + 2) + ' で発見');
      break;
    }
  }
  if (!targetRow) { Logger.log('❌ ' + sellerNumberStr + ' が見つかりません'); return; }
  var rowObj = rowToObject(headers, targetRow);
  var updateData = {};
  var sheetNextCallDate = formatDateToISO_(rowObj['次電日']);
  if (sheetNextCallDate !== null) updateData.next_call_date = sheetNextCallDate;
  var sheetStatus = rowObj['状況（当社）'] || '';
  if (sheetStatus) updateData.status = sheetStatus;
  var rawVisitAssignee = rowObj['営担'];
  updateData.visit_assignee = rawVisitAssignee ? String(rawVisitAssignee) : null;
  if (rowObj['コメント']) updateData.comments = String(rowObj['コメント']);
  if (rowObj['不通']) updateData.unreachable_status = String(rowObj['不通']);
  if (rowObj['Pinrich']) updateData.pinrich_status = String(rowObj['Pinrich']);
  var sheetContractYM = formatDateToISO_(rowObj['契約年月 他決は分かった時点']);
  if (sheetContractYM !== null) updateData.contract_year_month = sheetContractYM;
  updateData.updated_at = new Date().toISOString();
  var result = patchSellerToSupabase_(sellerNumberStr, updateData);
  if (result.success) {
    Logger.log('✅ ' + sellerNumberStr + ' Supabase更新成功');
  } else {
    Logger.log('❌ ' + sellerNumberStr + ' Supabase更新失敗: ' + result.error);
  }
}

function syncAA907() { syncSellerNow('AA907'); }
function syncAA13837() { syncSellerNow('AA13837'); }

// AA13837の反響詳細日時をDBに反映する専用関数
function syncAA13837InquiryDatetime() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');
  if (!sheet) { Logger.log('❌ シート「売主リスト」が見つかりません'); return; }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var sheetRows = [];
  for (var i = 0; i < allData.length; i++) {
    var row = rowToObject(headers, allData[i]);
    if (String(row['売主番号'] || '') === 'AA13837') {
      sheetRows.push(row);
      break;
    }
  }
  if (sheetRows.length === 0) { Logger.log('❌ AA13837が見つかりません'); return; }
  Logger.log('✅ AA13837を発見。syncUpdatesToSupabase_で同期します...');
  syncUpdatesToSupabase_(sheetRows);
}

// ============================================================
// AA9484の状態確認（デバッグ用）
// ============================================================
function checkAA9484() {
  Logger.log('=== AA9484の状態確認 ===');
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');
  if (!sheet) { Logger.log('❌ シート「売主リスト」が見つかりません'); return; }
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  // 売主番号と営担の列インデックスを取得
  var sellerNumberColIndex = -1;
  var visitAssigneeColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === '売主番号') sellerNumberColIndex = i;
    if (String(headers[i]).trim() === '営担') visitAssigneeColIndex = i;
  }
  
  if (sellerNumberColIndex === -1 || visitAssigneeColIndex === -1) {
    Logger.log('❌ 必要な列が見つかりません');
    return;
  }
  
  // AA9484を検索
  for (var i = 0; i < allData.length; i++) {
    var sellerNumber = allData[i][sellerNumberColIndex];
    if (String(sellerNumber).trim() === 'AA9484') {
      var visitAssignee = allData[i][visitAssigneeColIndex];
      Logger.log('✅ AA9484を発見（行 ' + (i + 2) + '）');
      Logger.log('   営担の値: "' + visitAssignee + '"');
      Logger.log('   型: ' + typeof visitAssignee);
      Logger.log('   空かどうか: ' + (visitAssignee === '' || visitAssignee === null || visitAssignee === undefined));
      Logger.log('   「外す」かどうか: ' + (String(visitAssignee).trim() === '外す'));
      return;
    }
  }
  
  Logger.log('❌ AA9484が見つかりません');
}

// ============================================================
// 営業担当が「外す」の売主を一括同期
// ============================================================
function syncVisitAssigneeRemove() {
  Logger.log('=== 営業担当「外す」一括同期開始 ===');
  var startTime = new Date();
  
  // スプレッドシートから全データを取得
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');
  if (!sheet) { Logger.log('❌ シート「売主リスト」が見つかりません'); return; }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  // 営担列のインデックスを取得
  var visitAssigneeColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === '営担') {
      visitAssigneeColIndex = i;
      break;
    }
  }
  if (visitAssigneeColIndex === -1) {
    Logger.log('❌ 営担列が見つかりません');
    return;
  }
  
  // 営担が「外す」の売主を抽出
  var targetRows = [];
  for (var i = 0; i < allData.length; i++) {
    var row = rowToObject(headers, allData[i]);
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;
    
    var visitAssignee = allData[i][visitAssigneeColIndex];
    if (visitAssignee && String(visitAssignee).trim() === '外す') {
      targetRows.push(row);
      Logger.log('📝 対象: ' + sellerNumber + ' (営担=外す)');
    }
  }
  
  Logger.log('📊 営担「外す」の売主数: ' + targetRows.length + '件');
  
  if (targetRows.length === 0) {
    Logger.log('✅ 同期対象なし');
    return;
  }
  
  // DBから全売主を取得
  var dbSellers = fetchAllSellersFromSupabase_();
  if (!dbSellers) {
    Logger.log('❌ Supabaseからのデータ取得失敗');
    return;
  }
  
  var dbMap = {};
  for (var i = 0; i < dbSellers.length; i++) {
    dbMap[dbSellers[i].seller_number] = dbSellers[i];
  }
  
  // 同期処理
  var updatedCount = 0;
  var skippedCount = 0;
  var errorCount = 0;
  
  for (var i = 0; i < targetRows.length; i++) {
    var row = targetRows[i];
    var sellerNumber = row['売主番号'];
    var dbSeller = dbMap[sellerNumber];
    
    if (!dbSeller) {
      Logger.log('⚠️ ' + sellerNumber + ': DBに存在しません（スキップ）');
      skippedCount++;
      continue;
    }
    
    // DBの営担が既に「外す」の場合はスキップ
    if (dbSeller.visit_assignee === '外す') {
      Logger.log('⏭️ ' + sellerNumber + ': 既に「外す」（スキップ）');
      skippedCount++;
      continue;
    }
    
    // 営担を「外す」に更新
    var updateData = {
      visit_assignee: '外す',
      updated_at: new Date().toISOString()
    };
    
    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) {
      updatedCount++;
      Logger.log('✅ ' + sellerNumber + ': 営担を「外す」に更新（旧値: ' + (dbSeller.visit_assignee || 'null') + '）');
    } else {
      errorCount++;
      Logger.log('❌ ' + sellerNumber + ': 更新失敗 - ' + result.error);
    }
    
    Utilities.sleep(100); // API制限対策
  }
  
  var duration = (new Date() - startTime) / 1000;
  Logger.log('📊 同期完了: 更新 ' + updatedCount + '件 / スキップ ' + skippedCount + '件 / エラー ' + errorCount + '件');
  Logger.log('⏱️ 所要時間: ' + duration.toFixed(1) + '秒');
  Logger.log('=== 営業担当「外す」一括同期完了 ===');
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

  function isVisitDayBefore(visitDateStr) {
    if (!visitDateStr) return false;
    var visitDate = new Date(visitDateStr);
    visitDate.setHours(0, 0, 0, 0);
    var visitDay = visitDate.getDay();
    var daysBeforeVisit = (visitDay === 4) ? 2 : 1;
    var notifyDate = new Date(visitDate);
    notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
    return today.getTime() === notifyDate.getTime();
  }
  function isTodayOrBefore(dateStr) { if (!dateStr) return false; return dateStr <= todayStr; }
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
    var parts = [];
    if (isValidContactValue(row['電話担当（任意）'])) parts.push(String(row['電話担当（任意）']).trim());
    if (isValidContactValue(row['連絡取りやすい日、時間帯'])) parts.push(String(row['連絡取りやすい日、時間帯']).trim());
    if (isValidContactValue(row['連絡方法'])) parts.push(String(row['連絡方法']).trim());
    return parts.join('・');
  }

  var counts = {
    todayCall: 0, todayCallWithInfo: {}, todayCallAssigned: {},
    visitDayBefore: 0, visitCompleted: {}, visitAssigned: {}, unvaluated: 0,
    mailingPending: 0, todayCallNotStarted: 0, pinrichEmpty: 0,
    exclusive: 0, general: 0, visitOtherDecision: 0, unvisitedOtherDecision: 0
  };
  var cutoffDate = '2025-12-08';
  var cutoffDate2 = '2026-01-01';
  var generalCutoffDate = '2025-06-23';

  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;
    var status = String(row['状況（当社）'] || '');
    var nextCallDate = formatDateToISO_(row['次電日']);
    var visitAssignee = row['営担'];
    var isVisitAssigneeValid = visitAssignee && visitAssignee !== '';  // 「外す」を有効な値として扱う
    var visitDateStr = formatDateToISO_(row['訪問日 \nY/M/D'] || row['訪問日']);
    var inquiryDateStr = formatDateToISO_(row['反響日付']);
    var unreachable = row['不通'] ? String(row['不通']) : '';
    var pinrich = row['Pinrich'] ? String(row['Pinrich']) : '';
    var mailingStatus = row['郵送ステータス'] ? String(row['郵送ステータス']) : '';

    if (isVisitAssigneeValid && visitDateStr && isVisitDayBefore(visitDateStr)) { counts.visitDayBefore++; }
    if (isVisitAssigneeValid && visitDateStr && visitDateStr < todayStr) {
      var assigneeKey = String(visitAssignee);
      counts.visitCompleted[assigneeKey] = (counts.visitCompleted[assigneeKey] || 0) + 1;
    }
    // 営担がいる全売主をカウント（担当(Y)などの親カテゴリ用）
    // 一般媒介・専任媒介・追客不要・他社買取は除外
    if (isVisitAssigneeValid && status.indexOf('一般媒介') === -1 && status.indexOf('専任媒介') === -1 && status.indexOf('追客不要') === -1 && status.indexOf('他社買取') === -1) {
      var vaKey = String(visitAssignee);
      counts.visitAssigned[vaKey] = (counts.visitAssigned[vaKey] || 0) + 1;
    }
    if (status.indexOf('追客中') !== -1 && nextCallDate && isTodayOrBefore(nextCallDate)) {
      if (isVisitAssigneeValid) {
        var aKey = String(visitAssignee);
        counts.todayCallAssigned[aKey] = (counts.todayCallAssigned[aKey] || 0) + 1;
      } else if (hasContactInfo(row)) {
        var label = getContactLabel(row);
        if (label) { counts.todayCallWithInfo[label] = (counts.todayCallWithInfo[label] || 0) + 1; }
      } else {
        counts.todayCall++;
        if (!unreachable && inquiryDateStr && inquiryDateStr >= cutoffDate2) { counts.todayCallNotStarted++; }
        if (!pinrich) { counts.pinrichEmpty++; }
      }
    }
    var val1 = row['査定額1'] || row['査定額1（自動計算）v'];
    var val2 = row['査定額2'] || row['査定額2（自動計算）v'];
    var val3 = row['査定額3'] || row['査定額3（自動計算）v'];
    var hasValuation = !!(val1 || val2 || val3);
    var valuationMethod = row['査定方法'] ? String(row['査定方法']) : '';
    var isValuationNotNeeded = valuationMethod === '査定不要';
    var confidence = row['確度'] ? String(row['確度']) : '';
    var exclusionDate = row['除外日にすること'] ? String(row['除外日にすること']) : '';
    var isTodayCallNotStarted = (status === '追客中' && nextCallDate && isTodayOrBefore(nextCallDate) &&
      !isVisitAssigneeValid && !hasContactInfo(row) && !unreachable &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      !exclusionDate && inquiryDateStr && inquiryDateStr >= cutoffDate2);
    if (status.indexOf('追客中') !== -1 && !hasValuation && !isValuationNotNeeded &&
      !isVisitAssigneeValid && inquiryDateStr && inquiryDateStr >= cutoffDate && !isTodayCallNotStarted) {
      counts.unvaluated++;
    }
    if (mailingStatus === '未') { counts.mailingPending++; }

    // 専任他決打合せカテゴリ（3つの新カテゴリ）
    var exclusiveOtherDecisionMeeting = row['専任他決打合せ'] ? String(row['専任他決打合せ']) : '';
    var contractYearMonth = formatDateToISO_(row['契約年月 他決は分かった時点']);

    // 専任カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("専任媒介", "他決→専任", "リースバック（専任）")
    if (exclusiveOtherDecisionMeeting !== '完了' &&
        (!nextCallDate || nextCallDate !== todayStr) &&
        (status === '専任媒介' || status === '他決→専任' || status === 'リースバック（専任）')) {
      counts.exclusive++;
    }

    // 一般カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） = "一般媒介" AND 契約年月 >= "2025-06-23"
    if (exclusiveOtherDecisionMeeting !== '完了' &&
        (!nextCallDate || nextCallDate !== todayStr) &&
        status === '一般媒介' &&
        contractYearMonth && contractYearMonth >= generalCutoffDate) {
      counts.general++;
    }

    // 訪問後他決カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND 営担 ≠ ""
    if (exclusiveOtherDecisionMeeting !== '完了' &&
        (!nextCallDate || nextCallDate !== todayStr) &&
        (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
        isVisitAssigneeValid) {
      counts.visitOtherDecision++;
    }

    // 未訪問他決カテゴリ: 専任他決打合せ ≠ "完了" AND 次電日 ≠ 今日 AND 状況（当社） IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取") AND 営担 = ""
    if (exclusiveOtherDecisionMeeting !== '完了' &&
        (!nextCallDate || nextCallDate !== todayStr) &&
        (status === '他決→追客' || status === '他決→追客不要' || status === '一般→他決' || status === '他社買取') &&
        !isVisitAssigneeValid) {
      counts.unvisitedOtherDecision++;
    }
  }

  var upsertRows = [];
  var now = new Date().toISOString();
  upsertRows.push({ category: 'todayCall', count: counts.todayCall, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'visitDayBefore', count: counts.visitDayBefore, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'unvaluated', count: counts.unvaluated, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'mailingPending', count: counts.mailingPending, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'todayCallNotStarted', count: counts.todayCallNotStarted, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'pinrichEmpty', count: counts.pinrichEmpty, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'exclusive', count: counts.exclusive, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'general', count: counts.general, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'visitOtherDecision', count: counts.visitOtherDecision, label: null, assignee: null, updated_at: now });
  upsertRows.push({ category: 'unvisitedOtherDecision', count: counts.unvisitedOtherDecision, label: null, assignee: null, updated_at: now });
  for (var assignee in counts.todayCallAssigned) {
    upsertRows.push({ category: 'todayCallAssigned', count: counts.todayCallAssigned[assignee], label: null, assignee: assignee, updated_at: now });
  }
  for (var infoLabel in counts.todayCallWithInfo) {
    upsertRows.push({ category: 'todayCallWithInfo', count: counts.todayCallWithInfo[infoLabel], label: infoLabel, assignee: null, updated_at: now });
  }
  for (var va in counts.visitCompleted) {
    upsertRows.push({ category: 'visitCompleted', count: counts.visitCompleted[va], label: null, assignee: va, updated_at: now });
  }
  for (var vas in counts.visitAssigned) {
    upsertRows.push({ category: 'visitAssigned', count: counts.visitAssigned[vas], label: null, assignee: vas, updated_at: now });
  }

  var delUrl = SUPABASE_CONFIG.URL + '/rest/v1/seller_sidebar_counts?category=neq.___never___';
  UrlFetchApp.fetch(delUrl, {
    method: 'DELETE',
    headers: { 'apikey': SUPABASE_CONFIG.SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY, 'Prefer': 'return=minimal' },
    muteHttpExceptions: true
  });

  var batchSize = 500;
  for (var b = 0; b < upsertRows.length; b += batchSize) {
    var batch = upsertRows.slice(b, b + batchSize);
    var insRes = UrlFetchApp.fetch(SUPABASE_CONFIG.URL + '/rest/v1/seller_sidebar_counts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPABASE_CONFIG.SERVICE_KEY, 'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY, 'Prefer': 'return=minimal' },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    });
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
// ============================================================
function syncVisitDateSellers() {
  var startTime = new Date();
  Logger.log('=== 訪問日一括同期開始: ' + startTime.toISOString() + ' ===');
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  if (!sheet) { Logger.log('❌ シート「売主リスト」が見つかりません'); return; }
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var visitDateColIndex = headers.indexOf('訪問日 Y/M/D');
  if (visitDateColIndex === -1) { Logger.log('❌ 「訪問日 Y/M/D」列が見つかりません'); return; }
  var visitRows = [];
  for (var i = 0; i < allData.length; i++) {
    if (allData[i][visitDateColIndex] && allData[i][visitDateColIndex] !== '') {
      visitRows.push(rowToObject(headers, allData[i]));
    }
  }
  Logger.log('📊 訪問日あり: ' + visitRows.length + '件');
  visitRows.sort(function(a, b) {
    var dateA = formatDateToISO_(a['反響日付']) || '';
    var dateB = formatDateToISO_(b['反響日付']) || '';
    if (dateB > dateA) return 1; if (dateB < dateA) return -1; return 0;
  });
  var dbSellers = fetchAllSellersFromSupabase_();
  if (!dbSellers) { Logger.log('❌ Supabaseからのデータ取得失敗'); return; }
  var dbMap = {};
  for (var j = 0; j < dbSellers.length; j++) { dbMap[dbSellers[j].seller_number] = dbSellers[j]; }
  var updatedCount = 0, errorCount = 0, skippedCount = 0;
  for (var r = 0; r < visitRows.length; r++) {
    var row = visitRows[r];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) { skippedCount++; continue; }
    var dbSeller = dbMap[sellerNumber];
    if (!dbSeller) { skippedCount++; continue; }
    var updateData = {};
    var needsUpdate = false;
    var sheetVisitDate = formatDateToISO_(row['訪問日 Y/M/D']);
    var dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;
    if (sheetVisitDate !== dbVisitDate) { updateData.visit_date = sheetVisitDate; needsUpdate = true; }
    var rawVisitAssignee = row['営担'];
    var sheetVisitAssignee = rawVisitAssignee ? String(rawVisitAssignee) : null;
    var dbVisitAssignee = dbSeller.visit_assignee || null;
    if (sheetVisitAssignee !== dbVisitAssignee) { updateData.visit_assignee = sheetVisitAssignee; needsUpdate = true; }
    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;
    if (sheetVisitValAcq !== (dbSeller.visit_valuation_acquirer || null)) { updateData.visit_valuation_acquirer = sheetVisitValAcq; needsUpdate = true; }
    var sheetVisitAcqDate = formatDateToISO_(row['訪問取得日\n年/月/日'] || row['訪問取得日']);
    if (sheetVisitAcqDate !== (dbSeller.visit_acquisition_date ? String(dbSeller.visit_acquisition_date).substring(0, 10) : null)) { updateData.visit_acquisition_date = sheetVisitAcqDate; needsUpdate = true; }
    var sheetVisitTime = row['訪問時間'] ? String(row['訪問時間']) : null;
    if (sheetVisitTime !== (dbSeller.visit_time || null)) { updateData.visit_time = sheetVisitTime; needsUpdate = true; }
    if (!needsUpdate) { skippedCount++; continue; }
    updateData.updated_at = new Date().toISOString();
    var result = patchSellerToSupabase_(sellerNumber, updateData);
    if (result.success) { updatedCount++; Logger.log('✅ ' + sellerNumber + ': 更新'); }
    else { errorCount++; Logger.log('❌ ' + sellerNumber + ': 更新失敗 - ' + result.error); }
    Utilities.sleep(50);
    if ((new Date() - startTime) / 1000 > 280) { Logger.log('⚠️ 実行時間制限に近づいたため中断'); break; }
  }
  Logger.log('=== 訪問日一括同期完了 ===');
  Logger.log('更新: ' + updatedCount + '件 / エラー: ' + errorCount + '件 / スキップ: ' + skippedCount + '件');
}

// ============================================================
// 2026/1/1以降の売主のメール送信確認フィールドを一括同期
// GASエディタから手動実行する → 関数名: bulkSyncAssigneeFieldsFrom2026
// ============================================================
function bulkSyncAssigneeFieldsFrom2026() {
  var API_BASE = 'https://sateituikyaku-admin-backend.vercel.app';
  var CRON_SECRET = 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s='; // ← 正しい値（小文字のl）
  var FROM_DATE = '2026-01-01';

  // Step 1: 対象売主番号リストを取得
  var listRes = UrlFetchApp.fetch(
    API_BASE + '/api/sync/sellers-by-inquiry-date?from=' + FROM_DATE,
    { headers: { 'Authorization': 'Bearer ' + CRON_SECRET }, muteHttpExceptions: true }
  );
  var listData = JSON.parse(listRes.getContentText());
  if (!listData.success) {
    Logger.log('リスト取得失敗: ' + listData.error);
    return;
  }
  var sellerNumbers = listData.sellerNumbers;
  Logger.log('対象: ' + sellerNumbers.length + '件');

  // Step 2: スプレッドシートから全行データを取得
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var sellerNumIdx = headers.indexOf('売主番号');

  // 対象売主番号をオブジェクトに（GASはSetが使えない場合があるため）
  var targetMap = {};
  for (var t = 0; t < sellerNumbers.length; t++) { targetMap[sellerNumbers[t]] = true; }

  // Step 3: 対象行を1件ずつ seller-row APIに送信
  var success = 0, failed = 0;
  for (var i = 1; i < data.length; i++) {
    var sellerNumber = data[i][sellerNumIdx];
    if (!targetMap[sellerNumber]) continue;

    var row = {};
    for (var h = 0; h < headers.length; h++) {
      if (headers[h] !== '') row[headers[h]] = data[i][h];
    }

    var res = UrlFetchApp.fetch(API_BASE + '/api/sync/seller-row', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(row),
      headers: { 'Authorization': 'Bearer ' + CRON_SECRET },
      muteHttpExceptions: true
    });
    var result = JSON.parse(res.getContentText());
    if (result.success) {
      success++;
    } else {
      failed++;
      Logger.log('失敗: ' + sellerNumber + ' - ' + result.error);
    }
    Utilities.sleep(100);
  }
  Logger.log('完了: 成功=' + success + '件, 失敗=' + failed + '件');
}
