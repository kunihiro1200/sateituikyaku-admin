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
        obj[headerName] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
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
  
  var counts = {
    todayCall: 0,
    todayCallWithInfo: {},
    todayCallAssigned: {},
    assigned: {}
  };
  
  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var buyerNumber = row['買主番号'];
    if (!buyerNumber || typeof buyerNumber !== 'string' || !buyerNumber.match(/^BB\d+$/)) continue;
    
    var status = String(row['状況'] || '');
    var nextCallDate = formatDateToISO_(row['次電日']);
    var assignee = row['担当'];
    var isAssigneeValid = assignee && assignee !== '外す';
    
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
      } else if (hasContactInfo(row)) {
        // 当日TEL（内容）
        var label = getContactLabel(row);
        if (label) {
          counts.todayCallWithInfo[label] = (counts.todayCallWithInfo[label] || 0) + 1;
        }
      } else {
        // 当日TEL分（担当なし）
        counts.todayCall++;
      }
    }
  }
  
  // Supabaseに保存
  // 🚨 重要: label と assignee が null の場合は空文字列 '' に変換
  // （buyer_sidebar_counts テーブルの主キーが (category, label, assignee) で NOT NULL のため）
  var upsertRows = [];
  var now = new Date().toISOString();
  
  // 当日TEL分（担当なし）
  upsertRows.push({
    category: 'todayCall',
    count: counts.todayCall,
    label: '',  // null → '' に変換
    assignee: '',  // null → '' に変換
    updated_at: now
  });
  
  // 当日TEL（担当別）
  for (var assignee in counts.todayCallAssigned) {
    upsertRows.push({
      category: 'todayCallAssigned',
      count: counts.todayCallAssigned[assignee],
      label: '',  // null → '' に変換
      assignee: assignee,
      updated_at: now
    });
  }
  
  // 当日TEL（内容）
  for (var infoLabel in counts.todayCallWithInfo) {
    upsertRows.push({
      category: 'todayCallWithInfo',
      count: counts.todayCallWithInfo[infoLabel],
      label: infoLabel,
      assignee: '',  // null → '' に変換
      updated_at: now
    });
  }
  
  // 担当（担当別）
  for (var assignedKey in counts.assigned) {
    upsertRows.push({
      category: 'assigned',
      count: counts.assigned[assignedKey],
      label: '',  // null → '' に変換
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
// メイン同期（10分トリガー）
// ============================================================
function syncBuyerList() {
  var startTime = new Date();
  Logger.log('=== 買主リスト同期開始: ' + startTime.toISOString() + ' ===');
  
  // TODO: 買主データの同期処理を実装
  // 現在は未実装のため、サイドバーカウント更新のみ実行
  
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
