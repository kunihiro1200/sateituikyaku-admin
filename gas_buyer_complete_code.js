// ============================================================
// 設定
// ============================================================
var BUYER_SYNC_CONFIG = {
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
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else {
        // 🚨 重要: ●時間列の場合は時刻部分のみを抽出（HH:MM:SS形式）
        if (headerName === '●時間') {
          var hours = val.getHours();
          var minutes = val.getMinutes();
          var seconds = val.getSeconds();
          obj[headerName] = String(hours).padStart(2, '0') + ':' + 
                           String(minutes).padStart(2, '0') + ':' + 
                           String(seconds).padStart(2, '0');
        } else {
          // 日付列の場合は日付部分のみを抽出（YYYY/MM/DD形式）
          obj[headerName] = val.getFullYear() + '/' +
            String(val.getMonth() + 1).padStart(2, '0') + '/' +
            String(val.getDate()).padStart(2, '0');
        }
      }
    } else {
      // 買主番号は必ず文字列型に変換
      if (headerName === '買主番号' && val !== null && val !== undefined && val !== '') {
        obj[headerName] = String(val);
      } else {
        obj[headerName] = val;
      }
    }
  }
  return obj;
}

/**
 * rowオブジェクトからキー名のスペースを無視して値を取得するヘルパー
 * 全角・半角スペースの有無に関わらず正しくマッチする
 */
function getRowValue_(row, key) {
  // まず完全一致で試みる
  if (row.hasOwnProperty(key)) return row[key];
  // スペースを除去したキーで再試行
  var normalizedKey = key.replace(/[\s\u3000]+/g, '');
  for (var k in row) {
    if (row.hasOwnProperty(k)) {
      var normalizedK = k.replace(/[\s\u3000]+/g, '');
      if (normalizedK === normalizedKey) return row[k];
    }
  }
  return undefined;
}

