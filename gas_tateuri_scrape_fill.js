/**
 * 建売専門サイトシート - URLから物件情報を自動入力するGASスクリプト
 *
 * スプレッドシート: https://docs.google.com/spreadsheets/d/13C90VsKu-MXhIg8b2z-pC3QTaXaP1NlIqKQGuy-HsjQ/
 * シート名: 建売専門サイト
 *
 * 列構成:
 *   N列: at homeのURL（入力済み）
 *   K列: 会社名（自動入力）
 *   L列: 価格（自動入力）
 *   M列: 物件所在地（自動入力）
 *
 * スクレイピングサーバー: https://sateituikyaku-scrape-server-production.up.railway.app
 */

// ===== 設定 =====
var SCRAPE_API_URL = 'https://sateituikyaku-scrape-server-production.up.railway.app/scrape';
var SHEET_NAME = '建売専門サイト';
var SPREADSHEET_ID = '13C90VsKu-MXhIg8b2z-pC3QTaXaP1NlIqKQGuy-HsjQ';

// 列番号（1始まり）
var COL_URL = 14;       // N列: URL
var COL_COMPANY = 11;   // K列: 会社名
var COL_PRICE = 12;     // L列: 価格
var COL_ADDRESS = 13;   // M列: 物件所在地

// ===== メイン処理 =====

/**
 * N列のURLを読み取り、スクレイピングしてK・L・M列に書き込む
 * 実行方法: GASエディタから「fillPropertyDataFromUrls」を実行
 */
function fillPropertyDataFromUrls() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('シート「' + SHEET_NAME + '」が見つかりません。');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('データがありません。');
    return;
  }

  // 2行目から最終行まで処理（1行目はヘッダー）
  var successCount = 0;
  var skipCount = 0;
  var errorCount = 0;
  var errors = [];

  for (var row = 2; row <= lastRow; row++) {
    var urlCell = sheet.getRange(row, COL_URL);
    var url = urlCell.getValue();

    // URLが空の場合はスキップ
    if (!url || url.toString().trim() === '') {
      continue;
    }

    url = url.toString().trim();

    // at homeのURLでない場合はスキップ
    if (url.indexOf('athome.co.jp') === -1) {
      Logger.log('行 ' + row + ': at homeのURLではないためスキップ: ' + url);
      skipCount++;
      continue;
    }

    // K・L・M列がすでに入力済みの場合はスキップ（上書きしない）
    var companyCell = sheet.getRange(row, COL_COMPANY).getValue();
    var priceCell = sheet.getRange(row, COL_PRICE).getValue();
    var addressCell = sheet.getRange(row, COL_ADDRESS).getValue();

    if (companyCell && priceCell && addressCell) {
      Logger.log('行 ' + row + ': すでに入力済みのためスキップ');
      skipCount++;
      continue;
    }

    Logger.log('行 ' + row + ': スクレイピング開始 - ' + url);

    try {
      var result = scrapeUrl(url);

      if (result.success) {
        // 会社名（K列）
        if (!companyCell && result.company) {
          sheet.getRange(row, COL_COMPANY).setValue(result.company);
        }
        // 価格（L列）
        if (!priceCell && result.price) {
          sheet.getRange(row, COL_PRICE).setValue(result.price);
        }
        // 物件所在地（M列）
        if (!addressCell && result.address) {
          sheet.getRange(row, COL_ADDRESS).setValue(result.address);
        }

        Logger.log('行 ' + row + ': 成功 - 会社名:' + result.company + ' 価格:' + result.price + ' 住所:' + result.address);
        successCount++;
      } else {
        Logger.log('行 ' + row + ': スクレイピング失敗 - ' + result.error);
        errors.push('行' + row + ': ' + result.error);
        errorCount++;
      }

      // サーバー負荷軽減のため1秒待機
      Utilities.sleep(1000);

    } catch (e) {
      Logger.log('行 ' + row + ': エラー - ' + e.message);
      errors.push('行' + row + ': ' + e.message);
      errorCount++;
    }
  }

  // 結果を表示
  var message = '処理完了\n\n'
    + '✅ 成功: ' + successCount + '件\n'
    + '⏭️ スキップ: ' + skipCount + '件\n'
    + '❌ エラー: ' + errorCount + '件';

  if (errors.length > 0) {
    message += '\n\nエラー詳細:\n' + errors.slice(0, 10).join('\n');
    if (errors.length > 10) {
      message += '\n... 他 ' + (errors.length - 10) + '件';
    }
  }

  SpreadsheetApp.getUi().alert(message);
}

/**
 * 選択中の行のURLをスクレイピングして入力する（1行だけテスト実行したい場合）
 */
