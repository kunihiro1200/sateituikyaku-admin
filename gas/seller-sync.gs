/**
 * 売主リスト同期スクリプト（GAS → バックエンドAPI経由でSupabase同期）
 * 
 * ⚠️ 重要: name/phone_number/emailは暗号化フィールドのため、
 * GASから直接Supabaseに書き込まず、バックエンドAPIを経由する
 * 
 * 同期方式: POST /api/sync/trigger を呼び出してフル同期をトリガー
 */

var SELLER_SYNC_CONFIG = {
  BACKEND_URL: 'https://sateituikyaku-admin-backend.vercel.app',
  CRON_SECRET: 'your-secret-cron-key-12345678901234567890',
  SYNC_INTERVAL_MINUTES: 10
};

/**
 * メイン同期関数（10分トリガーで実行）
 */
function syncSellerList() {
  var startTime = new Date();
  Logger.log('=== 売主リスト同期開始: ' + startTime.toISOString() + ' ===');

  try {
    var url = SELLER_SYNC_CONFIG.BACKEND_URL + '/api/sync/trigger?async=true';

    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SELLER_SYNC_CONFIG.CRON_SECRET
      },
      payload: JSON.stringify({}),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(responseText);
      var duration = (new Date() - startTime) / 1000;

      Logger.log('✅ 同期成功');
      Logger.log('  追加: ' + (result.data && result.data.additionResult ? result.data.additionResult.successfullyAdded : 0) + '件');
      Logger.log('  更新: ' + (result.data && result.data.additionResult ? result.data.additionResult.successfullyUpdated : 0) + '件');
      Logger.log('  所要時間: ' + duration + '秒');
      Logger.log('=== 同期完了 ===');
    } else {
      Logger.log('❌ 同期失敗: HTTP ' + statusCode);
      Logger.log('レスポンス: ' + responseText);
    }

  } catch (e) {
    Logger.log('❌ エラー: ' + e.toString());
    Logger.log(e.stack);
  }
}

/**
 * 10分ごとのトリガーを設定
 */
function setupSellerSyncTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncSellerList') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }

  // 新しいトリガーを作成
  ScriptApp.newTrigger('syncSellerList')
    .timeBased()
    .everyMinutes(SELLER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES)
    .create();

  Logger.log('✅ トリガーを設定しました: ' + SELLER_SYNC_CONFIG.SYNC_INTERVAL_MINUTES + '分ごと');
}

/**
 * テスト実行
 */
function testSellerSync() {
  Logger.log('=== テスト同期開始 ===');
  syncSellerList();
  Logger.log('=== テスト同期完了 ===');
}

/**
 * 査定書作成シート：反響URLを表示する
 * 条件：
 *   G列「反響送付日」 と DBの「反響詳細日時」が合致
 *   E列「物件住所」   と DBの「物件住所」が合致
 * 合致した場合、H列「反響URL」を表示する
 */
