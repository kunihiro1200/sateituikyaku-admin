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
  var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status,visit_reminder_assignee,property_address,land_area,building_area,build_year,structure,floor_plan,inquiry_date,valuation_method,valuation_amount_1,valuation_amount_2,valuation_amount_3,visit_acquisition_date,visit_date,visit_time,visit_valuation_acquirer,valuation_assignee,confidence_level,competitor_name,competitor_name_and_reason,exclusive_other_decision_factor,visit_notes,first_call_person';

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
  var phaseStartTime = new Date();

  for (var r = 0; r < sheetRows.length; r++) {
    var row = sheetRows[r];
    var sellerNumber = row['売主番号'];
    if (!sellerNumber || typeof sellerNumber !== 'string' || !sellerNumber.match(/^AA\d+$/)) continue;

    var dbSeller = dbMap[sellerNumber];
    if (!dbSeller) continue; // DBにない売主はPhase 1（追加）で対応

    // 差分チェックと更新データ構築
    var updateData = {};
    var needsUpdate = false;

    // status（空欄の場合はnullでクリア）
    var sheetStatus = row['状況（当社）'] ? String(row['状況（当社）']) : null;
    var dbStatus = dbSeller.status || null;
    if (sheetStatus !== dbStatus) {
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

    // visit_reminder_assignee（訪問事前通知メール担当）
    var sheetVisitReminder = row['訪問事前通知メール担当'] ? String(row['訪問事前通知メール担当']) : null;
    var dbVisitReminder = dbSeller.visit_reminder_assignee || null;
    if (sheetVisitReminder !== dbVisitReminder) {
      updateData.visit_reminder_assignee = sheetVisitReminder;
      needsUpdate = true;
    }

    // property_address（物件所在地）
    var sheetPropertyAddress = row['物件所在地'] ? String(row['物件所在地']) : null;
    var dbPropertyAddress = dbSeller.property_address || null;
    if (sheetPropertyAddress !== dbPropertyAddress) {
      updateData.property_address = sheetPropertyAddress;
      needsUpdate = true;
    }

    // land_area（土㎡）
    var sheetLandArea = row['土（㎡）'] !== '' && row['土（㎡）'] !== undefined && row['土（㎡）'] !== null ? parseFloat(row['土（㎡）']) : null;
    var dbLandArea = dbSeller.land_area !== null && dbSeller.land_area !== undefined ? parseFloat(dbSeller.land_area) : null;
    if (sheetLandArea !== dbLandArea) {
      updateData.land_area = sheetLandArea;
      needsUpdate = true;
    }

    // building_area（建㎡）
    var sheetBuildingArea = row['建（㎡）'] !== '' && row['建（㎡）'] !== undefined && row['建（㎡）'] !== null ? parseFloat(row['建（㎡）']) : null;
    var dbBuildingArea = dbSeller.building_area !== null && dbSeller.building_area !== undefined ? parseFloat(dbSeller.building_area) : null;
    if (sheetBuildingArea !== dbBuildingArea) {
      updateData.building_area = sheetBuildingArea;
      needsUpdate = true;
    }

    // build_year（築年）
    var sheetBuildYear = row['築年'] !== '' && row['築年'] !== undefined && row['築年'] !== null ? parseInt(row['築年'], 10) : null;
    var dbBuildYear = dbSeller.build_year !== null && dbSeller.build_year !== undefined ? parseInt(dbSeller.build_year, 10) : null;
    if (sheetBuildYear !== dbBuildYear) {
      updateData.build_year = sheetBuildYear;
      needsUpdate = true;
    }

    // structure（構造）
    var sheetStructure = row['構造'] ? String(row['構造']) : null;
    var dbStructure = dbSeller.structure || null;
    if (sheetStructure !== dbStructure) {
      updateData.structure = sheetStructure;
      needsUpdate = true;
    }

    // floor_plan（間取り）
    var sheetFloorPlan = row['間取り'] ? String(row['間取り']) : null;
    var dbFloorPlan = dbSeller.floor_plan || null;
    if (sheetFloorPlan !== dbFloorPlan) {
      updateData.floor_plan = sheetFloorPlan;
      needsUpdate = true;
    }

    // inquiry_date（反響日付）
    var sheetInquiryDate = formatDateToISO_(row['反響日付']);
    var dbInquiryDate = dbSeller.inquiry_date ? String(dbSeller.inquiry_date).substring(0, 10) : null;
    if (sheetInquiryDate !== dbInquiryDate) {
      updateData.inquiry_date = sheetInquiryDate;
      needsUpdate = true;
    }

    // valuation_method（査定方法）
    var sheetValuationMethod = row['査定方法'] ? String(row['査定方法']) : null;
    var dbValuationMethod = dbSeller.valuation_method || null;
    if (sheetValuationMethod !== dbValuationMethod) {
      updateData.valuation_method = sheetValuationMethod;
      needsUpdate = true;
    }

    // valuation_amount_1/2/3（査定額: 手動入力優先、万円→円変換）
    var rawVal1 = row['査定額1'] !== '' && row['査定額1'] !== undefined && row['査定額1'] !== null ? row['査定額1'] : (row['査定額1（自動計算）v'] || null);
    var rawVal2 = row['査定額2'] !== '' && row['査定額2'] !== undefined && row['査定額2'] !== null ? row['査定額2'] : (row['査定額2（自動計算）v'] || null);
    var rawVal3 = row['査定額3'] !== '' && row['査定額3'] !== undefined && row['査定額3'] !== null ? row['査定額3'] : (row['査定額3（自動計算）v'] || null);
    var sheetVal1 = rawVal1 !== null && rawVal1 !== '' ? Math.round(parseFloat(rawVal1) * 10000) : null;
    var sheetVal2 = rawVal2 !== null && rawVal2 !== '' ? Math.round(parseFloat(rawVal2) * 10000) : null;
    var sheetVal3 = rawVal3 !== null && rawVal3 !== '' ? Math.round(parseFloat(rawVal3) * 10000) : null;
    var dbVal1 = dbSeller.valuation_amount_1 !== null && dbSeller.valuation_amount_1 !== undefined ? parseInt(dbSeller.valuation_amount_1, 10) : null;
    var dbVal2 = dbSeller.valuation_amount_2 !== null && dbSeller.valuation_amount_2 !== undefined ? parseInt(dbSeller.valuation_amount_2, 10) : null;
    var dbVal3 = dbSeller.valuation_amount_3 !== null && dbSeller.valuation_amount_3 !== undefined ? parseInt(dbSeller.valuation_amount_3, 10) : null;
    if (sheetVal1 !== dbVal1) { updateData.valuation_amount_1 = sheetVal1; needsUpdate = true; }
    if (sheetVal2 !== dbVal2) { updateData.valuation_amount_2 = sheetVal2; needsUpdate = true; }
    if (sheetVal3 !== dbVal3) { updateData.valuation_amount_3 = sheetVal3; needsUpdate = true; }

    // visit_acquisition_date（訪問取得日）
    var sheetVisitAcqDate = formatDateToISO_(row['訪問取得日\n年/月/日'] || row['訪問取得日']);
    var dbVisitAcqDate = dbSeller.visit_acquisition_date ? String(dbSeller.visit_acquisition_date).substring(0, 10) : null;
    if (sheetVisitAcqDate !== dbVisitAcqDate) {
      updateData.visit_acquisition_date = sheetVisitAcqDate;
      needsUpdate = true;
    }

    // visit_date（訪問日）
    var sheetVisitDate = formatDateToISO_(row['訪問日 \nY/M/D'] || row['訪問日']);
    var dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;
    if (sheetVisitDate !== dbVisitDate) {
      updateData.visit_date = sheetVisitDate;
      needsUpdate = true;
    }

    // visit_time（訪問時間）
    var sheetVisitTime = row['訪問時間'] ? String(row['訪問時間']) : null;
    var dbVisitTime = dbSeller.visit_time || null;
    if (sheetVisitTime !== dbVisitTime) {
      updateData.visit_time = sheetVisitTime;
      needsUpdate = true;
    }

    // visit_valuation_acquirer（訪問査定取得者）
    var sheetVisitValAcq = row['訪問査定取得者'] ? String(row['訪問査定取得者']) : null;
    var dbVisitValAcq = dbSeller.visit_valuation_acquirer || null;
    if (sheetVisitValAcq !== dbVisitValAcq) {
      updateData.visit_valuation_acquirer = sheetVisitValAcq;
      needsUpdate = true;
    }

    // valuation_assignee（査定担当）
    var sheetValAssignee = row['査定担当'] ? String(row['査定担当']) : null;
    var dbValAssignee = dbSeller.valuation_assignee || null;
    if (sheetValAssignee !== dbValAssignee) {
      updateData.valuation_assignee = sheetValAssignee;
      needsUpdate = true;
    }

    // confidence_level（確度）
    var sheetConfidence = row['確度'] ? String(row['確度']) : null;
    var dbConfidence = dbSeller.confidence_level || null;
    if (sheetConfidence !== dbConfidence) {
      updateData.confidence_level = sheetConfidence;
      needsUpdate = true;
    }

    // competitor_name（競合名）
    var sheetCompetitor = row['競合名'] ? String(row['競合名']) : null;
    var dbCompetitor = dbSeller.competitor_name || null;
    if (sheetCompetitor !== dbCompetitor) {
      updateData.competitor_name = sheetCompetitor;
      needsUpdate = true;
    }

    // competitor_name_and_reason（競合名、理由）
    var sheetCompetitorReason = row['競合名、理由\n（他決、専任）'] || row['競合名、理由'] ? String(row['競合名、理由\n（他決、専任）'] || row['競合名、理由']) : null;
    var dbCompetitorReason = dbSeller.competitor_name_and_reason || null;
    if (sheetCompetitorReason !== dbCompetitorReason) {
      updateData.competitor_name_and_reason = sheetCompetitorReason;
      needsUpdate = true;
    }

    // exclusive_other_decision_factor（専任・他決要因）
    var sheetExclusive = row['専任・他決要因'] ? String(row['専任・他決要因']) : null;
    var dbExclusive = dbSeller.exclusive_other_decision_factor || null;
    if (sheetExclusive !== dbExclusive) {
      updateData.exclusive_other_decision_factor = sheetExclusive;
      needsUpdate = true;
    }

    // visit_notes（訪問メモ）
    var sheetVisitNotes = row['訪問メモ'] ? String(row['訪問メモ']) : null;
    var dbVisitNotes = dbSeller.visit_notes || null;
    if (sheetVisitNotes !== dbVisitNotes) {
      updateData.visit_notes = sheetVisitNotes;
      needsUpdate = true;
    }

    // first_call_person（1番電話）: 反響日付が2026/3/20以降の売主のみ同期
    var sheetFirstCallPerson = row['1番電話'] ? String(row['1番電話']) : null;
    var dbFirstCallPerson = dbSeller.first_call_person || null;
    var inquiryDateForFilter = sheetInquiryDate; // formatDateToISO_済み（YYYY-MM-DD or null）
    var firstCallPersonCutoff = '2026-03-20';
    if (sheetFirstCallPerson !== dbFirstCallPerson &&
        inquiryDateForFilter !== null && inquiryDateForFilter >= firstCallPersonCutoff) {
      updateData.first_call_person = sheetFirstCallPerson;
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

    // 更新した行だけ待機（帯域制限対策）
    Utilities.sleep(100);

    // 実行時間チェック: 5分（300秒）を超えたら安全に終了
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
