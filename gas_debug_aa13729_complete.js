// ============================================================
// AA13729デバッグ用完全スクリプト
// GASエディタで実行してください
// ============================================================

// ============================================================
// メイン関数：AA13729のデバッグ
// ============================================================
function debugAA13729() {
  Logger.log('=== AA13729デバッグ開始 ===');
  Logger.log('');
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  
  if (!sheet) {
    Logger.log('❌ エラー: 「売主リスト」シートが見つかりません');
    return;
  }
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  Logger.log('📊 スプレッドシート情報:');
  Logger.log('  - 最終行: ' + lastRow);
  Logger.log('  - 最終列: ' + lastCol);
  Logger.log('');
  
  // ヘッダー行を取得
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // 全データを取得
  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  // 必要な列のインデックスを取得
  var sellerNumberIndex = headers.indexOf('売主番号');
  var visitAssigneeIndex = headers.indexOf('営担');
  var visitDateIndex1 = headers.indexOf('訪問日 \nY/M/D');
  var visitDateIndex2 = headers.indexOf('訪問日 Y/M/D');
  var visitDateIndex3 = headers.indexOf('訪問日');
  var visitTimeIndex = headers.indexOf('訪問時間');
  
  Logger.log('📋 列インデックス:');
  Logger.log('  - 売主番号: ' + sellerNumberIndex);
  Logger.log('  - 営担: ' + visitAssigneeIndex);
  Logger.log('  - 訪問日 \\nY/M/D: ' + visitDateIndex1);
  Logger.log('  - 訪問日 Y/M/D: ' + visitDateIndex2);
  Logger.log('  - 訪問日: ' + visitDateIndex3);
  Logger.log('  - 訪問時間: ' + visitTimeIndex);
  Logger.log('');
  
  // AA13729を探す
  var found = false;
  for (var i = 0; i < allData.length; i++) {
    var sellerNumber = allData[i][sellerNumberIndex];
    
    if (sellerNumber === 'AA13729') {
      found = true;
      Logger.log('✅ AA13729を発見（行' + (i + 2) + '）');
      Logger.log('');
      
      // 営担を取得
      var visitAssignee = allData[i][visitAssigneeIndex];
      Logger.log('📌 営担:');
      Logger.log('  - 値: ' + visitAssignee);
      Logger.log('  - 型: ' + typeof visitAssignee);
      Logger.log('  - 空かどうか: ' + (visitAssignee === '' || visitAssignee === null || visitAssignee === undefined));
      Logger.log('');
      
      // 訪問日を取得（3つの列を確認）
      var visitDate1 = visitDateIndex1 >= 0 ? allData[i][visitDateIndex1] : null;
      var visitDate2 = visitDateIndex2 >= 0 ? allData[i][visitDateIndex2] : null;
      var visitDate3 = visitDateIndex3 >= 0 ? allData[i][visitDateIndex3] : null;
      var visitTime = visitTimeIndex >= 0 ? allData[i][visitTimeIndex] : null;
      
      Logger.log('📅 訪問日（生データ）:');
      Logger.log('  - 訪問日 \\nY/M/D: ' + visitDate1 + ' (型: ' + typeof visitDate1 + ')');
      Logger.log('  - 訪問日 Y/M/D: ' + visitDate2 + ' (型: ' + typeof visitDate2 + ')');
      Logger.log('  - 訪問日: ' + visitDate3 + ' (型: ' + typeof visitDate3 + ')');
      Logger.log('  - 訪問時間: ' + visitTime + ' (型: ' + typeof visitTime + ')');
      Logger.log('');
      
      // 訪問日を選択（優先順位: visitDate1 > visitDate2 > visitDate3）
      var rawVisitDate = visitDate1 || visitDate2 || visitDate3;
      
      Logger.log('📅 選択された訪問日: ' + rawVisitDate);
      Logger.log('');
      
      // formatDateToISO_を適用
      var visitDateStr = formatDateToISO_(rawVisitDate);
      Logger.log('🔄 formatDateToISO_適用後: ' + visitDateStr);
      Logger.log('');
      
      // visitDateOnlyを計算（TIMESTAMP形式から日付部分のみを抽出）
      var visitDateOnly = null;
      if (visitDateStr) {
        // ISO 8601形式（YYYY-MM-DDTHH:MM:SS）またはスペース区切り（YYYY-MM-DD HH:MM:SS）に対応
        visitDateOnly = visitDateStr.split('T')[0].split(' ')[0];
      }
      
      Logger.log('📅 visitDateOnly（日付部分のみ）: ' + visitDateOnly);
      Logger.log('');
      
      // 今日の日付を取得
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      var todayStr = today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');
      
      Logger.log('📆 今日の日付: ' + todayStr);
      Logger.log('  - 年: ' + today.getFullYear());
      Logger.log('  - 月: ' + (today.getMonth() + 1));
      Logger.log('  - 日: ' + today.getDate());
      Logger.log('  - 曜日: ' + ['日','月','火','水','木','金','土'][today.getDay()]);
      Logger.log('');
      
      // 訪問日前日判定
      if (visitDateOnly) {
        var visitDate = new Date(visitDateOnly);
        visitDate.setHours(0, 0, 0, 0);
        
        var visitDay = visitDate.getDay();
        var visitDayName = ['日','月','火','水','木','金','土'][visitDay];
        
        Logger.log('📅 訪問日の詳細:');
        Logger.log('  - 訪問日: ' + visitDateOnly);
        Logger.log('  - 曜日: ' + visitDayName + '曜日');
        Logger.log('  - 曜日番号: ' + visitDay);
        Logger.log('');
        
        // 前営業日の日数を計算
        var daysBeforeVisit = (visitDay === 4) ? 2 : 1;
        Logger.log('📊 前営業日ロジック:');
        Logger.log('  - 訪問日が木曜日か: ' + (visitDay === 4 ? 'はい' : 'いいえ'));
        Logger.log('  - 前営業日の日数: ' + daysBeforeVisit + '日前');
        Logger.log('');
        
        // 通知日を計算
        var notifyDate = new Date(visitDate);
        notifyDate.setDate(notifyDate.getDate() - daysBeforeVisit);
        var notifyDateStr = notifyDate.getFullYear() + '-' +
          String(notifyDate.getMonth() + 1).padStart(2, '0') + '-' +
          String(notifyDate.getDate()).padStart(2, '0');
        var notifyDayName = ['日','月','火','水','木','金','土'][notifyDate.getDay()];
        
        Logger.log('📆 通知日（訪問日の前営業日）:');
        Logger.log('  - 通知日: ' + notifyDateStr);
        Logger.log('  - 曜日: ' + notifyDayName + '曜日');
        Logger.log('');
        
        // 日付比較
        var isSameDate = (today.getTime() === notifyDate.getTime());
        Logger.log('🔍 日付比較:');
        Logger.log('  - 今日のタイムスタンプ: ' + today.getTime());
        Logger.log('  - 通知日のタイムスタンプ: ' + notifyDate.getTime());
        Logger.log('  - 今日 === 通知日: ' + isSameDate);
        Logger.log('');
        
        // 営担チェック
        var isVisitAssigneeValid = visitAssignee && visitAssignee !== '' && visitAssignee !== '外す';
        Logger.log('🔍 営担チェック:');
        Logger.log('  - 営担が存在: ' + (visitAssignee && visitAssignee !== ''));
        Logger.log('  - 営担が「外す」ではない: ' + (visitAssignee !== '外す'));
        Logger.log('  - 営担が有効: ' + isVisitAssigneeValid);
        Logger.log('');
        
        // 最終判定
        var shouldBeInCategory = isVisitAssigneeValid && isSameDate;
        
        Logger.log('🎯 最終判定:');
        Logger.log('  - 営担が有効: ' + isVisitAssigneeValid);
        Logger.log('  - 今日が通知日: ' + isSameDate);
        Logger.log('  - 訪問日前日カテゴリに含まれるべき: ' + shouldBeInCategory);
        Logger.log('');
        
        if (shouldBeInCategory) {
          Logger.log('✅ AA13729は「訪問日前日」カテゴリに含まれるはずです');
        } else {
          Logger.log('❌ AA13729は「訪問日前日」カテゴリに含まれません');
          if (!isVisitAssigneeValid) {
            Logger.log('   理由: 営担が無効');
          }
          if (!isSameDate) {
            Logger.log('   理由: 今日が通知日ではない');
          }
        }
      } else {
        Logger.log('❌ 訪問日が取得できませんでした');
      }
      
      Logger.log('');
      Logger.log('=== デバッグ完了 ===');
      break;
    }
  }
  
  if (!found) {
    Logger.log('❌ AA13729が見つかりませんでした');
    Logger.log('');
    Logger.log('💡 確認事項:');
    Logger.log('  - スプレッドシートに AA13729 が存在するか確認してください');
    Logger.log('  - 売主番号列（B列）に AA13729 が入力されているか確認してください');
  }
}