function fillInquiryUrls() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('査定書作成');
  if (!sheet) {
    Logger.log('❌ シート「査定書作成」が見つかりません');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('データがありません');
    return;
  }

  // E列（物件住所）、G列（反響送付日）、H列（反響URL）を取得
  // 列インデックス: E=5, G=7, H=8
  var dataRange = sheet.getRange(2, 1, lastRow - 1, 8);
  var data = dataRange.getValues();

  // バックエンドAPIから売主データを取得
  var sellers = fetchSellersFromApi();
  if (!sellers) {
    Logger.log('❌ 売主データの取得に失敗しました');
    return;
  }

  Logger.log('売主データ取得件数: ' + sellers.length);

  var updatedCount = 0;

  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var propertyAddress = String(row[4] || '').trim(); // E列（0-indexed: 4）
    var inquiryDateRaw = row[6]; // G列（0-indexed: 6）

    if (!propertyAddress || !inquiryDateRaw) continue;

    // G列の日付を文字列に変換（Date型の場合）
    var inquiryDateStr = '';
    if (inquiryDateRaw instanceof Date) {
      // YYYY-MM-DD HH:mm 形式に変換
      var y = inquiryDateRaw.getFullYear();
      var mo = String(inquiryDateRaw.getMonth() + 1).padStart(2, '0');
      var d = String(inquiryDateRaw.getDate()).padStart(2, '0');
      var h = String(inquiryDateRaw.getHours()).padStart(2, '0');
      var mi = String(inquiryDateRaw.getMinutes()).padStart(2, '0');
      inquiryDateStr = y + '-' + mo + '-' + d + ' ' + h + ':' + mi;
    } else {
      inquiryDateStr = String(inquiryDateRaw).trim();
    }

    if (!inquiryDateStr) continue;

    // 売主データと照合
    var matchedUrl = findInquiryUrl(sellers, propertyAddress, inquiryDateStr);
    if (matchedUrl) {
      // H列（列番号8）に反響URLを書き込む
      sheet.getRange(i + 2, 8).setValue(matchedUrl);
      updatedCount++;
      Logger.log('✅ 行' + (i + 2) + ': ' + propertyAddress + ' → ' + matchedUrl);
    }
  }

  Logger.log('反響URL更新件数: ' + updatedCount + '件');
}

/**
 * 売主データと照合して反響URLを返す
 */
function findInquiryUrl(sellers, propertyAddress, inquiryDateStr) {
  for (var i = 0; i < sellers.length; i++) {
    var seller = sellers[i];

    // 物件住所の照合（DBの propertyAddress）
    var dbPropertyAddress = String(seller.propertyAddress || '').trim();
    if (!dbPropertyAddress || dbPropertyAddress !== propertyAddress) continue;

    // 反響詳細日時の照合（DBの inquiryDetailedDatetime）
    var dbDatetime = seller.inquiryDetailedDatetime || seller.inquiryDatetime || '';
    if (!dbDatetime) continue;

    // 日付文字列を正規化して比較（YYYY-MM-DD HH:mm の先頭部分で比較）
    var dbDateStr = String(dbDatetime).substring(0, 16).replace('T', ' ');
    var sheetDateStr = inquiryDateStr.substring(0, 16);

    if (dbDateStr === sheetDateStr) {
      // 反響URLを返す（inquiryUrl フィールドがあれば使用）
      return seller.inquiryUrl || seller.inquirySource || '';
    }
  }
  return null;
}

/**
 * バックエンドAPIから売主データを取得
 */
function fetchSellersFromApi() {
  try {
    var url = SELLER_SYNC_CONFIG.BACKEND_URL + '/api/sellers?pageSize=1000&page=1';
    var options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SELLER_SYNC_CONFIG.CRON_SECRET
      },
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();

    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(response.getContentText());
      return result.data || result || [];
    } else {
      Logger.log('❌ API取得失敗: HTTP ' + statusCode);
      return null;
    }
  } catch (e) {
    Logger.log('❌ API取得エラー: ' + e.toString());
    return null;
  }
}

/**
 * 査定書作成シートの反響URLを手動で更新するテスト関数
 */
function testFillInquiryUrls() {
  Logger.log('=== 反響URL更新テスト開始 ===');
  fillInquiryUrls();
  Logger.log('=== 反響URL更新テスト完了 ===');
}

/**
 * onEditトリガー用: スプレッドシートの編集時に即時同期
 * 
 * セットアップ方法:
 *   setupOnEditTrigger() を一度実行してトリガーを登録する
 * 
 * エンドポイント: POST /api/cron/seller-row
 * ※ /api/sync/seller-row ではなく /api/cron/seller-row を使用すること
 *   （authenticateミドルウェアが適用されないパスに変更済み）
 */

/**
 * スプレッドシート編集時に呼び出される関数
 * 編集された行のデータをバックエンドAPIに送信してDBを即時更新する
 */
