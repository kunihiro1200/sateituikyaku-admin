/**
 * gas_sync_first_tel.js
 *
 * ⚠️ このファイルの内容は gas_seller_complete_code.js に追記すること。
 *
 * 売主リストスプレッドシートのY列（「一番TEL」）を
 * Supabase DB の sellers.first_call_initials カラムへ一括同期する
 * syncFirstTelToDb 関数と、そのヘルパー関数群。
 *
 * 前提: gas_seller_complete_code.js に以下の関数・変数が定義済みであること
 *   - SUPABASE_CONFIG
 *   - rowToObject(headers, rowData)
 *   - formatDateToISO_(value)
 *   - patchSellerToSupabase_(sellerNumber, updateData)
 */

// ============================================================
// ヘルパー関数
// ============================================================

/**
 * 売主番号のバリデーションを行う。
 *
 * 大文字アルファベット2文字 + 1桁以上の数字 の形式（例: AA13501, BB999）
 * に一致する場合のみ true を返す。
 *
 * @param {string} sellerNumber - バリデーション対象の売主番号
 * @returns {boolean} 有効な売主番号であれば true、それ以外は false
 *
 * Requirements: 1.4
 */
function isValidSellerNumber(sellerNumber) {
  // /^[A-Z]{2}\d+$/ に一致するかどうかを返す
  return /^[A-Z]{2}\d+$/.test(sellerNumber);
}

/**
 * 反響日付の値が同期対象レコードかどうかを判定する。
 *
 * formatDateToISO_() で YYYY-MM-DD 形式に変換し、
 * 2026-01-01 以降であれば true を返す。
 * 空欄・null・無効値は false を返す。
 *
 * @param {*} inquiryDateValue - スプレッドシートの「反響日付」セル値
 * @returns {boolean} 2026-01-01 以降であれば true、それ以外は false
 *
 * Requirements: 1.1, 1.2, 1.3
 */
function isTargetRecord(inquiryDateValue) {
  // 空欄・null は対象外
  if (inquiryDateValue === null || inquiryDateValue === undefined || inquiryDateValue === '') {
    return false;
  }

  // formatDateToISO_() で YYYY-MM-DD 形式に変換する
  // 変換できない場合は null が返る想定
  var iso = formatDateToISO_(inquiryDateValue);

  // 変換失敗（null / 空文字）は対象外
  if (!iso) {
    return false;
  }

  // 2026-01-01 以降かどうかを文字列比較で判定
  return iso >= '2026-01-01';
}

/**
 * スプレッドシートの行オブジェクトから DB 更新用データを構築する。
 *
 * rowObj['一番TEL'] が非空文字列であれば { first_call_initials: value } を返す。
 * 空欄・null の場合は { first_call_initials: null } を返す。
 * 返却オブジェクトには first_call_initials キーのみを含む。
 *
 * @param {Object} rowObj - rowToObject() で変換したスプレッドシート行オブジェクト
 * @returns {{ first_call_initials: string|null }} DB 更新用データ
 *
 * Requirements: 2.1, 2.2, 2.3, 5.2
 */
function buildUpdateData(rowObj) {
  var value = rowObj['一番TEL'];

  // 非空文字列かどうかを判定
  // null / undefined / 空文字 はすべて null として扱う
  var firstCallInitials = (value !== null && value !== undefined && value !== '')
    ? String(value)
    : null;

  // first_call_initials キーのみを含むオブジェクトを返す
  return { first_call_initials: firstCallInitials };
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 売主リストスプレッドシートのY列「一番TEL」を
 * Supabase DB の sellers.first_call_initials カラムへ一括同期する。
 *
 * 対象レコード: 反響日付が 2026-01-01 以降かつ売主番号が有効なもの。
 * 既存の syncSellerList とは独立した手動実行専用関数。
 *
 * 前提: gas_seller_complete_code.js に以下が定義済みであること
 *   - rowToObject(headers, rowData)
 *   - formatDateToISO_(value)
 *   - patchSellerToSupabase_(sellerNumber, updateData)
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
function syncFirstTelToDb() {
  // ── 4.1: 開始ログとカウンター初期化 ──────────────────────────
  var startTime = new Date();
  Logger.log('▶ syncFirstTelToDb 開始: ' + startTime.toLocaleString());

  // 処理件数カウンター
  var targetCount  = 0; // フィルタを通過した対象レコード数
  var updatedCount = 0; // DB 更新成功件数
  var skippedCount = 0; // スキップ件数（バリデーション不一致 + 日付対象外）
  var errorCount   = 0; // DB 更新失敗件数

  // ── 4.2: シート取得とデータ読み込み ──────────────────────────
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('売主リスト');

  // シートが存在しない場合は即時終了
  if (!sheet) {
    Logger.log('❌ シート「売主リスト」が見つかりません');
    return;
  }

  // 全データ範囲を取得（ヘッダー行を含む）
  var allValues = sheet.getDataRange().getValues();

  // データが 1 行（ヘッダーのみ）以下の場合は処理不要
  if (allValues.length <= 1) {
    Logger.log('ℹ️ 処理対象のデータ行がありません');
    return;
  }

  // 1 行目をヘッダー、2 行目以降をデータ行として分離
  var headers  = allValues[0];
  var dataRows = allValues.slice(1);

  // ── 4.3: レコードのフィルタリングと DB 更新ループ ─────────────
  for (var i = 0; i < dataRows.length; i++) {
    // 各データ行をヘッダーと対応させてオブジェクトに変換
    var rowObj = rowToObject(headers, dataRows[i]);

    // ① 売主番号バリデーション
    var sellerNumber = rowObj['売主番号'];
    if (!isValidSellerNumber(sellerNumber)) {
      skippedCount++;
      continue;
    }

    // ② 反響日付フィルタ（2026-01-01 以降のみ対象）
    if (!isTargetRecord(rowObj['反響日付'])) {
      skippedCount++;
      continue;
    }

    // フィルタを通過したレコードをカウント
    targetCount++;

    // ③ DB 更新用データを構築（first_call_initials のみ）
    var updateData = buildUpdateData(rowObj);

    // ④ Supabase へ PATCH リクエストを送信
    var result = patchSellerToSupabase_(sellerNumber, updateData);

    // ⑤ 結果を確認してカウントを更新
    if (result && result.success) {
      updatedCount++;
    } else {
      errorCount++;
      var errMsg = (result && result.error) ? result.error : '不明なエラー';
      Logger.log('❌ ' + sellerNumber + ': ' + errMsg);
    }
  }

  // ── 4.4: サマリーログと終了処理 ──────────────────────────────
  var endTime     = new Date();
  var elapsedSec  = ((endTime - startTime) / 1000).toFixed(1);

  Logger.log('');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  Logger.log('✅ syncFirstTelToDb 完了: ' + endTime.toLocaleString());
  Logger.log('⏱ 処理時間: ' + elapsedSec + ' 秒');
  Logger.log('📊 対象レコード数 : ' + targetCount  + ' 件');
  Logger.log('✏️  更新成功件数   : ' + updatedCount + ' 件');
  Logger.log('⏭ スキップ件数   : ' + skippedCount + ' 件');
  Logger.log('⚠️  エラー件数     : ' + errorCount   + ' 件');
  Logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}
