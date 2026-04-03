// GASエディタで実行：AA13729のデバッグ
function debugAA13729() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  // AA13729を探す
  var sellerNumberIndex = headers.indexOf('売主番号');
  var visitAssigneeIndex = headers.indexOf('営担');
  var visitDateIndex1 = headers.indexOf('訪問日 \nY/M/D');
  var visitDateIndex2 = headers.indexOf('訪問日');
  
  Logger.log('=== AA13729のデバッグ ===');
  Logger.log('売主番号列: ' + sellerNumberIndex);
  Logger.log('営担列: ' + visitAssigneeIndex);
  Logger.log('訪問日列1: ' + visitDateIndex1);
  Logger.log('訪問日列2: ' + visitDateIndex2);
  Logger.log('');
  
  for (var i = 0; i < allData.length; i++) {
    var sellerNumber = allData[i][sellerNumberIndex];
    if (sellerNumber === 'AA13729') {
      Logger.log('✅ AA13729を発見（行' + (i + 2) + '）');
      Logger.log('');
      
      var visitAssignee = allData[i][visitAssigneeIndex];
      var visitDate1 = visitDateIndex1 >= 0 ? allData[i][visitDateIndex1] : null;
      var visitDate2 = visitDateIndex2 >= 0 ? allData[i][visitDateIndex2] : null;
      
      Logger.log('営担: ' + visitAssignee + ' (型: ' + typeof visitAssignee + ')');
      Logger.log('訪問日 \\nY/M/D: ' + visitDate1 + ' (型: ' + typeof visitDate1 + ')');
      Logger.log('訪問日: ' + visitDate2 + ' (型: ' + typeof visitDate2 + ')');
      Logger.log('');
      
      // formatDateToISO_を適用
      var visitDateStr = formatDateToISO_(visitDate1 || visitDate2);
      Logger.log('formatDateToISO_後: ' + visitDateStr);
      Logger.log('');
      
      // visitDateOnlyを計算
      var visitDateOnly = visitDateStr ? visitDateStr.split('T')[0].split(' ')[0] : null;
      Logger.log('visitDateOnly: ' + visitDateOnly);
      Logger.log('');
      
      // 今日の日付
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
      Logger.log('今日: ' + todayStr);
      Logger.log('');
      
      // isVisitDayBefore判定
      if (visitDateOnly) {
        var visitDate = new Date(visitDateOnly);
        visitDate.setHours(0, 0, 0, 0);
        var visitDay = visitDate.getDay();
        var daysBeforeVisit = (visitDay === 4) ? 2 : 1;
        var notifyDate = new Date(visitDate);
        notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
        var notifyDateStr = notifyDate.getFullYear() + '-' +
          String(notifyDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(notifyDate.getDate()).padStart(2, '0');
        
        Logger.log('訪問日: ' + visitDateOnly);
        Logger.log('訪問日の曜日: ' + ['日','月','火','水','木','金','土'][visitDay]);
        Logger.log('前営業日の日数: ' + daysBeforeVisit + '日前');
        Logger.log('通知日: ' + notifyDateStr);
        Logger.log('今日 === 通知日: ' + (today.getTime() === notifyDate.getTime()));
        Logger.log('');
        
        if (today.getTime() === notifyDate.getTime()) {
          Logger.log('✅ AA13729は訪問日前日カテゴリに含まれるはず');
        } else {
          Logger.log('❌ AA13729は訪問日前日カテゴリに含まれない');
        }
      }
      
      break;
    }
  }
}

// formatDateToISO_関数（gas_complete_code.jsからコピー）
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