// ============================================================
// ユーティリティ関数：日付フォーマット
// ============================================================
function formatDateToISO_(value) {
  if (!value || value === '') return null;
  
  // 数値（Excelシリアル値）の場合
  if (typeof value === 'number') {
    // Excelのシリアル値を日付に変換（1900年1月1日からの日数）
    var excelEpoch = new Date(1899, 11, 30); // 1899年12月30日
    var days = value > 60 ? value - 1 : value; // Excelの1900年閏年バグ対応
    var date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
    var year = date.getFullYear();
    var month = String(date.getMonth() + 1).padStart(2, '0');
    var day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }
  
  // Dateオブジェクトの場合
  if (value instanceof Date) {
    var year2 = value.getFullYear();
    var month2 = String(value.getMonth() + 1).padStart(2, '0');
    var day2 = String(value.getDate()).padStart(2, '0');
    return year2 + '-' + month2 + '-' + day2;
  }
  
  // 文字列の場合
  var str = String(value).trim();
  
  // YYYY/MM/DD形式
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    var parts = str.split('/');
    return parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
  }
  
  // YYYY-MM-DD形式
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    var parts2 = str.split('-');
    return parts2[0] + '-' + parts2[1].padStart(2, '0') + '-' + parts2[2].padStart(2, '0');
  }
  
  return null;
}

// ============================================================
// 実行方法
// ============================================================
// 1. Google スプレッドシート（売主リスト）を開く
// 2. 「拡張機能」→「Apps Script」を選択
// 3. このコードを全てコピー＆ペースト
// 4. 関数選択で「debugAA13729」を選択
// 5. 「実行」ボタンをクリック
// 6. 「実行ログ」タブでログを確認
