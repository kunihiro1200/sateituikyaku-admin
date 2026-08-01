/**
 * 評価ポイント！スプレッドシート 物件名自動入力 GAS
 * 
 * 【設置手順】
 * 1. スプレッドシート（1319AyjQXSC8APWLvm4vRnuI0z6zezzWOKQQ4cxyZ-5o）を開く
 * 2. 拡張機能 → Apps Script を開く
 * 3. 以下のコードを貼り付ける
 * 4. デプロイ → 新しいデプロイ → ウェブアプリ
 *    - 実行するユーザー: 自分
 *    - アクセスできるユーザー: 全員
 * 5. デプロイして、WebアプリのURLを取得
 * 6. そのURLをフロントエンドのVisitPreparationPopup.tsxに設定する
 * 
 * 【使い方】
 * URL: https://script.google.com/macros/s/{DEPLOY_ID}/exec?property=物件住所&store=fukuoka
 * 
 * パラメータ:
 *   - property: 物件住所（物件：のセルに入力される）
 *   - store: 'fukuoka' または 'oita'
 */

function doGet(e) {
  var property = e.parameter.property || '';
  var store = e.parameter.store || 'oita';
  
  var spreadsheetId = '1319AyjQXSC8APWLvm4vRnuI0z6zezzWOKQQ4cxyZ-5o';
  var ss = SpreadsheetApp.openById(spreadsheetId);
  
  // シート名とgidの対応
  var sheetName, gid;
  if (store === 'fukuoka') {
    sheetName = '評価ポイント　福岡店';
    gid = '26251715';
  } else {
    sheetName = '評価ポイント　大分店';
    gid = '25766722';
  }
  
  var sheet = ss.getSheetByName(sheetName);
  
  if (sheet && property) {
    // B8セルに「物件：物件住所」の形式で書き込む
    // スクリーンショットでは「物件：」がセルに含まれているので、住所のみを追記
    sheet.getRange('B8').setValue('物件：' + property);
    SpreadsheetApp.flush();
  }
  
  // スプレッドシートにリダイレクト
  var redirectUrl = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit?gid=' + gid + '#gid=' + gid;
  
  return HtmlService.createHtmlOutput(
    '<html><head><script>window.location.href="' + redirectUrl + '";</script></head>' +
    '<body>リダイレクト中...</body></html>'
  );
}
