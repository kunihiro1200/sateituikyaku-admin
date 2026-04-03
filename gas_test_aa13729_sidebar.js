// ============================================================
// AA13729のみでサイドバーカウントをテスト
// GASエディタで実行してください
// ============================================================

var SUPABASE_CONFIG = {
  URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
};

function testAA13729Sidebar() {
  Logger.log('=== AA13729サイドバーカウントテスト開始 ===');
  Logger.log('');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  
  if (!sheet) {
    Logger.log('❌ エラー: 「売主リスト」シートが見つかりません');
    return;
  }
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  // AA13729を探す
  var sellerNumberIndex = headers.indexOf('売主番号');
  var aa13729Row = null;
  
  for (var i = 0; i < allData.length; i++) {
    if (allData[i][sellerNumberIndex] === 'AA13729') {
      aa13729Row = rowToObject(headers, allData[i]);
      Logger.log('✅ AA13729を発見（行' + (i + 2) + '）');
      break;
    }
  }
  
  if (!aa13729Row) {
    Logger.log('❌ AA13729が見つかりませんでした');
    return;
  }
  
  Logger.log('');
  Logger.log('📊 AA13729のデータ:');
  Logger.log('  - 売主番号: ' + aa13729Row['売主番号']);
  Logger.log('  - 営担: ' + aa13729Row['営担']);
  Logger.log('  - 訪問日 \\nY/M/D: ' + aa13729Row['訪問日 \nY/M/D']);
  Logger.log('  - 訪問日 Y/M/D: ' + aa13729Row['訪問日 Y/M/D']);
  Logger.log('  - 訪問日: ' + aa13729Row['訪問日']);
  Logger.log('');
  
  // サイドバーカウント計算
  var sheetRows = [aa13729Row];
  updateSidebarCounts_(sheetRows);
  
  Logger.log('');
  Logger.log('=== テスト完了 ===');
}

// ============================================================
// ユーティリティ関数
// ============================================================
function rowToObject(headers, rowData) {
  var obj = {};
  var datetimeColumns = { '反響詳細日時': true, '訪問時間': true };
  for (var j = 0; j < headers.length; j++) {
    var headerName = String(headers[j]).trim();
    if (headerName === '') continue;
    var val = rowData[j];
    if (val instanceof Date) {
      if (val.getTime() === 0) {
        obj[headerName] = '';
      } else if (datetimeColumns[headerName]) {
        obj[headerName] = val;
      } else {
        obj[headerName] = val.getFullYear() + '/' +
          String(val.getMonth() + 1).padStart(2, '0') + '/' +
          String(val.getDate()).padStart(2, '0');
      }
    } else {
      if (headerName === '売主番号' && val !== null && val !== undefined && val !== '') {
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
  
  if (typeof value === 'number') {
    var excelEpoch = new Date(1899, 11, 30);
    var days = value > 60 ? value - 1 : value;
    var date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
  if (value instanceof Date) {
    var year2 = value.getFullYear();
    var month2 = String(value.getMonth() + 1).padStart(2, '0');
    var day2 = String(value.getDate()).padStart(2, '0');
    return year2 + '-' + month2 + '-' + day2;
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
// サイドバーカウント更新（AA13729のみ）
// ============================================================
function updateSidebarCounts_(sheetRows) {
  Logger.log('📊 サイドバーカウント計算開始...');
  Logger.log('');
  
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  
  Logger.log('📆 今日の日付: ' + todayStr);
  Logger.log('');

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

  var counts = {
    visitDayBefore: 0
  };

  for (var i = 0; i < sheetRows.length; i++) {
    var row = sheetRows[i];
    var sellerNumber = row['売主番号'];
    
    Logger.log('🔍 処理中: ' + sellerNumber);
    
    var visitAssignee = row['営担'];
    var isVisitAssigneeValid = visitAssignee && visitAssignee !== '';
    
    Logger.log('  - 営担: ' + visitAssignee);
    Logger.log('  - 営担が有効: ' + isVisitAssigneeValid);
    
    // 🚨 重要：訪問日を3つの列から取得（優先順位: 訪問日 \nY/M/D > 訪問日 Y/M/D > 訪問日）
    var rawVisitDate = row['訪問日 \nY/M/D'] || row['訪問日 Y/M/D'] || row['訪問日'];
    Logger.log('  - 生の訪問日: ' + rawVisitDate);
    
    var visitDateStr = formatDateToISO_(rawVisitDate);
    Logger.log('  - formatDateToISO_後: ' + visitDateStr);
    
    // 🚨 重要：visitDateStrがTIMESTAMP形式の場合、日付部分のみを抽出
    var visitDateOnly = visitDateStr ? visitDateStr.split('T')[0].split(' ')[0] : null;
    Logger.log('  - visitDateOnly: ' + visitDateOnly);
    
    if (isVisitAssigneeValid && visitDateOnly) {
      var isVDB = isVisitDayBefore(visitDateOnly);
      Logger.log('  - isVisitDayBefore: ' + isVDB);
      
      if (isVDB) {
        counts.visitDayBefore++;
        Logger.log('  ✅ 訪問日前日カテゴリに追加');
      } else {
        Logger.log('  ❌ 訪問日前日カテゴリに含まれない');
      }
    } else {
      if (!isVisitAssigneeValid) {
        Logger.log('  ❌ 営担が無効');
      }
      if (!visitDateOnly) {
        Logger.log('  ❌ 訪問日が取得できない');
      }
    }
    
    Logger.log('');
  }

  Logger.log('📊 カウント結果:');
  Logger.log('  - visitDayBefore: ' + counts.visitDayBefore);
  Logger.log('');
  
  // Supabaseに保存
  var upsertRows = [];
  var now = new Date().toISOString();
  upsertRows.push({ 
    category: 'visitDayBefore', 
    count: counts.visitDayBefore, 
    label: null, 
    assignee: null, 
    updated_at: now 
  });
  
  // 既存のvisitDayBeforeレコードを削除
  var delUrl = SUPABASE_CONFIG.URL + '/rest/v1/seller_sidebar_counts?category=eq.visitDayBefore';
  var delRes = UrlFetchApp.fetch(delUrl, {
    method: 'DELETE',
    headers: { 
      'apikey': SUPABASE_CONFIG.SERVICE_KEY, 
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY, 
      'Prefer': 'return=minimal' 
    },
    muteHttpExceptions: true
  });
  
  Logger.log('🗑️  既存レコード削除: HTTP ' + delRes.getResponseCode());
  
  // 新しいレコードを挿入
  var insRes = UrlFetchApp.fetch(SUPABASE_CONFIG.URL + '/rest/v1/seller_sidebar_counts', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json', 
      'apikey': SUPABASE_CONFIG.SERVICE_KEY, 
      'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_KEY, 
      'Prefer': 'return=minimal' 
    },
    payload: JSON.stringify(upsertRows),
    muteHttpExceptions: true
  });
  
  var insCode = insRes.getResponseCode();
  if (insCode >= 200 && insCode < 300) {
    Logger.log('✅ seller_sidebar_counts INSERT成功');
  } else {
    Logger.log('❌ seller_sidebar_counts INSERT失敗: HTTP ' + insCode);
    Logger.log('   レスポンス: ' + insRes.getContentText().substring(0, 200));
  }
  
  Logger.log('');
  Logger.log('📊 サイドバーカウント更新完了');
}
