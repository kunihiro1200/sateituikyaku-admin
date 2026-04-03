// ============================================================
// AA13729の訪問日時のみを同期するスクリプト
// ============================================================

var SUPABASE_CONFIG = {
  URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
};

function syncAA13729Only() {
  Logger.log('🔄 AA13729の訪問日時同期を開始...');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  
  if (!sheet) {
    Logger.log('❌ エラー: 売主リストシートが見つかりません');
    return;
  }
  
  // ヘッダー行を取得
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  
  // B列（売主番号）でAA13729を検索
  var lastRow = sheet.getLastRow();
  var sellerNumbers = sheet.getRange(1, 2, lastRow, 1).getValues(); // B列全体を取得（1行目から）
  
  var targetRow = -1;
  for (var i = 0; i < sellerNumbers.length; i++) {
    var cellValue = String(sellerNumbers[i][0]).trim();
    Logger.log('行' + (i + 1) + ': [' + cellValue + ']');
    if (cellValue === 'AA13729') {
      targetRow = i + 1; // 1-indexed
      Logger.log('✅ 発見: 行' + targetRow);
      break;
    }
  }
  
  if (targetRow === -1) {
    Logger.log('❌ エラー: AA13729が見つかりません');
    return;
  }
  
  Logger.log('✅ AA13729を発見: 行 ' + targetRow);
  
  // 行データを取得
  var rowData = sheet.getRange(targetRow, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = rowToObject(headers, rowData);
  
  // 訪問日と訪問時間を取得
  // ステアリングドキュメントに従い、正しいヘッダー名を使用
  var rawVisitDate = row['訪問日 \nY/M/D'];
  var rawVisitTime = row['訪問時間'];
  
  Logger.log('📅 訪問日: ' + rawVisitDate);
  Logger.log('🕐 訪問時間: ' + rawVisitTime);
  
  if (!rawVisitDate || rawVisitDate === '') {
    Logger.log('⚠️ 訪問日が空です。同期をスキップします。');
    return;
  }
  
  if (!rawVisitTime || rawVisitTime === '') {
    Logger.log('⚠️ 訪問時間が空です。同期をスキップします。');
    return;
  }
  
  // 訪問日時を結合
  var visitDateStr = formatDateToISO_(rawVisitDate);
  if (!visitDateStr) {
    Logger.log('❌ エラー: 訪問日の変換に失敗しました');
    return;
  }
  
  visitDateStr = visitDateStr.replace(/-/g, '/');
  var sheetVisitDateTime = visitDateStr;
  
  // 訪問時間を抽出
  var timeStr = extractTimeString(rawVisitTime);
  if (!timeStr) {
    Logger.log('❌ エラー: 訪問時間の抽出に失敗しました');
    return;
  }
  
  sheetVisitDateTime += ' ' + timeStr;
  Logger.log('📅 結合後の訪問日時: ' + sheetVisitDateTime);
  
  // YYYY/MM/DD HH:MM:SS形式をYYYY-MM-DD HH:MM:SS形式に変換
  var dbVisitDateTime = sheetVisitDateTime.replace(/\//g, '-');
  Logger.log('💾 DB保存形式: ' + dbVisitDateTime);
  
  // Supabaseに直接更新
  var updateData = {
    visit_date: dbVisitDateTime
  };
  
  var result = patchSellerToSupabase_('AA13729', updateData);
  
  if (result.success) {
    Logger.log('✅ AA13729の訪問日時を更新しました: ' + dbVisitDateTime);
  } else {
    Logger.log('❌ エラー: ' + result.error);
  }
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

function extractTimeString(rawVisitTime) {
  if (!rawVisitTime || rawVisitTime === '') return null;
  
  if (rawVisitTime instanceof Date) {
    var hours = rawVisitTime.getHours();
    var minutes = rawVisitTime.getMinutes();
    return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':00';
  }
  
  var visitTimeStr = String(rawVisitTime).trim();
  
  if (visitTimeStr.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/)) {
    return null;
  }
  
  if (visitTimeStr.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
    var parts = visitTimeStr.split(':');
    var hours2 = parts[0].padStart(2, '0');
    var minutes2 = parts[1];
    var seconds = parts[2] || '00';
    return hours2 + ':' + minutes2 + ':' + seconds;
  }
  
  if (typeof rawVisitTime === 'number' && rawVisitTime >= 0 && rawVisitTime < 1) {
    var totalMinutes = Math.round(rawVisitTime * 24 * 60);
    var hours3 = Math.floor(totalMinutes / 60);
    var minutes3 = totalMinutes % 60;
    return String(hours3).padStart(2, '0') + ':' + String(minutes3).padStart(2, '0') + ':00';
  }
  
  if (visitTimeStr.match(/^0\.\d+$/)) {
    var serial = parseFloat(visitTimeStr);
    var totalMinutes2 = Math.round(serial * 24 * 60);
    var hours4 = Math.floor(totalMinutes2 / 60);
    var minutes4 = totalMinutes2 % 60;
    return String(hours4).padStart(2, '0') + ':' + String(minutes4).padStart(2, '0') + ':00';
  }
  
  return null;
}

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
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    
    if (code === 200 || code === 204) {
      return { success: true };
    } else {
      return { success: false, error: 'HTTP ' + code + ': ' + response.getContentText() };
    }
  } catch (e) {
    return { success: false, error: String(e) };
  }
}