function fillSelectedRow() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    SpreadsheetApp.getUi().alert('シート「' + SHEET_NAME + '」が見つかりません。');
    return;
  }

  var activeRange = sheet.getActiveRange();
  var row = activeRange.getRow();

  if (row < 2) {
    SpreadsheetApp.getUi().alert('2行目以降の行を選択してください（1行目はヘッダーです）。');
    return;
  }

  var url = sheet.getRange(row, COL_URL).getValue();

  if (!url || url.toString().trim() === '') {
    SpreadsheetApp.getUi().alert('行 ' + row + ' のN列にURLがありません。');
    return;
  }

  url = url.toString().trim();

  SpreadsheetApp.getUi().alert('行 ' + row + ' をスクレイピング中...\nURL: ' + url + '\n\n少々お待ちください。');

  try {
    var result = scrapeUrl(url);

    if (result.success) {
      sheet.getRange(row, COL_COMPANY).setValue(result.company || '');
      sheet.getRange(row, COL_PRICE).setValue(result.price || '');
      sheet.getRange(row, COL_ADDRESS).setValue(result.address || '');

      SpreadsheetApp.getUi().alert(
        '✅ 成功\n\n'
        + '会社名: ' + (result.company || '（取得できませんでした）') + '\n'
        + '価格: ' + (result.price || '（取得できませんでした）') + '\n'
        + '物件所在地: ' + (result.address || '（取得できませんでした）')
      );
    } else {
      SpreadsheetApp.getUi().alert('❌ スクレイピング失敗\n\n' + result.error);
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert('❌ エラー\n\n' + e.message);
  }
}

/**
 * スクレイピングサーバーにURLを送信して物件情報を取得する
 * @param {string} url - at homeの物件URL
 * @returns {Object} { success, company, price, address, error }
 */
function scrapeUrl(url) {
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: url }),
    muteHttpExceptions: true,
    // タイムアウト: 60秒（スクレイピングに時間がかかるため）
  };

  var response = UrlFetchApp.fetch(SCRAPE_API_URL, options);
  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode !== 200) {
    return {
      success: false,
      error: 'HTTPエラー ' + statusCode + ': ' + responseText.substring(0, 200)
    };
  }

  var data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
    return {
      success: false,
      error: 'JSONパースエラー: ' + responseText.substring(0, 200)
    };
  }

  // スクレイピングサーバーのレスポンス形式に合わせてデータを抽出
  // 実際のレスポンス形式: { success: true, slug: "...", data: { title, price, address, ... } }
  var inner = data.data || data;

  // 会社名: titleの中に「提供元：XXX）」という形式で含まれている場合がある
  // 例: "大分市 大字細（坂ノ市駅）...（提供元：Ｙ．コーポレーション(株)　大分中央店）｜..."
  var company = '';
  var title = inner.title || '';
  var providerMatch = title.match(/提供元[：:]\s*([^）\)｜]+)[）\)｜]/);
  if (providerMatch) {
    company = providerMatch[1].trim();
  }

  // 価格
  var price = inner.price || '';
  price = price.toString().trim();

  // 物件所在地
  var address = inner.address || '';
  address = address.toString().trim();

  return {
    success: true,
    company: company,
    price: price,
    address: address
  };
}

/**
 * デバッグ用: 実際のレスポンスをログに出力する
 * GASエディタから「debugScrapeResponse」を実行して、実行ログで確認する
 */
function debugScrapeResponse() {
  // テスト用URL（スプレッドシートの2行目のURLを使用）
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  var url = sheet.getRange(2, COL_URL).getValue().toString().trim();

  Logger.log('テストURL: ' + url);

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: url }),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(SCRAPE_API_URL, options);
  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  Logger.log('ステータスコード: ' + statusCode);
  Logger.log('レスポンス（先頭3000文字）: ' + responseText.substring(0, 3000));

  // JSONパース
  try {
    var data = JSON.parse(responseText);
    Logger.log('--- パース結果 ---');
    var inner = data.data || data;
    Logger.log('title: ' + inner.title);
    Logger.log('price: ' + inner.price);
    Logger.log('address: ' + inner.address);

    // 会社名をtitleから抽出
    var title = inner.title || '';
    var providerMatch = title.match(/提供元[：:]\s*([^）\)｜]+)[）\)｜]/);
    Logger.log('会社名（titleから抽出）: ' + (providerMatch ? providerMatch[1].trim() : '取得できず'));
  } catch (e) {
    Logger.log('JSONパースエラー: ' + e.message);
  }
}

/**
 * カスタムメニューをスプレッドシートに追加する
 * スプレッドシートを開いたときに自動実行される
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🏠 物件情報取得')
    .addItem('全URLをスクレイピング（未入力のみ）', 'fillPropertyDataFromUrls')
    .addItem('選択行をスクレイピング（テスト用）', 'fillSelectedRow')
    .addToUi();
}