function formatDateToISO_(value) {
  if (!value || value === '') return null;
  
  // 数値（Excelシリアル値）の場合
  if (typeof value === 'number') {
    var excelEpoch = new Date(1899, 11, 30);
    var days = value > 60 ? value - 1 : value;
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

function isTodayOrBefore(dateStr) {
  if (!dateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
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
  var parts = [];
  if (isValidContactValue(row['電話担当（任意）'])) parts.push(String(row['電話担当（任意）']).trim());
  if (isValidContactValue(row['連絡取りやすい日、時間帯'])) parts.push(String(row['連絡取りやすい日、時間帯']).trim());
  if (isValidContactValue(row['連絡方法'])) parts.push(String(row['連絡方法']).trim());
  return parts.join('・');
}

// ============================================================
// Supabase直接更新ユーティリティ
// ============================================================

/**
 * 値を正規化する（空文字列、undefined、空白文字列をnullに変換）
 * @param {*} value - 正規化する値
 * @return {*} 正規化された値（nullまたは元の値）
 */
function normalizeValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

function patchBuyerToSupabase_(buyerNumber, updateData) {
  // 🚨 重要: バックエンドAPIを呼び出してサイドバーカウントを即時更新
  // Supabaseに直接アクセスせず、バックエンドAPI経由で更新する
  var url = BUYER_SYNC_CONFIG.BACKEND_URL + '/api/buyers/' + encodeURIComponent(buyerNumber);
  
  // API Keyを環境変数から取得
  var apiKey = PropertiesService.getScriptProperties().getProperty('GAS_API_KEY');
  if (!apiKey) {
    Logger.log('❌ GAS_API_KEY is not set in Script Properties');
    return { success: false, error: 'GAS_API_KEY is not configured' };
  }
  
  var options = {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey  // API Key認証ヘッダー
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

// バッチ更新関数（Supabase直接upsert方式）
// バックエンドAPI経由は遅いため、Supabaseに直接upsertする
// サイドバーカウントは syncBuyerList 完了後に updateBuyerSidebarCounts() で一括更新する
function patchBuyersBatchToSupabase_(buyersData) {
  // buyersData: [{ buyer_number, updates }, ...]
  // 1件ずつSupabase直接PATCHする（差分のみ安全に更新）
  // バックエンドAPI経由より大幅に高速（1件数十ms）
  var successCount = 0;
  var failedCount = 0;

  // GASのUrlFetchApp.fetchAllで並列リクエスト
  var requests = [];
  for (var i = 0; i < buyersData.length; i++) {
    var buyerNumber = buyersData[i].buyer_number;
    var updates = buyersData[i].updates;
    var url = SUPABASE_CONFIG.URL + '/rest/v1/buyers?buyer_number=eq.' + encodeURIComponent(buyerNumber);
    requests.push({
      url: url,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(updates),
      muteHttpExceptions: true
    });
  }

  try {
    var responses = UrlFetchApp.fetchAll(requests);
    for (var j = 0; j < responses.length; j++) {
      var code = responses[j].getResponseCode();
      if (code >= 200 && code < 300) {
        successCount++;
      } else {
        failedCount++;
        Logger.log('❌ PATCH失敗 ' + buyersData[j].buyer_number + ': HTTP ' + code + ' ' + responses[j].getContentText().substring(0, 100));
      }
    }
    return { success: true, result: { success: successCount, failed: failedCount } };
  } catch (e) {
    return { success: false, error: 'Network error: ' + e.toString() };
  }
}

function fetchAllBuyersFromSupabase_() {
  var allBuyers = [];
  var pageSize = 1000;
  var offset = 0;
  var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,offer_comment,company_name,email,other_company_property,building_name_price,inquiry_email_reply,inquiry_hearing,inquiry_confidence,viewing_result_follow_up';
  while (true) {
    var url = SUPABASE_CONFIG.URL + '/rest/v1/buyers?select=' + fields +
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
    allBuyers = allBuyers.concat(page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }
  return allBuyers;
}

function syncUpdatesToSupabase_(sheetRows) {
  Logger.log('📥 Phase 2: Supabase直接更新同期開始...');
  var dbBuyers = fetchAllBuyersFromSupabase_();
  if (!dbBuyers) {
    Logger.log('❌ Supabaseからのデータ取得失敗');
    return { updated: 0, errors: 0 };
  }
  Logger.log('📊 DB買主数: ' + dbBuyers.length);
  var dbMap = {};
  for (var i = 0; i < dbBuyers.length; i++) {
    dbMap[dbBuyers[i].buyer_number] = dbBuyers[i];
  }
  sheetRows.sort(function(a, b) {
    var numA = parseInt(a['買主番号'], 10) || 0;
    var numB = parseInt(b['買主番号'], 10) || 0;
    return numA - numB;
  });
  Logger.log('📅 買主番号の昇順にソート完了');
  
  var updatedCount = 0;
  var errorCount = 0;
  var phaseStartTime = new Date();
  
  // 🚨 バッチ処理: 100件ずつまとめて更新
  var BATCH_SIZE = 100;
  var batchData = [];
  
  for (var r = 0; r < sheetRows.length; r++) {
    var row = sheetRows[r];
    var buyerNumber = row['買主番号'];
    if (!buyerNumber || typeof buyerNumber !== 'string') continue;
    var dbBuyer = dbMap[buyerNumber];
    if (!dbBuyer) continue;
    var updateData = {};
    var needsUpdate = false;
    
    // 最新状況
    var sheetStatus = getRowValue_(row, '★最新状況') ? String(getRowValue_(row, '★最新状況')) : null;
    var normalizedSheetStatus = normalizeValue(sheetStatus);
    var normalizedDbStatus = normalizeValue(dbBuyer.latest_status);
    if (normalizedSheetStatus !== normalizedDbStatus) {
      updateData.latest_status = normalizedSheetStatus;
      needsUpdate = true;
      if (normalizedSheetStatus === null && normalizedDbStatus !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 最新状況を削除 (旧値: ' + normalizedDbStatus + ')');
      }
    }
    
    // 次電日
    var sheetNextCallDate = formatDateToISO_(getRowValue_(row, '★次電日'));
    var dbNextCallDate = dbBuyer.next_call_date ? String(dbBuyer.next_call_date).substring(0, 10) : null;
    var normalizedSheetNextCallDate = normalizeValue(sheetNextCallDate);
    var normalizedDbNextCallDate = normalizeValue(dbNextCallDate);
    if (normalizedSheetNextCallDate !== normalizedDbNextCallDate) {
      updateData.next_call_date = normalizedSheetNextCallDate;
      needsUpdate = true;
      if (normalizedSheetNextCallDate === null && normalizedDbNextCallDate !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 次電日を削除 (旧値: ' + normalizedDbNextCallDate + ')');
      }
    }
    
    // 初動担当
    var initialAssignee = getRowValue_(row, '初動担当');
    var followUpAssignee = getRowValue_(row, '後続担当');
    var sheetInitialAssignee = initialAssignee ? String(initialAssignee) : null;
    var sheetFollowUpAssignee = followUpAssignee ? String(followUpAssignee) : null;
    var normalizedSheetInitialAssignee = normalizeValue(sheetInitialAssignee);
    var normalizedDbInitialAssignee = normalizeValue(dbBuyer.initial_assignee);
    if (normalizedSheetInitialAssignee !== normalizedDbInitialAssignee) {
      updateData.initial_assignee = normalizedSheetInitialAssignee;
      needsUpdate = true;
      if (normalizedSheetInitialAssignee === null && normalizedDbInitialAssignee !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 初動担当を削除 (旧値: ' + normalizedDbInitialAssignee + ')');
      }
    }
    
    // 後続担当
    var normalizedSheetFollowUpAssignee = normalizeValue(sheetFollowUpAssignee);
    var normalizedDbFollowUpAssignee = normalizeValue(dbBuyer.follow_up_assignee);
    if (normalizedSheetFollowUpAssignee !== normalizedDbFollowUpAssignee) {
      updateData.follow_up_assignee = normalizedSheetFollowUpAssignee;
      needsUpdate = true;
      if (normalizedSheetFollowUpAssignee === null && normalizedDbFollowUpAssignee !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 後続担当を削除 (旧値: ' + normalizedDbFollowUpAssignee + ')');
      }
    }
    
    // 問合メール電話対応
    var sheetInquiryEmailPhone = getRowValue_(row, '【問合メール】電話対応') ? String(getRowValue_(row, '【問合メール】電話対応')) : null;
    var normalizedSheetInquiryEmailPhone = normalizeValue(sheetInquiryEmailPhone);
    var normalizedDbInquiryEmailPhone = normalizeValue(dbBuyer.inquiry_email_phone);
    if (normalizedSheetInquiryEmailPhone !== normalizedDbInquiryEmailPhone) {
      updateData.inquiry_email_phone = normalizedSheetInquiryEmailPhone;
      needsUpdate = true;
      if (normalizedSheetInquiryEmailPhone === null && normalizedDbInquiryEmailPhone !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 問合メール電話対応を削除 (旧値: ' + normalizedDbInquiryEmailPhone + ')');
      }
    }
    
    // 【問合メール】メール返信（inquiry_email_reply）
    var sheetInquiryEmailReply = getRowValue_(row, '【問合メール】　メール返信') ? String(getRowValue_(row, '【問合メール】　メール返信')) : null;
    var normalizedSheetInquiryEmailReply = normalizeValue(sheetInquiryEmailReply);
    var normalizedDbInquiryEmailReply = normalizeValue(dbBuyer.inquiry_email_reply);
    if (normalizedSheetInquiryEmailReply !== normalizedDbInquiryEmailReply) {
      updateData.inquiry_email_reply = normalizedSheetInquiryEmailReply;
      needsUpdate = true;
      if (normalizedSheetInquiryEmailReply === null && normalizedDbInquiryEmailReply !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 問合メール返信を削除 (旧値: ' + normalizedDbInquiryEmailReply + ')');
      }
    }
    
    // 問合時ヒアリング（inquiry_hearing）
    var sheetInquiryHearing = getRowValue_(row, '●問合時ヒアリング') ? String(getRowValue_(row, '●問合時ヒアリング')) : null;
    var normalizedSheetInquiryHearing = normalizeValue(sheetInquiryHearing);
    var normalizedDbInquiryHearing = normalizeValue(dbBuyer.inquiry_hearing);
    if (normalizedSheetInquiryHearing !== normalizedDbInquiryHearing) {
      updateData.inquiry_hearing = normalizedSheetInquiryHearing;
      needsUpdate = true;
      if (normalizedSheetInquiryHearing === null && normalizedDbInquiryHearing !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 問合時ヒアリングを削除 (旧値: ' + normalizedDbInquiryHearing + ')');
      }
    }

    // 問合時確度（inquiry_confidence）
    var sheetInquiryConfidence = getRowValue_(row, '●問合時確度') ? String(getRowValue_(row, '●問合時確度')) : null;
    var normalizedSheetInquiryConfidence = normalizeValue(sheetInquiryConfidence);
    var normalizedDbInquiryConfidence = normalizeValue(dbBuyer.inquiry_confidence);
    if (normalizedSheetInquiryConfidence !== normalizedDbInquiryConfidence) {
      updateData.inquiry_confidence = normalizedSheetInquiryConfidence;
      needsUpdate = true;
      if (normalizedSheetInquiryConfidence === null && normalizedDbInquiryConfidence !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 問合時確度を削除 (旧値: ' + normalizedDbInquiryConfidence + ')');
      }
    }

    // 内覧結果・後続対応（viewing_result_follow_up）
    var sheetViewingResultFollowUp = getRowValue_(row, '★内覧結果・後続対応') ? String(getRowValue_(row, '★内覧結果・後続対応')) : null;
    var normalizedSheetViewingResultFollowUp = normalizeValue(sheetViewingResultFollowUp);
    var normalizedDbViewingResultFollowUp = normalizeValue(dbBuyer.viewing_result_follow_up);
    if (normalizedSheetViewingResultFollowUp !== normalizedDbViewingResultFollowUp) {
      updateData.viewing_result_follow_up = normalizedSheetViewingResultFollowUp;
      needsUpdate = true;
      if (normalizedSheetViewingResultFollowUp === null && normalizedDbViewingResultFollowUp !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧結果・後続対応を削除 (旧値: ' + normalizedDbViewingResultFollowUp + ')');
      }
    }

    // 3回架電確認済み
    var sheetThreeCallsConfirmed = getRowValue_(row, '3回架電確認済み') ? String(getRowValue_(row, '3回架電確認済み')) : null;
    var normalizedSheetThreeCallsConfirmed = normalizeValue(sheetThreeCallsConfirmed);
    var normalizedDbThreeCallsConfirmed = normalizeValue(dbBuyer.three_call_confirmed);
    if (normalizedSheetThreeCallsConfirmed !== normalizedDbThreeCallsConfirmed) {
      updateData.three_call_confirmed = normalizedSheetThreeCallsConfirmed;
      needsUpdate = true;
      if (normalizedSheetThreeCallsConfirmed === null && normalizedDbThreeCallsConfirmed !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 3回架電確認済みを削除 (旧値: ' + normalizedDbThreeCallsConfirmed + ')');
      }
    }
    
    // 受付日
    var sheetReceptionDate = formatDateToISO_(getRowValue_(row, '受付日'));
    var dbReceptionDate = dbBuyer.reception_date ? String(dbBuyer.reception_date).substring(0, 10) : null;
    var normalizedSheetReceptionDate = normalizeValue(sheetReceptionDate);
    var normalizedDbReceptionDate = normalizeValue(dbReceptionDate);
    if (normalizedSheetReceptionDate !== normalizedDbReceptionDate) {
      updateData.reception_date = normalizedSheetReceptionDate;
      needsUpdate = true;
      if (normalizedSheetReceptionDate === null && normalizedDbReceptionDate !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 受付日を削除 (旧値: ' + normalizedDbReceptionDate + ')');
      }
    }
    
    // 配信種別
    var sheetDistributionType = getRowValue_(row, '配信種別') ? String(getRowValue_(row, '配信種別')) : null;
    var normalizedSheetDistributionType = normalizeValue(sheetDistributionType);
    var normalizedDbDistributionType = normalizeValue(dbBuyer.distribution_type);
    if (normalizedSheetDistributionType !== normalizedDbDistributionType) {
      updateData.distribution_type = normalizedSheetDistributionType;
      needsUpdate = true;
      if (normalizedSheetDistributionType === null && normalizedDbDistributionType !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 配信種別を削除 (旧値: ' + normalizedDbDistributionType + ')');
      }
    }
    
    // エリア
    var sheetDesiredArea = getRowValue_(row, '★エリア') ? String(getRowValue_(row, '★エリア')) : null;
    var normalizedSheetDesiredArea = normalizeValue(sheetDesiredArea);
    var normalizedDbDesiredArea = normalizeValue(dbBuyer.desired_area);
    if (normalizedSheetDesiredArea !== normalizedDbDesiredArea) {
      updateData.desired_area = normalizedSheetDesiredArea;
      needsUpdate = true;
      if (normalizedSheetDesiredArea === null && normalizedDbDesiredArea !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': エリアを削除 (旧値: ' + normalizedDbDesiredArea + ')');
      }
    }
    
    // 内覧日（最新）
    var sheetViewingDate = formatDateToISO_(getRowValue_(row, '●内覧日(最新）'));
    var dbViewingDate = dbBuyer.viewing_date ? String(dbBuyer.viewing_date).substring(0, 10) : null;
    var normalizedSheetViewingDate = normalizeValue(sheetViewingDate);
    var normalizedDbViewingDate = normalizeValue(dbViewingDate);
    if (normalizedSheetViewingDate !== normalizedDbViewingDate) {
      updateData.viewing_date = normalizedSheetViewingDate;
      needsUpdate = true;
      if (normalizedSheetViewingDate === null && normalizedDbViewingDate !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧日を削除 (旧値: ' + normalizedDbViewingDate + ')');
      }
    }
    
    // 時間（●時間列、BP列）
    var rawViewingTime = getRowValue_(row, '●時間');
    var sheetViewingTime = null;
    
    // 🚨 デバッグ: 買主7282の時間データを記録
    if (buyerNumber === '7282') {
      Logger.log('  🕐 [DEBUG] 時間（生データ）: ' + rawViewingTime);
      Logger.log('    型: ' + typeof rawViewingTime);
      Logger.log('    Date型か: ' + (rawViewingTime instanceof Date));
      Logger.log('    空文字か: ' + (rawViewingTime === ''));
      Logger.log('    nullか: ' + (rawViewingTime === null));
      Logger.log('    undefinedか: ' + (rawViewingTime === undefined));
    }
    
    if (rawViewingTime && rawViewingTime !== '') {
      // Dateオブジェクトの場合、時刻部分のみを抽出
      if (rawViewingTime instanceof Date) {
        var hours = rawViewingTime.getHours();
        var minutes = rawViewingTime.getMinutes();
        sheetViewingTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      } else {
        var viewingTimeStr = String(rawViewingTime).trim();
        // 日付形式（YYYY/MM/DD または YYYY-MM-DD）が含まれる場合は無視
        if (!viewingTimeStr.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)) {
          // 既に時刻形式（HH:MM または HH:MM:SS）の場合はそのまま使用
          if (viewingTimeStr.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
            var parts = viewingTimeStr.split(':');
            var hours2 = parts[0].padStart(2, '0');
            var minutes2 = parts[1];
            sheetViewingTime = hours2 + ':' + minutes2;
          }
          // 数値の場合（Excelシリアル値: 0.0～1.0）
          else if (typeof rawViewingTime === 'number' && rawViewingTime >= 0 && rawViewingTime < 1) {
            var totalMinutes = Math.round(rawViewingTime * 24 * 60);
            var hours3 = Math.floor(totalMinutes / 60);
            var minutes3 = totalMinutes % 60;
            sheetViewingTime = String(hours3).padStart(2, '0') + ':' + String(minutes3).padStart(2, '0');
          }
          // 文字列が小数の場合もシリアル値として処理
          else if (viewingTimeStr.match(/^0\.\d+$/)) {
            var serial = parseFloat(viewingTimeStr);
            var totalMinutes2 = Math.round(serial * 24 * 60);
            var hours4 = Math.floor(totalMinutes2 / 60);
            var minutes4 = totalMinutes2 % 60;
            sheetViewingTime = String(hours4).padStart(2, '0') + ':' + String(minutes4).padStart(2, '0');
          } else {
            // その他の場合は文字列として扱う
            sheetViewingTime = viewingTimeStr;
          }
        }
      }
    }
    
    // 🚨 デバッグ: 買主7282の時間変換結果を記録
    if (buyerNumber === '7282') {
      Logger.log('  🕐 [DEBUG] 時間（変換後）: ' + sheetViewingTime);
    }
    
    var normalizedSheetViewingTime = normalizeValue(sheetViewingTime);
    var normalizedDbViewingTime = normalizeValue(dbBuyer.viewing_time);
    
    // 🚨 デバッグ: 買主7282の正規化後の値を記録
    if (buyerNumber === '7282') {
      Logger.log('  � [DEBUG] 時間（正規化後）: ' + normalizedSheetViewingTime);
      Logger.log('  🕐 [DEBUG] DB時間（正規化後）: ' + normalizedDbViewingTime);
      Logger.log('  🕐 [DEBUG] 更新が必要か: ' + (normalizedSheetViewingTime !== normalizedDbViewingTime));
    }
    
    if (normalizedSheetViewingTime !== normalizedDbViewingTime) {
      updateData.viewing_time = normalizedSheetViewingTime;
      needsUpdate = true;
      if (normalizedSheetViewingTime === null && normalizedDbViewingTime !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧時間を削除 (旧値: ' + normalizedDbViewingTime + ')');
      } else if (buyerNumber === '7282') {
        Logger.log('  ✅ ' + buyerNumber + ': 内覧時間を更新 (新値: ' + normalizedSheetViewingTime + ', 旧値: ' + normalizedDbViewingTime + ')');
      }
    } else if (buyerNumber === '7282') {
      Logger.log('  ℹ️ ' + buyerNumber + ': 内覧時間は変更なし (' + normalizedSheetViewingTime + ')');
    }
    
    // 内覧形態
    var sheetViewingMobile = getRowValue_(row, '内覧形態') ? String(getRowValue_(row, '内覧形態')) : null;
    var normalizedSheetViewingMobile = normalizeValue(sheetViewingMobile);
    var normalizedDbViewingMobile = normalizeValue(dbBuyer.viewing_mobile);
    if (normalizedSheetViewingMobile !== normalizedDbViewingMobile) {
      updateData.viewing_mobile = normalizedSheetViewingMobile;
      needsUpdate = true;
      if (normalizedSheetViewingMobile === null && normalizedDbViewingMobile !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧形態を削除 (旧値: ' + normalizedDbViewingMobile + ')');
      }
    }
    
    // 内覧形態_一般媒介
    var sheetViewingTypeGeneral = getRowValue_(row, '内覧形態_一般媒介') ? String(getRowValue_(row, '内覧形態_一般媒介')) : null;
    var normalizedSheetViewingTypeGeneral = normalizeValue(sheetViewingTypeGeneral);
    var normalizedDbViewingTypeGeneral = normalizeValue(dbBuyer.viewing_type_general);
    if (normalizedSheetViewingTypeGeneral !== normalizedDbViewingTypeGeneral) {
      updateData.viewing_type_general = normalizedSheetViewingTypeGeneral;
      needsUpdate = true;
      if (normalizedSheetViewingTypeGeneral === null && normalizedDbViewingTypeGeneral !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧形態_一般媒介を削除 (旧値: ' + normalizedDbViewingTypeGeneral + ')');
      }
    }
    
    // 最新内覧日
    var sheetLatestViewingDate = formatDateToISO_(getRowValue_(row, '最新内覧日'));
    var dbLatestViewingDate = dbBuyer.latest_viewing_date ? String(dbBuyer.latest_viewing_date).substring(0, 10) : null;
    var normalizedSheetLatestViewingDate = normalizeValue(sheetLatestViewingDate);
    var normalizedDbLatestViewingDate = normalizeValue(dbLatestViewingDate);
    if (normalizedSheetLatestViewingDate !== normalizedDbLatestViewingDate) {
      updateData.latest_viewing_date = normalizedSheetLatestViewingDate;
      needsUpdate = true;
      if (normalizedSheetLatestViewingDate === null && normalizedDbLatestViewingDate !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 最新内覧日を削除 (旧値: ' + normalizedDbLatestViewingDate + ')');
      }
    }
    
    // 内覧後売主連絡
    var sheetPostViewingSellerContact = getRowValue_(row, '内覧後売主連絡') ? String(getRowValue_(row, '内覧後売主連絡')) : null;
    var normalizedSheetPostViewingSellerContact = normalizeValue(sheetPostViewingSellerContact);
    var normalizedDbPostViewingSellerContact = normalizeValue(dbBuyer.post_viewing_seller_contact);
    if (normalizedSheetPostViewingSellerContact !== normalizedDbPostViewingSellerContact) {
      updateData.post_viewing_seller_contact = normalizedSheetPostViewingSellerContact;
      needsUpdate = true;
      if (normalizedSheetPostViewingSellerContact === null && normalizedDbPostViewingSellerContact !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧後売主連絡を削除 (旧値: ' + normalizedDbPostViewingSellerContact + ')');
      }
    }
    
    // 内覧促進メール
    var sheetViewingPromotionEmail = getRowValue_(row, '内覧促進メール') ? String(getRowValue_(row, '内覧促進メール')) : null;
    var normalizedSheetViewingPromotionEmail = normalizeValue(sheetViewingPromotionEmail);
    var normalizedDbViewingPromotionEmail = normalizeValue(dbBuyer.viewing_promotion_email);
    if (normalizedSheetViewingPromotionEmail !== normalizedDbViewingPromotionEmail) {
      updateData.viewing_promotion_email = normalizedSheetViewingPromotionEmail;
      needsUpdate = true;
      if (normalizedSheetViewingPromotionEmail === null && normalizedDbViewingPromotionEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧促進メールを削除 (旧値: ' + normalizedDbViewingPromotionEmail + ')');
      }
    }
    
    // 通知送信者
    var sheetNotificationSender = getRowValue_(row, '通知送信者') ? String(getRowValue_(row, '通知送信者')) : null;
    var normalizedSheetNotificationSender = normalizeValue(sheetNotificationSender);
    var normalizedDbNotificationSender = normalizeValue(dbBuyer.notification_sender);
    if (normalizedSheetNotificationSender !== normalizedDbNotificationSender) {
      updateData.notification_sender = normalizedSheetNotificationSender;
      needsUpdate = true;
      if (normalizedSheetNotificationSender === null && normalizedDbNotificationSender !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 通知送信者を削除 (旧値: ' + normalizedDbNotificationSender + ')');
      }
    }
    
    // 内覧前伝達事項
    var sheetPreViewingNotes = getRowValue_(row, '内覧前伝達事項') ? String(getRowValue_(row, '内覧前伝達事項')) : null;
    var normalizedSheetPreViewingNotes = normalizeValue(sheetPreViewingNotes);
    var normalizedDbPreViewingNotes = normalizeValue(dbBuyer.pre_viewing_notes);
    if (normalizedSheetPreViewingNotes !== normalizedDbPreViewingNotes) {
      updateData.pre_viewing_notes = normalizedSheetPreViewingNotes;
      needsUpdate = true;
      if (normalizedSheetPreViewingNotes === null && normalizedDbPreViewingNotes !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧前伝達事項を削除 (旧値: ' + normalizedDbPreViewingNotes + ')');
      }
    }
    
    // 内覧の時の伝達事項
    var sheetViewingNotes = getRowValue_(row, '内覧の時の伝達事項') ? String(getRowValue_(row, '内覧の時の伝達事項')) : null;
    var normalizedSheetViewingNotes = normalizeValue(sheetViewingNotes);
    var normalizedDbViewingNotes = normalizeValue(dbBuyer.viewing_notes);
    if (normalizedSheetViewingNotes !== normalizedDbViewingNotes) {
      updateData.viewing_notes = normalizedSheetViewingNotes;
      needsUpdate = true;
      if (normalizedSheetViewingNotes === null && normalizedDbViewingNotes !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧の時の伝達事項を削除 (旧値: ' + normalizedDbViewingNotes + ')');
      }
    }
    
    // 内覧前ヒアリング
    var sheetPreViewingHearing = getRowValue_(row, '内覧前ヒアリング') ? String(getRowValue_(row, '内覧前ヒアリング')) : null;
    var normalizedSheetPreViewingHearing = normalizeValue(sheetPreViewingHearing);
    var normalizedDbPreViewingHearing = normalizeValue(dbBuyer.pre_viewing_hearing);
    if (normalizedSheetPreViewingHearing !== normalizedDbPreViewingHearing) {
      updateData.pre_viewing_hearing = normalizedSheetPreViewingHearing;
      needsUpdate = true;
      if (normalizedSheetPreViewingHearing === null && normalizedDbPreViewingHearing !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧前ヒアリングを削除 (旧値: ' + normalizedDbPreViewingHearing + ')');
      }
    }
    
    // 買付コメント（任意）
    var sheetOfferComment = getRowValue_(row, '買付コメント（任意）') ? String(getRowValue_(row, '買付コメント（任意）')) : null;
    var normalizedSheetOfferComment = normalizeValue(sheetOfferComment);
    var normalizedDbOfferComment = normalizeValue(dbBuyer.offer_comment);
    if (normalizedSheetOfferComment !== normalizedDbOfferComment) {
      updateData.offer_comment = normalizedSheetOfferComment;
      needsUpdate = true;
      if (normalizedSheetOfferComment === null && normalizedDbOfferComment !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 買付コメント（任意）を削除 (旧値: ' + normalizedDbOfferComment + ')');
      }
    }
    
    // 法人名
    var sheetCompanyName = getRowValue_(row, '法人名') ? String(getRowValue_(row, '法人名')) : null;
    var normalizedSheetCompanyName = normalizeValue(sheetCompanyName);
    var normalizedDbCompanyName = normalizeValue(dbBuyer.company_name);
    if (normalizedSheetCompanyName !== normalizedDbCompanyName) {
      updateData.company_name = normalizedSheetCompanyName;
      needsUpdate = true;
      if (normalizedSheetCompanyName === null && normalizedDbCompanyName !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 法人名を削除 (旧値: ' + normalizedDbCompanyName + ')');
      }
    }
    
    // ●メアド
    var sheetEmail = getRowValue_(row, '●メアド') ? String(getRowValue_(row, '●メアド')) : null;
    var normalizedSheetEmail = normalizeValue(sheetEmail);
    var normalizedDbEmail = normalizeValue(dbBuyer.email);
    if (normalizedSheetEmail !== normalizedDbEmail) {
      updateData.email = normalizedSheetEmail;
      needsUpdate = true;
      if (normalizedSheetEmail === null && normalizedDbEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': ●メアドを削除 (旧値: ' + normalizedDbEmail + ')');
      }
    }
    
    // 他社物件（DJ列）
    var sheetOtherCompanyProperty = getRowValue_(row, '他社物件') ? String(getRowValue_(row, '他社物件')) : null;
    var normalizedSheetOtherCompanyProperty = normalizeValue(sheetOtherCompanyProperty);
    var normalizedDbOtherCompanyProperty = normalizeValue(dbBuyer.other_company_property);
    if (normalizedSheetOtherCompanyProperty !== normalizedDbOtherCompanyProperty) {
      updateData.other_company_property = normalizedSheetOtherCompanyProperty;
      needsUpdate = true;
      if (normalizedSheetOtherCompanyProperty === null && normalizedDbOtherCompanyProperty !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 他社物件を削除 (旧値: ' + normalizedDbOtherCompanyProperty + ')');
      }
    }
    
    // 建物名/価格（H列）
    var sheetBuildingNamePrice = getRowValue_(row, '建物名/価格 内覧物件は赤表示（★は他社物件）') ? String(getRowValue_(row, '建物名/価格 内覧物件は赤表示（★は他社物件）')) : null;
    var normalizedSheetBuildingNamePrice = normalizeValue(sheetBuildingNamePrice);
    var normalizedDbBuildingNamePrice = normalizeValue(dbBuyer.building_name_price);
    if (normalizedSheetBuildingNamePrice !== normalizedDbBuildingNamePrice) {
      updateData.building_name_price = normalizedSheetBuildingNamePrice;
      needsUpdate = true;
      if (normalizedSheetBuildingNamePrice === null && normalizedDbBuildingNamePrice !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 建物名/価格を削除 (旧値: ' + normalizedDbBuildingNamePrice + ')');
      }
    }
    
    if (!needsUpdate) continue;
    
    // 🚨 バッチ処理: 更新データをバッチに追加
    updateData.updated_at = new Date().toISOString();
    batchData.push({
      buyer_number: buyerNumber,
      updates: updateData
    });
    
    // バッチサイズに達したら送信
    if (batchData.length >= BATCH_SIZE) {
      Logger.log('📦 バッチ送信: ' + batchData.length + '件');
      var batchResult = patchBuyersBatchToSupabase_(batchData);
      if (batchResult.success) {
        updatedCount += batchResult.result ? batchResult.result.success : 0;
        errorCount += batchResult.result ? batchResult.result.failed : 0;
        Logger.log('✅ バッチ更新完了: ' + (batchResult.result ? batchResult.result.success : 0) + '件成功 / ' + (batchResult.result ? batchResult.result.failed : 0) + '件失敗');
      } else {
        errorCount += batchData.length;
        Logger.log('❌ バッチ更新失敗: ' + batchResult.error);
      }
      batchData = []; // バッチをクリア
      Utilities.sleep(500); // バッチ送信後に少し待機
    }
    
    var elapsed = (new Date() - phaseStartTime) / 1000;
    if (elapsed > 300) {
      Logger.log('⚠️ 実行時間制限に近づいたため中断 (' + elapsed.toFixed(0) + '秒経過, ' + r + '/' + sheetRows.length + '件処理済み)');
      break;
    }
  }
  
  // 🚨 残りのバッチを送信
  if (batchData.length > 0) {
    Logger.log('📦 最終バッチ送信: ' + batchData.length + '件');
    var finalBatchResult = patchBuyersBatchToSupabase_(batchData);
    if (finalBatchResult.success) {
      updatedCount += finalBatchResult.result ? finalBatchResult.result.success : 0;
      errorCount += finalBatchResult.result ? finalBatchResult.result.failed : 0;
      Logger.log('✅ 最終バッチ更新完了: ' + (finalBatchResult.result ? finalBatchResult.result.success : 0) + '件成功 / ' + (finalBatchResult.result ? finalBatchResult.result.failed : 0) + '件失敗');
    } else {
      errorCount += batchData.length;
      Logger.log('❌ 最終バッチ更新失敗: ' + finalBatchResult.error);
    }
  }
  
  Logger.log('📊 Phase 2完了: 更新 ' + updatedCount + '件 / エラー ' + errorCount + '件');
  return { updated: updatedCount, errors: errorCount };
}

// ============================================================
// バックエンドAPI呼び出しユーティリティ
// ============================================================
function postToBackend(path, payload) {
  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + BUYER_SYNC_CONFIG.CRON_SECRET
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  return UrlFetchApp.fetch(BUYER_SYNC_CONFIG.BACKEND_URL + path, options);
}

// ============================================================
// メイン同期（10分トリガー）
// ============================================================
function syncBuyerList() {
  var startTime = new Date();
  Logger.log('=== 買主リスト同期開始: ' + startTime.toISOString() + ' ===');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('買主リスト');
  if (!sheet) { Logger.log('❌ シート「買主リスト」が見つかりません'); return; }
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  // ヘッダー行のみの場合はスキップ
  if (lastRow <= 1) {
    Logger.log('⚠️ データ行がありません（ヘッダー行のみ）');
    return;
  }
  
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var sheetRows = [];
  for (var i = 0; i < allData.length; i++) {
    // 行データが存在する場合のみ処理
    if (allData[i]) {
      sheetRows.push(rowToObject(headers, allData[i]));
    }
  }
  Logger.log('📊 スプレッドシート行数: ' + sheetRows.length);
  
  // Phase 1: 追加同期（スプレッドシートにあってDBにない買主を追加）
  try {
    var response = postToBackend('/api/sync/trigger?additionOnly=true&buyerAddition=true', {});
    var statusCode = response.getResponseCode();
    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(response.getContentText());
      Logger.log('✅ 追加同期成功: ' + (result.data ? result.data.added : 0) + '件追加');
    } else {
      Logger.log('⚠️ 追加同期失敗: HTTP ' + statusCode);
    }
  } catch (e) { Logger.log('⚠️ 追加同期エラー: ' + e.toString()); }
  
  // Phase 2: 更新同期（Supabase直接更新）
  syncUpdatesToSupabase_(sheetRows);
  
  // Phase 3: 削除同期（DBにあってスプレッドシートにない買主を削除）
  try {
    var delResponse = postToBackend('/api/sync/trigger?deletionOnly=true&buyerDeletion=true', {});
    var delStatusCode = delResponse.getResponseCode();
    if (delStatusCode >= 200 && delStatusCode < 300) {
      var delResult = JSON.parse(delResponse.getContentText());
      Logger.log('✅ 削除同期成功: ' + (delResult.data ? delResult.data.deleted : 0) + '件削除');
    } else {
      Logger.log('❌ 削除同期失敗: HTTP ' + delStatusCode);
    }
  } catch (e) { Logger.log('❌ 削除同期エラー: ' + e.toString()); }
  
  var duration = (new Date() - startTime) / 1000;
  Logger.log('  所要時間: ' + duration + '秒');
  Logger.log('=== 同期完了 ===');
}

// ============================================================
// トリガー設定（初回のみ手動実行）
// ============================================================
function setupBuyerSyncTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncBuyerList') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }
  ScriptApp.newTrigger('syncBuyerList')
    .timeBased()
    .everyMinutes(BUYER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES)
    .create();
  Logger.log('✅ トリガーを設定しました: ' + BUYER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES + '分ごと');
}

// ============================================================
// テスト・デバッグ用
// ============================================================

// ============================================================
// 買主サイドバーカウント更新（10分ごとに実行）
// ============================================================

/**
 * 買主サイドバーカウントを更新（10分ごとに実行）
 * buyer_sidebar_countsテーブルに事前計算結果を保存
 */
function updateBuyerSidebarCounts() {
  try {
    var startTime = new Date();
    Logger.log('🔄 買主サイドバーカウント更新開始...');
    
    // 全買主データを取得
    var allBuyers = fetchAllBuyersFromSupabase_();
    if (!allBuyers) {
      Logger.log('❌ 買主データ取得失敗');
      return;
    }
    Logger.log('📊 買主数: ' + allBuyers.length);
    
    // カウントを計算
    var counts = {
      viewingDayBefore: 0,
      todayCall: 0,
      todayCallAssigned: {},
      threeCallUnchecked: 0,  // ✅ 修正: threeCallsUnconfirmed → threeCallUnchecked
      threeCallUncheckedAssigned: {},  // ✅ 修正: threeCallsUnconfirmedAssigned → threeCallUncheckedAssigned
      assigned: {},
      inquiryEmailUnanswered: 0,
      inquiryEmailUnansweredAssigned: {},
      brokerInquiry: 0,  // 🆕 追加
      generalViewingSellerContactPending: 0,  // 🆕 追加
      viewingPromotionRequired: 0,  // 🆕 追加
      pinrichUnregistered: 0
    };
    
    var today = getTodayJST_();
    var tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    var todayStr = formatDateToYYYYMMDD_(today);
    var tomorrowStr = formatDateToYYYYMMDD_(tomorrow);
    
    // 各買主をカテゴリーに分類
    for (var i = 0; i < allBuyers.length; i++) {
      var buyer = allBuyers[i];
      var status = buyer.latest_status || '';
      var nextCallDate = buyer.next_call_date ? buyer.next_call_date.split('T')[0] : '';
      var viewingDate = buyer.latest_viewing_date ? buyer.latest_viewing_date.split('T')[0] : '';
      var assignee = buyer.initial_assignee || buyer.follow_up_assignee || '';
      
      // 内覧日前日
      if (viewingDate === tomorrowStr) {
        counts.viewingDayBefore++;
      }
      
      // 本日架電
      if (nextCallDate === todayStr) {
        counts.todayCall++;
        if (assignee) {
          counts.todayCallAssigned[assignee] = (counts.todayCallAssigned[assignee] || 0) + 1;
        }
      }
      
      // 3回架電未確認
      if (buyer.three_call_confirmed !== '確認済み' && buyer.three_call_confirmed) {
        counts.threeCallUnchecked++;  // ✅ 修正
        if (assignee) {
          counts.threeCallUncheckedAssigned[assignee] = (counts.threeCallUncheckedAssigned[assignee] || 0) + 1;  // ✅ 修正
        }
      }
      
      // 担当別
      if (assignee) {
        counts.assigned[assignee] = (counts.assigned[assignee] || 0) + 1;
      }
      
      // 問合メール未回答
      if (buyer.inquiry_email_phone === '未回答') {
        counts.inquiryEmailUnanswered++;
        if (assignee) {
          counts.inquiryEmailUnansweredAssigned[assignee] = (counts.inquiryEmailUnansweredAssigned[assignee] || 0) + 1;
        }
      }
      
      // 業者問合せあり
      if (buyer.broker_inquiry === '業者問合せ') {
        counts.brokerInquiry++;
      }
      
      // 一般媒介_内覧後売主連絡未
      if (buyer.viewing_type_general === '一般媒介' && buyer.post_viewing_seller_contact === '未') {
        counts.generalViewingSellerContactPending++;
      }
      
      // 要内覧促進客
      if (buyer.viewing_promotion_not_needed !== '不要' && !buyer.viewing_promotion_sender) {
        counts.viewingPromotionRequired++;
      }
      
      // ピンリッチ未登録
      if (!buyer.pinrich || buyer.pinrich === '未登録') {
        counts.pinrichUnregistered++;
      }
    }
    
    Logger.log('📊 カウント計算完了');
    Logger.log('  内覧日前日: ' + counts.viewingDayBefore);
    Logger.log('  本日架電: ' + counts.todayCall);
    Logger.log('  3回架電未確認: ' + counts.threeCallUnchecked);  // ✅ 修正
    Logger.log('  問合メール未回答: ' + counts.inquiryEmailUnanswered);
    Logger.log('  業者問合せあり: ' + counts.brokerInquiry);  // 🆕 追加
    Logger.log('  一般媒介_内覧後売主連絡未: ' + counts.generalViewingSellerContactPending);  // 🆕 追加
    Logger.log('  要内覧促進客: ' + counts.viewingPromotionRequired);  // 🆕 追加
    Logger.log('  ピンリッチ未登録: ' + counts.pinrichUnregistered);
    
    // buyer_sidebar_countsテーブルをクリア
    var deleteUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts?category=neq.dummy';
    var deleteOptions = {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      muteHttpExceptions: true
    };
    var deleteRes = UrlFetchApp.fetch(deleteUrl, deleteOptions);
    if (deleteRes.getResponseCode() >= 200 && deleteRes.getResponseCode() < 300) {
      Logger.log('✅ buyer_sidebar_countsテーブルをクリア');
    } else {
      Logger.log('❌ テーブルクリア失敗: HTTP ' + deleteRes.getResponseCode());
    }
    
    // 新しいカウントを挿入
    var insertData = [];
    
    // 内覧日前日
    insertData.push({
      category: 'viewingDayBefore',
      count: counts.viewingDayBefore,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 本日架電
    insertData.push({
      category: 'todayCall',
      count: counts.todayCall,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 本日架電（担当別）
    for (var assignee in counts.todayCallAssigned) {
      insertData.push({
        category: 'todayCallAssigned',
        count: counts.todayCallAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 3回架電未確認
    insertData.push({
      category: 'threeCallUnchecked',  // ✅ 修正
      count: counts.threeCallUnchecked,  // ✅ 修正
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 3回架電未確認（担当別）
    for (var assignee in counts.threeCallUncheckedAssigned) {  // ✅ 修正
      insertData.push({
        category: 'threeCallUncheckedAssigned',  // ✅ 修正
        count: counts.threeCallUncheckedAssigned[assignee],  // ✅ 修正
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 担当別
    for (var assignee in counts.assigned) {
      insertData.push({
        category: 'assigned',
        count: counts.assigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 問合メール未回答
    insertData.push({
      category: 'inquiryEmailUnanswered',
      count: counts.inquiryEmailUnanswered,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 問合メール未回答（担当別）
    for (var assignee in counts.inquiryEmailUnansweredAssigned) {
      insertData.push({
        category: 'inquiryEmailUnansweredAssigned',
        count: counts.inquiryEmailUnansweredAssigned[assignee],
        label: null,
        assignee: assignee,
        updated_at: new Date().toISOString()
      });
    }
    
    // 業者問合せあり
    insertData.push({
      category: 'brokerInquiry',
      count: counts.brokerInquiry,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 一般媒介_内覧後売主連絡未
    insertData.push({
      category: 'generalViewingSellerContactPending',
      count: counts.generalViewingSellerContactPending,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // 要内覧促進客
    insertData.push({
      category: 'viewingPromotionRequired',
      count: counts.viewingPromotionRequired,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    // ピンリッチ未登録
    insertData.push({
      category: 'pinrichUnregistered',
      count: counts.pinrichUnregistered,
      label: null,
      assignee: null,
      updated_at: new Date().toISOString()
    });
    
    Logger.log('📊 Upserting ' + insertData.length + ' rows to buyer_sidebar_counts...');
    
    // ステップ1: テーブルを全削除（確実にクリーンな状態にする）
    var deleteUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts?category=neq.___never___';  // 全件削除
    var deleteOptions = {
      method: 'DELETE',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY
      },
      muteHttpExceptions: true
    };
    var deleteRes = UrlFetchApp.fetch(deleteUrl, deleteOptions);
    Logger.log('🗑️ buyer_sidebar_countsテーブルをクリア: HTTP ' + deleteRes.getResponseCode());
    
    // ステップ2: 新しいデータを挿入
    var insertUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts';
    var insertOptions = {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'  // レスポンスで挿入されたデータを返す
      },
      payload: JSON.stringify(insertData),
      muteHttpExceptions: true
    };
    var insertRes = UrlFetchApp.fetch(insertUrl, insertOptions);
    var responseCode = insertRes.getResponseCode();
    var responseText = insertRes.getContentText();
    
    Logger.log('📡 挿入リクエスト送信完了');
    Logger.log('  HTTPステータスコード: ' + responseCode);
    Logger.log('  レスポンス本文: ' + responseText.substring(0, 1000));
    Logger.log('  挿入データ件数: ' + insertData.length);
    Logger.log('  挿入データサンプル: ' + JSON.stringify(insertData[0]));
    
    if (responseCode >= 200 && responseCode < 300) {
      // レスポンス本文をパースして挿入されたデータを確認
      var insertedData = JSON.parse(responseText);
      Logger.log('✅ buyer_sidebar_countsテーブルに' + insertedData.length + '件挿入成功');
      Logger.log('  挿入されたデータサンプル: ' + JSON.stringify(insertedData[0]));
      
      // 挿入成功を確認（レスポンスにデータが含まれている）
      if (insertedData.length > 0) {
        Logger.log('✅ 買主サイドバーカウント更新完了: ' + insertedData.length + '件');
      } else {
        Logger.log('⚠️ 警告: レスポンスにデータが含まれていません');
      }
    } else {
      Logger.log('❌ データ挿入失敗: HTTP ' + responseCode);
      Logger.log('  エラー詳細: ' + responseText);
    }
    
    var duration = (new Date() - startTime) / 1000;
    Logger.log('✅ 買主サイドバーカウント更新完了: ' + duration + '秒');
  } catch (e) {
    Logger.log('❌ 買主サイドバーカウント更新エラー: ' + e.toString());
    Logger.log('  スタックトレース: ' + e.stack);
  }
}

/**
 * 日付をYYYY-MM-DD形式にフォーマット
 */
function formatDateToYYYYMMDD_(date) {
  var year = date.getFullYear();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

/**
 * 今日の日付を取得（JST）
 */
function getTodayJST_() {
  var now = new Date();
  var jstOffset = 9 * 60; // JST = UTC+9
  var utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  var jst = new Date(utc + (jstOffset * 60000));
  jst.setHours(0, 0, 0, 0);
  return jst;
}

function testBuyerSync() {
  Logger.log('=== テスト同期開始 ===');
  syncBuyerList();
  Logger.log('=== テスト同期完了 ===');
}
