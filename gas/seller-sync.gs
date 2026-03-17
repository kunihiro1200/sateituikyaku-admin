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
