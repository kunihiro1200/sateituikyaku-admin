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
// サイドバーカウント更新（buyer_sidebar_counts テーブルへ書き込み）
// ============================================================
function updateBuyerSidebarCounts_() {
  Logger.log('📊 買主サイドバーカウント更新開始...');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('買主リスト');
  if (!sheet) {
    Logger.log('❌ シート「買主リスト」が見つかりません');
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
  
  // 今日の日付を取得（YYYY-MM-DD形式）
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  
  // ヘルパー関数
  function isTodayOrBefore(dateStr) {
    if (!dateStr) return false;
    return dateStr <= todayStr;
  }
  
  var counts = {
    todayCall: 0,
    todayCallAssigned: {},
    assigned: {},
    viewingDayBefore: 0  // 内覧日前日カテゴリ
  };
  
  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var buyerNumber = row['買主番号'];
    if (!buyerNumber || typeof buyerNumber !== 'string') continue;
    
    var status = String(row['★最新状況\n'] || '');
    var nextCallDate = formatDateToISO_(row['★次電日']);
    var initialAssignee = row['初動担当'];
    var followUpAssignee = row['後続担当'];
    var assignee = followUpAssignee || initialAssignee;
    var isAssigneeValid = assignee && assignee !== '外す';
    
    // 内覧日前日カテゴリ
    // 🚨 重要: バックエンドの条件と完全一致させる
    // 条件:
    // 1. viewing_date が空でない
    // 2. broker_inquiry が「業者問合せ」でない
    // 3. notification_sender が空である（通知送信者が未入力）
    // 4. 日付計算（明日または木曜日の場合は2日後）
    var viewingDate = formatDateToISO_(row['●内覧日(最新）']);
    var brokerInquiry = String(row['業者問合せ'] || '');
    var notificationSender = String(row['通知送信者'] || '');
    
    if (viewingDate && brokerInquiry !== '業者問合せ' && !notificationSender) {
      var vDate = new Date(viewingDate + 'T00:00:00');
      var vDay = vDate.getDay();
      var daysBeforeViewing = (vDay === 4) ? 2 : 1;  // 木曜内覧のみ2日前、それ以外は1日前
      var notifyDate = new Date(vDate);
      notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      notifyDate.setHours(0, 0, 0, 0);
      
      // 🚨 デバッグ: 買主7277, 7278, 7254の内覧日前日判定を記録
      if (buyerNumber === '7277' || buyerNumber === '7278' || buyerNumber === '7254') {
        Logger.log('  🔍 [DEBUG] ' + buyerNumber + ': 内覧日=' + viewingDate + ', 業者問合せ=' + brokerInquiry + ', 通知送信者=' + notificationSender);
        Logger.log('    今日=' + today.toISOString().substring(0, 10) + ', 通知日=' + notifyDate.toISOString().substring(0, 10));
        Logger.log('    内覧日の曜日=' + vDay + ', 通知日の計算=' + daysBeforeViewing + '日前');
        Logger.log('    今日が通知日か？ ' + (notifyDate.getTime() === today.getTime()));
      }
      
      if (notifyDate.getTime() === today.getTime()) {
        counts.viewingDayBefore++;
        // 🚨 重要: 全ての買主をログに記録（デバッグ用）
        Logger.log('  ✅ ' + buyerNumber + ': 内覧日前日カテゴリに追加 (内覧日=' + viewingDate + ', 通知日=' + notifyDate.toISOString().substring(0, 10) + ')');
      }
    } else if (buyerNumber === '7277' || buyerNumber === '7278' || buyerNumber === '7254') {
      // デバッグ: 条件を満たさない理由を記録
      Logger.log('  ⚠️ [DEBUG] ' + buyerNumber + ': 内覧日前日カテゴリの条件を満たさない');
      Logger.log('    内覧日？ ' + viewingDate);
      Logger.log('    業者問合せ？ ' + brokerInquiry + ' (業者問合せでない: ' + (brokerInquiry !== '業者問合せ') + ')');
      Logger.log('    通知送信者？ ' + notificationSender + ' (空: ' + (!notificationSender) + ')');
    }
    
    // 担当（担当別）カテゴリ
    if (isAssigneeValid) {
      var assigneeKey = String(assignee);
      counts.assigned[assigneeKey] = (counts.assigned[assigneeKey] || 0) + 1;
    }
    
    // 当日TEL分カテゴリ
    if (status.indexOf('追客中') !== -1 && nextCallDate && isTodayOrBefore(nextCallDate)) {
      if (isAssigneeValid) {
        // 当日TEL（担当別）
        var aKey = String(assignee);
        counts.todayCallAssigned[aKey] = (counts.todayCallAssigned[aKey] || 0) + 1;
      } else {
        // 当日TEL分（担当なし、コミュニケーション情報なし）
        counts.todayCall++;
      }
    }
  }
  
  // Supabaseに保存
  // 🚨 重要: label と assignee が null の場合は空文字列 '' に変換
  // （buyer_sidebar_counts テーブルの主キーが (category, label, assignee) で NOT NULL のため）
  var upsertRows = [];
  var now = new Date().toISOString();
  
  // 内覧日前日
  Logger.log('📊 [DEBUG] viewingDayBefore count before insert: ' + counts.viewingDayBefore);
  upsertRows.push({
    category: 'viewingDayBefore',
    count: counts.viewingDayBefore,
    label: '',
    assignee: '',
    updated_at: now
  });
  
  // 当日TEL分（担当なし）
  upsertRows.push({
    category: 'todayCall',
    count: counts.todayCall,
    label: '',
    assignee: '',
    updated_at: now
  });
  
  // 当日TEL（担当別）
  for (var assignee in counts.todayCallAssigned) {
    upsertRows.push({
      category: 'todayCallAssigned',
      count: counts.todayCallAssigned[assignee],
      label: '',
      assignee: assignee,
      updated_at: now
    });
  }
  
  // 担当（担当別）
  for (var assignedKey in counts.assigned) {
    upsertRows.push({
      category: 'assigned',
      count: counts.assigned[assignedKey],
      label: '',
      assignee: assignedKey,
      updated_at: now
    });
  }
  
  // 既存データを削除
  var delUrl = SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts?category=neq.___never___';
  UrlFetchApp.fetch(delUrl, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_CONFIG.SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
      'Prefer': 'return=minimal'
    },
    muteHttpExceptions: true
  });
  
  // 新しいデータを挿入
  var batchSize = 500;
  for (var b = 0; b < upsertRows.length; b += batchSize) {
    var batch = upsertRows.slice(b, b + batchSize);
    var insRes = UrlFetchApp.fetch(SUPABASE_CONFIG.URL + '/rest/v1/buyer_sidebar_counts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_CONFIG.SERVICE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(batch),
      muteHttpExceptions: true
    });
    var insCode = insRes.getResponseCode();
    if (insCode >= 200 && insCode < 300) {
      Logger.log('✅ buyer_sidebar_counts INSERT成功: ' + batch.length + '件');
    } else {
      Logger.log('❌ buyer_sidebar_counts INSERT失敗: HTTP ' + insCode + ' / ' + insRes.getContentText().substring(0, 200));
    }
  }
  
  Logger.log('📊 買主サイドバーカウント更新完了: 合計 ' + upsertRows.length + '行');
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
  var url = SUPABASE_CONFIG.URL + '/rest/v1/buyers?buyer_number=eq.' + encodeURIComponent(buyerNumber);
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