function onSellerRowEdit(e) {
  try {
    var sheet = e.source.getActiveSheet();

    // 「売主リスト」シート以外は無視
    if (sheet.getName() !== '売主リスト') {
      return;
    }

    var range = e.range;
    var row = range.getRow();

    // ヘッダー行（1行目）は無視
    if (row <= 1) {
      return;
    }

    // 編集された行の全データを取得
    var lastCol = sheet.getLastColumn();
    var rowData = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    // ヘッダーと値をオブジェクトにマッピング
    var rowObj = {};
    for (var i = 0; i < headers.length; i++) {
      var header = String(headers[i]).trim();
      if (header) {
        var val = rowData[i];
        // Date型は文字列に変換
        if (val instanceof Date) {
          var y = val.getFullYear();
          var mo = String(val.getMonth() + 1).padStart(2, '0');
          var d = String(val.getDate()).padStart(2, '0');
          rowObj[header] = y + '/' + mo + '/' + d;
        } else {
          rowObj[header] = val !== null && val !== undefined ? String(val) : '';
        }
      }
    }

    // 売主番号が空またはAAで始まらない場合は無視
    var sellerNumber = rowObj['売主番号'];
    if (!sellerNumber || !sellerNumber.startsWith('AA')) {
      return;
    }

    Logger.log('[onEdit] 売主番号: ' + sellerNumber + ' の行を同期します');

    // バックエンドAPIに送信
    var url = SELLER_SYNC_CONFIG.BACKEND_URL + '/api/cron/seller-row';
    var options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + SELLER_SYNC_CONFIG.CRON_SECRET
      },
      payload: JSON.stringify(rowObj),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(url, options);
    var statusCode = response.getResponseCode();
    var responseText = response.getContentText();

    if (statusCode >= 200 && statusCode < 300) {
      var result = JSON.parse(responseText);
      Logger.log('✅ [onEdit] 同期成功: ' + sellerNumber + ' (' + result.action + ')');
    } else {
      Logger.log('❌ [onEdit] 同期失敗: HTTP ' + statusCode + ' / ' + responseText);
    }

  } catch (err) {
    Logger.log('❌ [onEdit] エラー: ' + err.toString());
    Logger.log(err.stack);
  }
}

/**
 * onEditトリガーを登録する（一度だけ実行する）
 */
function setupOnEditTrigger() {
  // 既存のonSellerRowEditトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onSellerRowEdit') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存のonEditトリガーを削除しました');
    }
  }

  // 新しいonEditトリガーを作成
  ScriptApp.newTrigger('onSellerRowEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();

  Logger.log('✅ onEditトリガーを登録しました（関数: onSellerRowEdit）');
}

/**
 * onEditトリガーのテスト（手動実行用）
 * 指定した売主番号の行データを手動で送信する
 */
function testOnEditSync() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('売主リスト');
  if (!sheet) {
    Logger.log('❌ 売主リストシートが見つかりません');
    return;
  }

  // 2行目（最初のデータ行）をテスト送信
  var testRow = 2;
  var lastCol = sheet.getLastColumn();
  var rowData = sheet.getRange(testRow, 1, 1, lastCol).getValues()[0];
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var rowObj = {};
  for (var i = 0; i < headers.length; i++) {
    var header = String(headers[i]).trim();
    if (header) {
      var val = rowData[i];
      if (val instanceof Date) {
        var y = val.getFullYear();
        var mo = String(val.getMonth() + 1).padStart(2, '0');
        var d = String(val.getDate()).padStart(2, '0');
        rowObj[header] = y + '/' + mo + '/' + d;
      } else {
        rowObj[header] = val !== null && val !== undefined ? String(val) : '';
      }
    }
  }

  Logger.log('テスト送信データ: ' + JSON.stringify(rowObj).substring(0, 200) + '...');

  var url = SELLER_SYNC_CONFIG.BACKEND_URL + '/api/cron/seller-row';
  var options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SELLER_SYNC_CONFIG.CRON_SECRET
    },
    payload: JSON.stringify(rowObj),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  Logger.log('ステータス: ' + response.getResponseCode());
  Logger.log('レスポンス: ' + response.getContentText());
}
