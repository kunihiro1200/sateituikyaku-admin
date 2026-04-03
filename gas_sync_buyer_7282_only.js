// ============================================================
// 買主7282専用同期スクリプト
// ============================================================

var SUPABASE_CONFIG = {
  URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8'
};

function formatDateToISO_(value) {
  if (!value || value === '') return null;
  
  // Date型の場合
  if (value instanceof Date) {
    var year = value.getFullYear();
    var month = String(value.getMonth() + 1).padStart(2, '0');
    var day = String(value.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
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

function syncBuyer7282Only() {
  Logger.log('🚀 買主7282専用同期開始...');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('買主リスト');
  if (!sheet) {
    Logger.log('❌ シート「買主リスト」が見つかりません');
    return;
  }
  
  // 全データを取得
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var allData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = allData[0];
  
  Logger.log('📊 ヘッダー数: ' + headers.length);
  
  // 列Iと列BPのインデックスを確認
  var colI_index = 8;  // 列I = 9列目 = index 8
  var colBP_index = 67; // 列BP = 68列目 = index 67
  
  Logger.log('🔍 列I（index 8）のヘッダー: "' + headers[colI_index] + '"');
  Logger.log('🔍 列BP（index 67）のヘッダー: "' + headers[colBP_index] + '"');
  
  // 買主7282の行を探す
  var buyer7282Row = null;
  var buyer7282RowIndex = -1;
  
  for (var i = 1; i < allData.length; i++) {
    var buyerNumber = allData[i][4]; // E列（買主番号）= index 4
    if (buyerNumber && String(buyerNumber) === '7282') {
      buyer7282Row = allData[i];
      buyer7282RowIndex = i;
      break;
    }
  }
  
  if (!buyer7282Row) {
    Logger.log('❌ 買主7282が見つかりません');
    return;
  }
  
  Logger.log('✅ 買主7282が見つかりました（行' + (buyer7282RowIndex + 1) + '）');
  
  // 列Iと列BPの値を取得
  var viewingDateRaw = buyer7282Row[colI_index];
  var viewingTimeRaw = buyer7282Row[colBP_index];
  
  Logger.log('📅 列I（●内覧日(最新））の生データ: ' + viewingDateRaw + ' (型: ' + typeof viewingDateRaw + ')');
  Logger.log('🕐 列BP（●時間）の生データ: ' + viewingTimeRaw + ' (型: ' + typeof viewingTimeRaw + ')');
  
  // 日付を変換
  var viewingDate = formatDateToISO_(viewingDateRaw);
  Logger.log('📅 変換後の内覧日: ' + viewingDate);
  
  // 時刻を変換
  var viewingTime = null;
  if (viewingTimeRaw) {
    if (typeof viewingTimeRaw === 'number') {
      var hours = Math.floor(viewingTimeRaw * 24);
      var minutes = Math.floor((viewingTimeRaw * 24 * 60) % 60);
      viewingTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    } else if (viewingTimeRaw instanceof Date) {
      var hours = viewingTimeRaw.getHours();
      var minutes = viewingTimeRaw.getMinutes();
      viewingTime = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
    } else {
      viewingTime = String(viewingTimeRaw);
    }
  }
  Logger.log('🕐 変換後の時間: ' + viewingTime);
  
  // Supabaseに更新
  var updateData = {
    updated_at: new Date().toISOString()
  };
  
  if (viewingDate) {
    updateData.viewing_date = viewingDate;
  }
  if (viewingTime) {
    updateData.viewing_time = viewingTime;
  }
  
  Logger.log('📤 Supabaseに送信するデータ: ' + JSON.stringify(updateData));
  
  var url = SUPABASE_CONFIG.URL + '/rest/v1/buyers?buyer_number=eq.7282';
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
      Logger.log('✅ 買主7282の更新成功');
    } else {
      Logger.log('❌ 更新失敗: HTTP ' + code);
      Logger.log('❌ エラー詳細: ' + res.getContentText());
    }
  } catch (e) {
    Logger.log('❌ ネットワークエラー: ' + e.toString());
  }
  
  Logger.log('🎉 完了');
}
