// デバッグ用：AA13729が「訪問日前日」として認識されるかテスト

function debugAA13729VisitDayBefore() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  if (!sheet) {
    Logger.log('❌ シート「売主リスト」が見つかりません');
    return;
  }
  
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var sellerNumberCol = headers.indexOf('売主番号');
  var visitDateCol = headers.indexOf('訪問日 \nY/M/D');
  if (visitDateCol === -1) visitDateCol = headers.indexOf('訪問日 Y/M/D');
  if (visitDateCol === -1) visitDateCol = headers.indexOf('訪問日');
  var visitAssigneeCol = headers.indexOf('営担');
  
  Logger.log('=== 列インデックス ===');
  Logger.log('売主番号列: ' + sellerNumberCol);
  Logger.log('訪問日列: ' + visitDateCol);
  Logger.log('営担列: ' + visitAssigneeCol);
  
  // AA13729の行を検索
  var allData = sheet.getDataRange().getValues();
  var aa13729Row = null;
  var aa13729RowIndex = -1;
  
  for (var i = 1; i < allData.length; i++) {
    if (allData[i][sellerNumberCol] === 'AA13729') {
      aa13729Row = allData[i];
      aa13729RowIndex = i + 1;
      break;
    }
  }
  
  if (!aa13729Row) {
    Logger.log('❌ AA13729が見つかりません');
    return;
  }
  
  Logger.log('\n=== AA13729（行' + aa13729RowIndex + '）の生データ ===');
  Logger.log('訪問日（生データ）: ' + aa13729Row[visitDateCol]);
  Logger.log('訪問日の型: ' + typeof aa13729Row[visitDateCol]);
  Logger.log('営担: ' + aa13729Row[visitAssigneeCol]);
  
  // formatDateToISO_関数を使用して変換
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
  
  var visitDateStr = formatDateToISO_(aa13729Row[visitDateCol]);
  Logger.log('訪問日（ISO形式）: ' + visitDateStr);
  
  // 今日の日付
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayStr = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0');
  
  Logger.log('\n=== 日付計算 ===');
  Logger.log('今日: ' + todayStr);
  Logger.log('今日の曜日: ' + ['日', '月', '火', '水', '木', '金', '土'][today.getDay()]);
  
  if (!visitDateStr) {
    Logger.log('❌ 訪問日が取得できません');
    return;
  }
  
  var visitDate = new Date(visitDateStr);
  visitDate.setHours(0, 0, 0, 0);
  Logger.log('訪問日: ' + visitDateStr);
  Logger.log('訪問日の曜日: ' + ['日', '月', '火', '水', '木', '金', '土'][visitDate.getDay()]);
  
  var visitDay = visitDate.getDay();
  var daysBeforeVisit = (visitDay === 4) ? 2 : 1;
  Logger.log('前営業日までの日数: ' + daysBeforeVisit + '日');
  
  var notifyDate = new Date(visitDate);
  notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
  var notifyDateStr = notifyDate.getFullYear() + '-' +
    String(notifyDate.getMonth() + 1).padStart(2, '0') + '-' +
    String(notifyDate.getDate()).padStart(2, '0');
  Logger.log('前営業日: ' + notifyDateStr);
  Logger.log('前営業日の曜日: ' + ['日', '月', '火', '水', '木', '金', '土'][notifyDate.getDay()]);
  
  var isVisitDayBefore = today.getTime() === notifyDate.getTime();
  Logger.log('\n=== 判定結果 ===');
  Logger.log('今日 === 前営業日? ' + (isVisitDayBefore ? '✅ YES' : '❌ NO'));
  Logger.log('today.getTime(): ' + today.getTime());
  Logger.log('notifyDate.getTime(): ' + notifyDate.getTime());
}