function fetchAllBuyersFromSupabase_() {
  var allBuyers = [];
  var pageSize = 1000;
  var offset = 0;
  var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email';
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
  for (var r = 0; r < sheetRows.length; r++) {
    var row = sheetRows[r];
    var buyerNumber = row['買主番号'];
    if (!buyerNumber || typeof buyerNumber !== 'string') continue;
    var dbBuyer = dbMap[buyerNumber];
    if (!dbBuyer) continue;
    var updateData = {};
    var needsUpdate = false;
    
    // 最新状況
    var sheetStatus = row['★最新状況\n'] ? String(row['★最新状況\n']) : null;
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
    var normalizedDbInquiryEmailPhone = normalizeValue(dbBuyer.inquiry_email_phone);
    if (normalizedSheetInquiryEmailPhone !== normalizedDbInquiryEmailPhone) {
      updateData.inquiry_email_phone = normalizedSheetInquiryEmailPhone;
      needsUpdate = true;
      if (normalizedSheetInquiryEmailPhone === null && normalizedDbInquiryEmailPhone !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 問合メール電話対応を削除 (旧値: ' + normalizedDbInquiryEmailPhone + ')');
      }
    }
    
    // 3回架電確認済み
    var sheetThreeCallsConfirmed = row['3回架電確認済み'] ? String(row['3回架電確認済み']) : null;
    var normalizedSheetThreeCallsConfirmed = normalizeValue(sheetThreeCallsConfirmed);
    var normalizedDbThreeCallsConfirmed = normalizeValue(dbBuyer.three_calls_confirmed);
    if (normalizedSheetThreeCallsConfirmed !== normalizedDbThreeCallsConfirmed) {
      updateData.three_calls_confirmed = normalizedSheetThreeCallsConfirmed;
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
    if (!needsUpdate) continue;
    updateData.updated_at = new Date().toISOString();
    var result = patchBuyerToSupabase_(buyerNumber, updateData);
    if (result.success) {
      updatedCount++;
      Logger.log('✅ ' + buyerNumber + ': 更新 (' + Object.keys(updateData).filter(function(k){ return k !== 'updated_at'; }).join(', ') + ')');
    } else {
      errorCount++;
      Logger.log('❌ ' + buyerNumber + ': 更新失敗 - ' + result.error);
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
  
  // サイドバーカウント更新
  updateBuyerSidebarCounts_();
  
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
function testBuyerSync() {
  Logger.log('=== テスト同期開始 ===');
  syncBuyerList();
  Logger.log('=== テスト同期完了 ===');
}
