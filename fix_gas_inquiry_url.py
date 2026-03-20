#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GASスクリプトに「査定書作成」シートの反響URL表示ロジックを追加
- G列「反響送付日」とDBの「反響詳細日時」が合致
- E列「物件住所」とDBの「物件住所」が合致
- 上記両方が合致すればH列「反響URL」を表示
"""

filepath = 'gas/seller-sync.gs'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ファイル末尾に追加
new_functions = '''
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
'''

text = text.rstrip() + '\n' + new_functions

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ GASスクリプトに反響URL表示ロジックを追加しました')
