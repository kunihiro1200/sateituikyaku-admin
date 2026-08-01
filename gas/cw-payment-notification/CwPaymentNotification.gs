// ============================================================
// CW支払い通知スクリプト
// 概要:
// - CWカウントシートの5行目（B5〜I5）を1時間ごとに監視
// - 値が10以上になったら tenant@ifoo-oita.com にメール送信
// - 同日中は同じカラムについて再通知しない
// - 翌日も条件を満たしていたら再通知する
//
// セットアップ:
// 1. このスクリプトをGASエディタに貼り付ける
// 2. setupCwPaymentNotificationTrigger() を一度だけ手動実行
// 3. testCwPaymentNotification() で動作確認
// ============================================================

var CW_NOTIFICATION_CONFIG = {
  SPREADSHEET_ID: '1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g',
  SHEET_NAME: 'CWカウント',
  CHECK_ROW: 5,           // 監視する行
  START_COL: 2,           // B列 = 2
  END_COL: 9,             // I列 = 9（山崎様のサイト登録を含む）
  THRESHOLD: 10,          // 通知閾値
  RECIPIENT: 'tenant@ifoo-oita.com',
  SUBJECT: 'CWに支払いと仮契約（新規発注）お願いします',
  // B〜I列の1行目カラム名
  COLUMN_NAMES: {
    2: 'サイト登録',
    3: '間取図（300円）',
    4: '間取図（500円）',
    5: '重説資料取得のみ',
    6: '重説入力のみ',
    7: '重説資料取得・入力',
    8: '間取り図修正',
    9: 'サイト登録（山崎様）'
  }
};

// ============================================================
// メイン通知チェック関数（1時間ごとにトリガーで実行）
// ============================================================
function checkCwPaymentNotification() {
  Logger.log('=== CW支払い通知チェック開始 ===');

  try {
    var ss = SpreadsheetApp.openById(CW_NOTIFICATION_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CW_NOTIFICATION_CONFIG.SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: シート「' + CW_NOTIFICATION_CONFIG.SHEET_NAME + '」が見つかりません');
      return;
    }

    // B5〜I5の値を取得
    var range = sheet.getRange(
      CW_NOTIFICATION_CONFIG.CHECK_ROW,
      CW_NOTIFICATION_CONFIG.START_COL,
      1,
      CW_NOTIFICATION_CONFIG.END_COL - CW_NOTIFICATION_CONFIG.START_COL + 1
    );
    var values = range.getValues()[0];

    // 今日の日付（YYYY-MM-DD形式）
    var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');

    // PropertiesServiceで通知済み情報を管理
    var props = PropertiesService.getScriptProperties();
    var notifiedKey = 'cw_payment_notified';
    var notifiedData = {};

    try {
      var stored = props.getProperty(notifiedKey);
      if (stored) {
        notifiedData = JSON.parse(stored);
      }
    } catch (e) {
      notifiedData = {};
    }

    // 通知対象のカラムを収集
    var columnsToNotify = [];

    for (var i = 0; i < values.length; i++) {
      var colIndex = CW_NOTIFICATION_CONFIG.START_COL + i; // 2〜9
      var value = parseFloat(values[i]);

      if (isNaN(value) || value < CW_NOTIFICATION_CONFIG.THRESHOLD) {
        continue;
      }

      var colKey = 'col_' + colIndex;

      // 同日中に既に通知済みならスキップ
      if (notifiedData[colKey] === today) {
        Logger.log('スキップ（本日通知済み）: ' + CW_NOTIFICATION_CONFIG.COLUMN_NAMES[colIndex] + ' = ' + value);
        continue;
      }

      // 通知対象に追加
      columnsToNotify.push({
        colIndex: colIndex,
        colName: CW_NOTIFICATION_CONFIG.COLUMN_NAMES[colIndex],
        value: value
      });
    }

    // 通知対象がなければ終了
    if (columnsToNotify.length === 0) {
      Logger.log('通知対象なし');
      Logger.log('=== CW支払い通知チェック完了 ===');
      return;
    }

    // メール送信（対象カラムごとに1通ずつ）
    for (var j = 0; j < columnsToNotify.length; j++) {
      var item = columnsToNotify[j];

      var body = item.colName + 'の支払いをCWにお願いします\n\n' +
        '間取図関係：https://crowdworks.jp/r/contracts?employee_user_id=5931646\n' +
        'サイト登録関係：https://crowdworks.jp/r/contracts?employee_user_id=5746943\n\n' +
        '必ず仮契約も終わらせてください。';

      MailApp.sendEmail({
        to: CW_NOTIFICATION_CONFIG.RECIPIENT,
        subject: CW_NOTIFICATION_CONFIG.SUBJECT,
        body: body
      });

      Logger.log('メール送信完了: ' + item.colName + ' (値: ' + item.value + ')');

      // 通知済みとして記録（今日の日付）
      notifiedData['col_' + item.colIndex] = today;
    }

    // 通知済み情報を保存
    props.setProperty(notifiedKey, JSON.stringify(notifiedData));

    Logger.log('=== CW支払い通知チェック完了（' + columnsToNotify.length + '件送信）===');

  } catch (e) {
    Logger.log('ERROR: ' + e.toString());
    Logger.log(e.stack);
  }
}

// ============================================================
// トリガー設定（一度だけ手動実行）
// ============================================================
function setupCwPaymentNotificationTrigger() {
  // 既存のトリガーを削除
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'checkCwPaymentNotification') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存のCW支払い通知トリガーを削除しました');
    }
  }

  // 1時間ごとのトリガーを作成
  ScriptApp.newTrigger('checkCwPaymentNotification')
    .timeBased()
    .everyHours(1)
    .create();

  Logger.log('トリガーを設定しました: 1時間ごとに checkCwPaymentNotification() を実行');
}

// ============================================================
// テスト用（手動実行で動作確認）
// ============================================================
function testCwPaymentNotification() {
  Logger.log('=== CW支払い通知テスト ===');
  checkCwPaymentNotification();
  Logger.log('=== テスト完了 ===');
}

// ============================================================
// 通知履歴リセット（デバッグ用・手動実行）
// ============================================================
function resetCwPaymentNotificationHistory() {
  var props = PropertiesService.getScriptProperties();
  props.deleteProperty('cw_payment_notified');
  Logger.log('CW支払い通知履歴をリセットしました');
}
