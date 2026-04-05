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

// 🚨 新規追加: バッチ更新関数（複数の買主を1回のHTTPリクエストで更新）
function patchBuyersBatchToSupabase_(buyersData) {
  // buyersData: [{ buyer_number, updateData }, ...]
  var url = BUYER_SYNC_CONFIG.BACKEND_URL + '/api/buyers/batch';
  
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
    payload: JSON.stringify({ buyers: buyersData }),
    muteHttpExceptions: true
  };
  
  try {
    var res = UrlFetchApp.fetch(url, options);
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      var result = JSON.parse(res.getContentText());
      return { success: true, result: result };
    } else {
      return { success: false, error: 'HTTP ' + code + ': ' + res.getContentText().substring(0, 300) };
    }
  } catch (e) {
    return { success: false, error: 'Network error: ' + e.toString() };
  }
}

function fetchAllBuyersFromSupabase_() {
  var allBuyers = [];
  var pageSize = 1000;
  var offset = 0;
  var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,offer_comment,company_name,email';
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
    var dateA = formatDateToISO_(a['受付日']) || '';
    var dateB = formatDateToISO_(b['受付日']) || '';
    if (dateB > dateA) return 1;
    if (dateB < dateA) return -1;
    return 0;
  });
  Logger.log('📅 受付日の降順にソート完了');
  
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
    var sheetStatus = row['★最新状況'] ? String(row['★最新状況']) : null;
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
    var sheetNextCallDate = formatDateToISO_(row['★次電日']);
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
    var initialAssignee = row['初動担当'];
    var followUpAssignee = row['後続担当'];
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
    var sheetInquiryEmailPhone = row['【問合メール】電話対応'] ? String(row['【問合メール】電話対応']) : null;
    var normalizedSheetInquiryEmailPhone = normalizeValue(sheetInquiryEmailPhone);
    var normalizedDbInquiryEmailPhone = normalizeValue(dbBuyer.inquiry_email_phone_response);
    if (normalizedSheetInquiryEmailPhone !== normalizedDbInquiryEmailPhone) {
      updateData.inquiry_email_phone_response = normalizedSheetInquiryEmailPhone;
      needsUpdate = true;
      if (normalizedSheetInquiryEmailPhone === null && normalizedDbInquiryEmailPhone !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 問合メール電話対応を削除 (旧値: ' + normalizedDbInquiryEmailPhone + ')');
      }
    }
    
    // 3回架電確認済み
    var sheetThreeCallsConfirmed = row['3回架電確認済み'] ? String(row['3回架電確認済み']) : null;
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
    var sheetReceptionDate = formatDateToISO_(row['受付日']);
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
    var sheetDistributionType = row['配信種別'] ? String(row['配信種別']) : null;
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
    var sheetDesiredArea = row['★エリア'] ? String(row['★エリア']) : null;
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
    var sheetViewingDate = formatDateToISO_(row['●内覧日(最新）']);
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
    var rawViewingTime = row['●時間'];
    var sheetViewingTime = null;
    
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
    
    var normalizedSheetViewingTime = normalizeValue(sheetViewingTime);
    var normalizedDbViewingTime = normalizeValue(dbBuyer.viewing_time);
    
    if (normalizedSheetViewingTime !== normalizedDbViewingTime) {
      updateData.viewing_time = normalizedSheetViewingTime;
      needsUpdate = true;

    
    // 内覧形態
    var sheetViewingMobile = row['内覧形態'] ? String(row['内覧形態']) : null;
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
    var sheetViewingTypeGeneral = row['内覧形態_一般媒介'] ? String(row['内覧形態_一般媒介']) : null;
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
    var sheetLatestViewingDate = formatDateToISO_(row['最新内覧日']);
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
    var sheetPostViewingSellerContact = row['内覧後売主連絡'] ? String(row['内覧後売主連絡']) : null;
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
    var sheetViewingPromotionEmail = row['内覧促進メール'] ? String(row['内覧促進メール']) : null;
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
    var sheetNotificationSender = row['通知送信者'] ? String(row['通知送信者']) : null;
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
    var sheetPreViewingNotes = row['内覧前伝達事項'] ? String(row['内覧前伝達事項']) : null;
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
    var sheetViewingNotes = row['内覧の時の伝達事項'] ? String(row['内覧の時の伝達事項']) : null;
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
    var sheetPreViewingHearing = row['内覧前ヒアリング'] ? String(row['内覧前ヒアリング']) : null;
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
    var sheetOfferComment = row['買付コメント（任意）'] ? String(row['買付コメント（任意）']) : null;
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
    var sheetCompanyName = row['法人名'] ? String(row['法人名']) : null;
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
    var sheetEmail = row['●メアド'] ? String(row['●メアド']) : null;
    var normalizedSheetEmail = normalizeValue(sheetEmail);
    var normalizedDbEmail = normalizeValue(dbBuyer.email);
    if (normalizedSheetEmail !== normalizedDbEmail) {
      updateData.email = normalizedSheetEmail;
      needsUpdate = true;
      if (normalizedSheetEmail === null && normalizedDbEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': ●メアドを削除 (旧値: ' + normalizedDbEmail + ')');
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
        updatedCount += batchResult.updated;
        errorCount += batchResult.errors;
        Logger.log('✅ バッチ更新完了: ' + batchResult.updated + '件成功 / ' + batchResult.errors + '件失敗');
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
      updatedCount += finalBatchResult.updated;
      errorCount += finalBatchResult.errors;
      Logger.log('✅ 最終バッチ更新完了: ' + finalBatchResult.updated + '件成功 / ' + finalBatchResult.errors + '件失敗');
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
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var sheetRows = [];
  for (var i = 0; i < allData.length; i++) { sheetRows.push(rowToObject(headers, allData[i])); }
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

