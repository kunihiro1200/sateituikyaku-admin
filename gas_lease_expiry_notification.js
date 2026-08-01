/**
 * リースバック期限通知スクリプト（GAS用）
 * 
 * 機能: 入金確認表(リースバック)の各物件の期限を確認し、
 *       2ヶ月前になったらメール通知を送信する
 * 
 * 設定方法:
 * 1. スプレッドシートを開く
 * 2. 拡張機能 → Apps Script
 * 3. このコードを貼り付け
 * 4. SPREADSHEET_ID を設定（URLの /d/ と /edit の間の文字列）
 * 5. トリガーを設定（毎日1回実行）
 */

// ===== 設定 =====
const CONFIG = {
  SHEET_NAME: '入金確認表(リースバック)', // シート名（必要に応じて変更）
  NOTIFY_EMAIL: 'tenant@ifoo-oita.com',
  MONTHS_BEFORE: 2, // 何ヶ月前に通知するか
  START_ROW: 4, // データ開始行（ヘッダーを除く）
  COL_A: 1, // A列（物件名・期限情報）
  COL_B: 2, // B列（オーナー情報）
};

/**
 * メイン関数: 期限チェック＆メール送信
 * トリガーで毎日実行する
 */
function checkLeaseExpiry() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheets()[0]; // 最初のシートを使用（シート名で取得する場合は下のコメントを使用）
  // const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  
  if (!sheet) {
    Logger.log('シートが見つかりません: ' + CONFIG.SHEET_NAME);
    return;
  }
  
  const lastRow = sheet.getLastRow();
  const today = new Date();
  const notifyProperties = [];
  
  for (let row = CONFIG.START_ROW; row <= lastRow; row++) {
    const cellA = sheet.getRange(row, CONFIG.COL_A).getValue();
    if (!cellA) continue;
    
    const cellText = String(cellA);
    
    // 期限日を抽出
    const expiryDate = extractExpiryDate(cellText);
    if (!expiryDate) continue;
    
    // 2ヶ月前の日付を計算
    const notifyDate = new Date(expiryDate);
    notifyDate.setMonth(notifyDate.getMonth() - CONFIG.MONTHS_BEFORE);
    
    // 通知期間内かチェック（通知日 <= 今日 < 期限日）
    if (today >= notifyDate && today < expiryDate) {
      // 物件名を抽出（最初の行）
      const propertyName = cellText.split('\n')[0] || cellText.substring(0, 20);
      
      // オーナー情報を取得
      const ownerInfo = String(sheet.getRange(row, CONFIG.COL_B).getValue() || '');
      
      notifyProperties.push({
        propertyName: propertyName,
        ownerInfo: ownerInfo,
        expiryDate: expiryDate,
        cellText: cellText,
        row: row,
      });
    }
  }
  
  // 通知対象があればメール送信
  if (notifyProperties.length > 0) {
    sendNotificationEmail(notifyProperties);
    Logger.log(notifyProperties.length + '件の期限通知メールを送信しました');
  } else {
    Logger.log('通知対象の物件はありません');
  }
}

/**
 * A列のテキストから期限日を抽出する
 * 対応パターン:
 * - 「最終年月：27年3月」（和暦）
 * - 「終了年月：2033年4月終了」（西暦）
 * - 「2029年10月最終」（西暦）
 * - 「最終年月：2027年3月」（西暦）
 */
function extractExpiryDate(text) {
  // パターン1: 「最終年月：27年3月」「最終年月：27年3月」（和暦 - 令和として扱う）
  let match = text.match(/最終年月[：:]?\s*(\d{1,2})年(\d{1,2})月/);
  if (match) {
    const year = convertWarekiToSeireki(parseInt(match[1]));
    const month = parseInt(match[2]);
    return new Date(year, month - 1, 1); // 月初を期限とする
  }
  
  // パターン2: 「終了年月：2033年4月終了」「終了年月：2033年4月」（西暦）
  match = text.match(/終了年月[：:]?\s*(\d{4})年(\d{1,2})月/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    return new Date(year, month - 1, 1);
  }
  
  // パターン3: 「2029年10月最終」（西暦 + 最終）
  match = text.match(/(\d{4})年(\d{1,2})月最終/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    return new Date(year, month - 1, 1);
  }
  
  // パターン4: 「最終年月：2027年3月」（西暦）
  match = text.match(/最終年月[：:]?\s*(\d{4})年(\d{1,2})月/);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]);
    return new Date(year, month - 1, 1);
  }
  
  // パターン5: 「令和9年3月」のような表記
  match = text.match(/令和(\d{1,2})年(\d{1,2})月/);
  if (match) {
    const year = 2018 + parseInt(match[1]); // 令和1年 = 2019年
    const month = parseInt(match[2]);
    return new Date(year, month - 1, 1);
  }
  
  return null;
}

/**
 * 和暦（令和）を西暦に変換
 * 例: 27 → 2045（令和27年）、7 → 2025（令和7年）
 * 
 * 注意: 画像の「27年3月」は「令和27年」ではなく「2027年3月」の可能性が高い
 * その場合は下のロジックを調整してください
 */
function convertWarekiToSeireki(warekiYear) {
  // 「27年」のような表記が2027年を意味する場合（20XX年の省略）
  if (warekiYear >= 20 && warekiYear <= 99) {
    return 2000 + warekiYear;
  }
  // 令和として扱う場合（令和1年 = 2019年）
  return 2018 + warekiYear;
}

/**
 * 通知メールを送信
 */
function sendNotificationEmail(properties) {
  const subject = '【リースバック期限通知】' + properties.length + '件の契約が期限に近づいています';
  
  let body = 'リースバック契約の期限通知です。\n';
  body += '以下の物件が期限の2ヶ月前に達しています。\n\n';
  body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  
  properties.forEach((prop, index) => {
    const expiryStr = Utilities.formatDate(prop.expiryDate, 'Asia/Tokyo', 'yyyy年M月');
    body += '【' + (index + 1) + '】 ' + prop.propertyName + '\n';
    body += '  オーナー: ' + prop.ownerInfo + '\n';
    body += '  期限: ' + expiryStr + '\n';
    body += '  （行番号: ' + prop.row + '）\n\n';
  });
  
  body += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  body += '※ このメールは自動送信です。\n';
  body += '※ スプレッドシートで詳細を確認してください。\n';
  
  GmailApp.sendEmail(CONFIG.NOTIFY_EMAIL, subject, body);
}

/**
 * トリガーを設定する関数（初回のみ手動実行）
 * 毎日午前9時に実行
 */
function createDailyTrigger() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'checkLeaseExpiry') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // 毎日午前9時に実行するトリガーを作成
  ScriptApp.newTrigger('checkLeaseExpiry')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();
  
  Logger.log('トリガーを設定しました: 毎日午前9時に実行');
}

/**
 * テスト用: 手動で実行して動作確認
 */
function testCheckExpiry() {
  // テスト用のテキストで期限抽出をテスト
  const testCases = [
    '宮崎台戸建\n2023/3/24決済\n担当：和田\n080-9868-0888\n最終年月：27年3月',
    '高崎戸建\n担当：山本\n080-1737-6752\n2023年4月契約\n終了年月：2033年4月終了',
    '鉄輪戸建\n担当：河野\n09064275991\n2024年10月契約\n2029年10月最終',
  ];
  
  testCases.forEach(text => {
    const date = extractExpiryDate(text);
    Logger.log(text.split('\n')[0] + ' → ' + (date ? Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy年M月') : '抽出失敗'));
  });
  
  // 実際のチェックも実行
  checkLeaseExpiry();
}
