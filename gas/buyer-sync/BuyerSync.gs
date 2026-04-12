/**
 * 買主リスト同期スクリプト（GAS → Supabase直接書き込み）
 *
 * 概要:
 * - スプレッドシートの「買主リスト」シートを読み込み
 * - Supabase の buyers テーブルに upsert（buyer_number をキーに）
 * - 10分ごとのトリガーで自動実行
 *
 * ※ 同一GASプロジェクト内の他スクリプトと関数名が衝突しないよう
 *   全ての変数・関数名に BUYER_ / buyer_ プレフィックスを付けています
 */

// ============================================================
// 設定
// ============================================================
var BUYER_CONFIG = {
  SPREADSHEET_ID: '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY',
  SHEET_NAME: '買主リスト',
  SUPABASE_URL: 'https://krxhrbtlgfjzsseegaqq.supabase.co',
  SUPABASE_SERVICE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyeGhyYnRsZ2ZqenNzZWVnYXFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzAyMTQxMSwiZXhwIjoyMDc4NTk3NDExfQ.nog3UX9J9OgfqlCIPJt_sU_exE6Ny-nSj_HmwgV3oA8',
  TABLE_NAME: 'buyers',
  BATCH_SIZE: 100,
  SYNC_INTERVAL_MINUTES: 15,
  BACKEND_URL: 'https://sateituikyaku-admin-backend.vercel.app',
  CRON_SECRET: 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s='
};

// ============================================================
// カラムマッピング（buyer-column-mapping.json と同期）
// spreadsheetToDatabase + spreadsheetToDatabaseExtended の全フィールドを含む
// ============================================================
var BUYER_COLUMN_MAPPING = {
  // === spreadsheetToDatabase ===
  '削除': 'is_deleted',
  '作成日時': 'created_datetime',
  '初動担当': 'initial_assignee',
  '買主ID': 'buyer_id',
  '買主番号': 'buyer_number',
  '受付日': 'reception_date',
  '●氏名・会社名': 'name',
  '建物名/価格 内覧物件は赤表示（★は他社物件）': 'building_name_price',
  '●内覧日(最新）': 'viewing_date',
  '●希望時期': 'desired_timing',
  '後続担当': 'follow_up_assignee',
  '再問合\n（内覧）': 're_inquiry_viewing',
  '●問合時ヒアリング': 'inquiry_hearing',
  '★内覧結果・後続対応': 'viewing_result_follow_up',
  '●問合時確度': 'inquiry_confidence',
  '★最新状況\n': 'latest_status',
  '配信種別': 'distribution_type',
  '★次電日': 'next_call_date',
  'Pinrich': 'pinrich',
  '★エリア': 'desired_area',
  '★希望種別': 'desired_property_type',
  '内覧後売主連絡': 'post_viewing_seller_contact',
  '★築年数': 'desired_building_age',
  '★間取り': 'desired_floor_plan',
  '★温泉あり': 'hot_spring_required',
  '●P台数': 'parking_spaces',
  '★月極でも可': 'monthly_parking_ok',
  '★庭付き': 'garden_required',
  '★眺望良好': 'good_view_required',
  '★ペット可': 'pet_allowed_required',
  '★高層階': 'high_floor_required',
  '★角部屋': 'corner_room_required',
  '内覧シート': 'viewing_sheet',
  'LINE': 'line_id',
  'ニックネーム': 'nickname',
  '●電話番号\n（ハイフン不要）': 'phone_number',
  '●メアド': 'email',
  '●問合せ元': 'inquiry_source',
  '現住居': 'current_residence',
  'athome URL': 'athome_url',
  '2度目以降過去内覧': 'past_viewing_1',
  'キャンペーン　1500万円以上\n（渡した日）': 'campaign_date',
  '電話番号重複件数': 'phone_duplicate_count',
  '物件番号': 'property_number',
  '物件担当者': 'property_assignee',
  'パノラマ削除': 'panorama_deleted',
  'a': 'column_a',
  'メアド確認': 'email_confirmed',
  '物件所在地': 'property_address',
  '公開/非公開': 'public_private',

  // === spreadsheetToDatabaseExtended ===
  '曜日': 'day_of_week',
  '売却チャンス': 'sale_chance',
  '特記事項': 'special_notes',
  '内覧アンケート回答': 'viewing_survey_response',
  '内覧アンケート確認': 'viewing_survey_confirmed',
  '担当への伝言/質問事項': 'message_to_assignee',
  '山本へチャット送信': 'chat_to_yamamoto',
  '裏へチャット送信': 'chat_to_ura',
  '内覧形態': 'viewing_type',
  '担当への確認事項': 'confirmation_to_assignee',
  '買付コメント（任意）': 'offer_comment',
  '価格帯（戸建）': 'price_range_house',
  '価格帯（マンション）': 'price_range_apartment',
  '価格帯（土地）': 'price_range_land',
  '買付外れた後連絡未/済': 'post_offer_lost_contact',
  '●時間': 'viewing_time',
  '住居表示': 'display_address',
  '価格': 'price',
  '通知送信者': 'notification_sender',
  '●初見': 'first_view',
  '予算': 'budget',
  '買付外れチャット': 'offer_lost_chat',
  '●売主に内覧連絡　未/済': 'seller_viewing_contact',
  '●買主に内覧連絡　未/済': 'buyer_viewing_contact',
  '過去買主リスト': 'past_buyer_list',
  '過去の問合時コメントと物件': 'past_inquiry_comment_property',
  '過去の最新確度': 'past_latest_confidence',
  '過去の内覧物件': 'past_viewing_properties',
  '過去個人情報': 'past_personal_info',
  '過去希望条件': 'past_desired_conditions',
  '買付外れコメント': 'offer_lost_comment',
  '担当出勤曜日': 'assignee_work_days',
  '内覧前伝達事項': 'pre_viewing_notes',
  '鍵等': 'key_info',
  '売却理由': 'sale_reason',
  '値下げ履歴': 'price_reduction_history',
  '内覧の時の伝達事項': 'viewing_notes',
  '駐車場': 'parking',
  '内覧時駐車場': 'viewing_parking',
  '買付（物件シート）': 'offer_property_sheet',
  'Pinrichリンク': 'pinrich_link',
  '内覧未確定': 'viewing_unconfirmed',
  '内覧問合進捗': 'viewing_inquiry_progress',
  '【問合メール】電話対応': 'inquiry_email_phone',
  '【問合メール】メール返信': 'inquiry_email_reply',
  'メール種別': 'email_type',
  '業者問合せ': 'broker_inquiry',
  '内覧時カレンダー追記': 'viewing_calendar_note',
  '資料請求メール（戸、マ）': 'document_request_email_house',
  '資料請求メール（土）許可不要': 'document_request_email_land_no_permission',
  '資料請求メール（土）売主へ要許可': 'document_request_email_land_permission',
  '買付あり内覧NG': 'offer_exists_viewing_ng',
  '買付あり内覧OK': 'offer_exists_viewing_ok',
  '前回問合せ後反応なし': 'no_response_after_inquiry',
  '前回問合せ後反応なし（買付あり物件）': 'no_response_offer_exists',
  '物件指定なし問合せ（Pinrich)': 'no_property_inquiry_pinrich',
  'メールアドレス確認メール': 'email_confirmation_mail',
  '民泊問合せ': 'minpaku_inquiry',
  '内覧促進メール送信者': 'viewing_promotion_sender',
  'メアド確認メール担当': 'email_confirmation_assignee',
  '他社物件': 'other_company_property',
  '買付有無': 'offer_status',
  '画像': 'image_url',
  '内覧理由': 'viewing_reason',
  '家族構成': 'family_composition',
  '購入する物件の譲れない点（優先順位）': 'must_have_points',
  'この物件の気に入っている点': 'liked_points',
  'この物件のダメな点': 'disliked_points',
  '購入時障害となる点': 'purchase_obstacles',
  'クロージング': 'closing',
  '連絡のつきやすい曜日・時間帯': 'preferred_contact_time',
  '次のアクション': 'next_action',
  '仮審査': 'pre_approval',
  '流入元確認（電話）': 'inflow_source_phone',
  '画像チャット送信': 'image_chat_sent',
  '内覧アンケート結果': 'viewing_survey_result',
  'b客の追客': 'b_customer_follow_up',
  'PDF': 'pdf_url',
  '内覧促進メール結果': 'viewing_promotion_result',
  'データ更新': 'data_updated',
  'キャンペーン該当/未': 'campaign_applicable',
  '法人名': 'company_name',
  '他気になる物件ヒアリング': 'other_property_hearing',
  '問合時持家ヒアリング': 'owned_home_hearing_inquiry',
  '持家ヒアリング結果': 'owned_home_hearing_result',
  '買主コピー': 'buyer_copy',
  '要査定': 'valuation_required',
  '種別': 'property_type',
  '所在地': 'location',
  '現況': 'current_status',
  '土地面積（不明の場合は空欄）': 'land_area',
  '建物面積（不明の場合は空欄）': 'building_area',
  '間取り': 'floor_plan',
  '築年（西暦）': 'build_year',
  'リフォーム履歴（その他太陽光等も）': 'renovation_history',
  '構造': 'structure',
  '階数': 'floor_count',
  '他に査定したことある？': 'other_valuation_done',
  '名義人': 'owner_name',
  'ローン残': 'loan_balance',
  '訪問/机上': 'visit_desk',
  '売主リストコピー': 'seller_list_copy',
  '売主コピー': 'seller_copy',
  '他社名': 'other_company_name',
  '3回架電確認済み': 'three_calls_confirmed',
  '物件探し/業者決めで参照': 'property_search_reference',
  '内覧促進メール不要': 'viewing_promotion_not_needed',
  '①先着順…': 'first_come_first_served',
  '②相場の参考に…': 'market_reference',
  '③スムーズ…': 'smooth_process',
  '【メアド】効果検証': 'email_effect_verification',
  '武内へメール送信': 'email_to_takeuchi',
  '角井へメール送信': 'email_to_kadoi',
  '廣瀬さんから事務へ': 'hirose_to_office',
  '査定が不要な理由': 'valuation_not_needed_reason',
  'GoogleMap': 'google_map_url',
  '内覧コメント確認': 'viewing_comment_confirmed',
  '国広へチャット送信': 'chat_to_kunihiro',
  '内覧形態_一般媒介': 'viewing_type_general',
  '公開前に決定すること多いよ文言': 'pre_release_decision_text',
  '売主内覧日連絡': 'seller_viewing_date_contact',
  '売主キャンセル連絡': 'seller_cancel_contact',
  '持家ヒアリング': 'owned_home_hearing',
  '査定アンケート': 'valuation_survey',
  '査定アンケート確認': 'valuation_survey_confirmed',
  '内覧前ヒアリング': 'pre_viewing_hearing',
  '内覧前ヒアリング送る？': 'pre_viewing_hearing_send',
  '業者向けアンケート': 'vendor_survey'
};

// 型変換ルール
var BUYER_TYPE_CONVERSIONS = {
  'created_datetime': 'datetime',
  'reception_date': 'date',
  'viewing_date': 'date',
  'next_call_date': 'date',
  'campaign_date': 'date',
  'phone_duplicate_count': 'number',
  'price': 'number',
  'land_area': 'number',
  'building_area': 'number',
  'build_year': 'number',
  'floor_count': 'number',
  'loan_balance': 'number',
  'budget': 'number'
};

// ============================================================
// ハッシュ差分検知ユーティリティ
// ============================================================

// PropertiesServiceの1プロパティあたり9KB上限対策：分割保存
var BUYER_HASH_KEY_PREFIX = 'buyer_row_hashes_';
var BUYER_HASH_CHUNK_SIZE = 500; // 1チャンクあたりの買主数

/**
 * 分割保存されたハッシュを全チャンク読み込んでマージして返す
 */
function buyerLoadRowHashes_(props) {
  var merged = {};
  var chunkIndex = 0;
  while (true) {
    var key = BUYER_HASH_KEY_PREFIX + chunkIndex;
    var json = props.getProperty(key);
    if (!json) break;
    try {
      var chunk = JSON.parse(json);
      var keys = Object.keys(chunk);
      for (var i = 0; i < keys.length; i++) {
        merged[keys[i]] = chunk[keys[i]];
      }
    } catch (e) {
      Logger.log('ハッシュ読み込みエラー (chunk ' + chunkIndex + '): ' + e.toString());
    }
    chunkIndex++;
  }
  // 旧形式（単一キー）からの移行
  var legacyJson = props.getProperty('buyer_row_hashes');
  if (legacyJson) {
    try {
      var legacy = JSON.parse(legacyJson);
      var legacyKeys = Object.keys(legacy);
      for (var j = 0; j < legacyKeys.length; j++) {
        if (!merged[legacyKeys[j]]) merged[legacyKeys[j]] = legacy[legacyKeys[j]];
      }
      props.deleteProperty('buyer_row_hashes');
      Logger.log('旧形式ハッシュを移行しました（' + legacyKeys.length + '件）');
    } catch (e) {}
  }
  return merged;
}

/**
 * ハッシュをチャンク分割してPropertiesServiceに保存する
 */
function buyerSaveRowHashes_(props, hashes) {
  var keys = Object.keys(hashes);
  var chunkIndex = 0;
  for (var i = 0; i < keys.length; i += BUYER_HASH_CHUNK_SIZE) {
    var chunk = {};
    var end = Math.min(i + BUYER_HASH_CHUNK_SIZE, keys.length);
    for (var j = i; j < end; j++) {
      chunk[keys[j]] = hashes[keys[j]];
    }
    props.setProperty(BUYER_HASH_KEY_PREFIX + chunkIndex, JSON.stringify(chunk));
    chunkIndex++;
  }
  // 余分な古いチャンクを削除
  while (true) {
    var oldKey = BUYER_HASH_KEY_PREFIX + chunkIndex;
    if (!props.getProperty(oldKey)) break;
    props.deleteProperty(oldKey);
    chunkIndex++;
  }
}

/**
 * 行データのハッシュ文字列を生成（差分検知用）
 * 全カラムの値を結合して前回との比較に使用する
 */
function buyerBuildRowHash_(headers, row) {
  var parts = [];
  for (var i = 0; i < headers.length; i++) {
    var val = row[i];
    if (val instanceof Date) {
      parts.push(isNaN(val.getTime()) ? '' : val.toISOString());
    } else {
      parts.push(val !== null && val !== undefined ? String(val) : '');
    }
  }
  return parts.join('|');
}

// ============================================================
// メイン同期関数（トリガーから呼び出される）
// ============================================================
function syncBuyers() {
  var startTime = new Date();
  Logger.log('=== 買主同期開始: ' + startTime.toISOString() + ' ===');

  try {
    var ss = SpreadsheetApp.openById(BUYER_CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(BUYER_CONFIG.SHEET_NAME);
    if (!sheet) {
      Logger.log('ERROR: シート「' + BUYER_CONFIG.SHEET_NAME + '」が見つかりません');
      return;
    }

    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      Logger.log('データなし（ヘッダー行のみ）');
      return;
    }

    Logger.log('データ行数: ' + (lastRow - 1));

    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var rawValues = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

    // ハッシュ差分検知: 変更行のみ抽出
    var props = PropertiesService.getScriptProperties();
    var prevHashes = buyerLoadRowHashes_(props);
    var newHashes = {};

    var records = [];
    var skippedCount = 0;
    var unchangedCount = 0;

    // buyer_number列のインデックスを事前に取得
    var buyerNumberColIndex = -1;
    for (var h = 0; h < headers.length; h++) {
      if (headers[h] === '買主番号') { buyerNumberColIndex = h; break; }
    }

    for (var i = 0; i < rawValues.length; i++) {
      var buyerNum = buyerNumberColIndex >= 0 ? String(rawValues[i][buyerNumberColIndex] || '').trim() : '';
      if (!buyerNum) {
        skippedCount++;
        continue;
      }

      var hash = buyerBuildRowHash_(headers, rawValues[i]);
      newHashes[buyerNum] = hash;

      // 前回と同じハッシュならスキップ
      if (prevHashes[buyerNum] === hash) {
        unchangedCount++;
        continue;
      }

      var record = buyerMapRowToRecord(headers, rawValues[i]);
      if (!record.buyer_number) {
        skippedCount++;
        continue;
      }
      record.last_synced_at = new Date().toISOString();
      delete record.db_updated_at;
      records.push(record);
    }

    Logger.log('変更検知: ' + records.length + '件 / 変更なし: ' + unchangedCount + '件 / スキップ: ' + skippedCount + '件');

    var sidebarUpdateNeeded = records.length > 0;

    if (records.length === 0) {
      Logger.log('変更なし、upsertをスキップ');
    } else {
      // PGRST102対策: 全レコードのキーを統一
      var allKeys = {};
      for (var k = 0; k < records.length; k++) {
        var keys = Object.keys(records[k]);
        for (var m = 0; m < keys.length; m++) {
          allKeys[keys[m]] = true;
        }
      }
      var allKeysList = Object.keys(allKeys);
      for (var k = 0; k < records.length; k++) {
        for (var m = 0; m < allKeysList.length; m++) {
          if (!(allKeysList[m] in records[k])) {
            records[k][allKeysList[m]] = null;
          }
        }
      }

      var successCount = 0;
      var errorCount = 0;
      var failedBuyerNumbers = [];

      for (var j = 0; j < records.length; j += BUYER_CONFIG.BATCH_SIZE) {
        var batch = records.slice(j, j + BUYER_CONFIG.BATCH_SIZE);
        var result = buyerUpsertToSupabase(batch);
        if (result.success) {
          successCount += batch.length;
          Logger.log('バッチ ' + (Math.floor(j / BUYER_CONFIG.BATCH_SIZE) + 1) + ': ' + batch.length + '件 upsert成功');
        } else {
          errorCount += batch.length;
          Logger.log('バッチ ' + (Math.floor(j / BUYER_CONFIG.BATCH_SIZE) + 1) + ': エラー - ' + result.error);
          // 失敗したバッチの買主番号を記録（ハッシュを更新しない）
          for (var b = 0; b < batch.length; b++) {
            if (batch[b].buyer_number) failedBuyerNumbers.push(batch[b].buyer_number);
          }
        }
        if (j + BUYER_CONFIG.BATCH_SIZE < records.length) {
          Utilities.sleep(500);
        }
      }

      // 失敗した行はハッシュを前回値に戻す（次回リトライ）
      for (var f = 0; f < failedBuyerNumbers.length; f++) {
        var fn = failedBuyerNumbers[f];
        newHashes[fn] = prevHashes[fn] || '';
      }

      var duration = (new Date() - startTime) / 1000;
      Logger.log('=== 同期完了: 成功=' + successCount + ', エラー=' + errorCount + ', 所要時間=' + duration + '秒 ===');
    }

    // ハッシュを保存（次回の差分検知に使用）
    buyerSaveRowHashes_(props, newHashes);

    // 変更があった場合のみサイドバーカウントを再計算
    if (sidebarUpdateNeeded) {
      try {
        var sidebarUrl = BUYER_CONFIG.BACKEND_URL + '/api/buyers/update-sidebar-counts';
        var sidebarOptions = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + BUYER_CONFIG.CRON_SECRET
          },
          payload: JSON.stringify({}),
          muteHttpExceptions: true
        };
        var sidebarRes = UrlFetchApp.fetch(sidebarUrl, sidebarOptions);
        if (sidebarRes.getResponseCode() >= 200 && sidebarRes.getResponseCode() < 300) {
          var sidebarResult = JSON.parse(sidebarRes.getContentText());
          Logger.log('✅ サイドバーカウント更新成功: ' + (sidebarResult.rowsInserted || 0) + '件');
        } else {
          Logger.log('❌ サイドバーカウント更新失敗: HTTP ' + sidebarRes.getResponseCode());
        }
      } catch (sidebarErr) {
        Logger.log('❌ サイドバーカウント更新エラー: ' + sidebarErr.toString());
      }
    }

  } catch (e) {
    Logger.log('ERROR: 予期しないエラー - ' + e.toString());
    Logger.log(e.stack);
  }
}

// ============================================================
// スプレッドシート行 → DBレコード変換
// ============================================================
function buyerMapRowToRecord(headers, row) {
  var record = {};
  for (var i = 0; i < headers.length; i++) {
    var dbColumn = BUYER_COLUMN_MAPPING[headers[i]];
    if (!dbColumn) continue;
    var converted = buyerConvertValue(dbColumn, row[i]);
    // 空欄はスキップ（nullでDBの既存値を上書きしない）
    // 例外1: buyer_numberは必須なので常に書き込む
    // 例外2: vendor_survey（業者向けアンケート）は空欄時にnullで上書きする
    //        （スプシ空欄 → DBの既存値「未」が残るバグを防ぐため）
    // 例外3: notification_sender（通知送信者）は空欄時にnullで上書きする
    //        （スプシで消した場合にDBに反映されないと「内覧日前日」カテゴリーから除外されないため）
    if (converted === null && dbColumn !== 'buyer_number' && dbColumn !== 'vendor_survey' && dbColumn !== 'notification_sender') continue;
    record[dbColumn] = converted;
  }
  return record;
}

// ============================================================
// 型変換
// ============================================================
function buyerConvertValue(column, value) {
  if (value === null || value === undefined || value === '') return null;

  var type = BUYER_TYPE_CONVERSIONS[column];
  if (type === 'date') return buyerParseDate(value);
  if (type === 'datetime') return buyerParseDatetime(value);
  if (type === 'number') return buyerParseNumber(value);

  var str = String(value).trim();
  return str === '' ? null : str;
}

function buyerParseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.getFullYear() + '-' +
      String(value.getMonth() + 1).padStart(2, '0') + '-' +
      String(value.getDate()).padStart(2, '0');
  }

  if (typeof value === 'number') {
    var date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    if (isNaN(date.getTime())) return null;
    return date.getUTCFullYear() + '-' +
      String(date.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(date.getUTCDate()).padStart(2, '0');
  }

  var str = String(value).trim();
  if (!str) return null;

  var match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (match) return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');

  var match2 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (match2) return match2[3] + '-' + match2[1].padStart(2, '0') + '-' + match2[2].padStart(2, '0');

  return null;
}

function buyerParseDatetime(value) {
  if (!value) return null;
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null;
    return value.toISOString();
  }
  var str = String(value).trim();
  if (!str) return null;
  var match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0') +
      'T' + match[4].padStart(2, '0') + ':' + match[5] + ':' + (match[6] || '00');
  }
  return null;
}

function buyerParseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  var str = String(value).replace(/[,，円￥\s]/g, '').trim();
  if (!str) return null;
  var num = parseFloat(str);
  return isNaN(num) ? null : num;
}

// ============================================================
// Supabase upsert（バルクPOST方式 - 1リクエストで複数件upsert）
// Prefer: resolution=merge-duplicates でupsert
// ============================================================
function buyerUpsertToSupabase(records) {
  var baseUrl = BUYER_CONFIG.SUPABASE_URL + '/rest/v1/' + BUYER_CONFIG.TABLE_NAME;
  
  if (records.length === 0) return { success: true };
  
  try {
    var response = UrlFetchApp.fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': BUYER_CONFIG.SUPABASE_SERVICE_KEY,
        'Authorization': 'Bearer ' + BUYER_CONFIG.SUPABASE_SERVICE_KEY,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      payload: JSON.stringify(records),
      muteHttpExceptions: true
    });
    
    var code = response.getResponseCode();
    if (code >= 200 && code < 300) {
      return { success: true };
    } else {
      var body = response.getContentText().substring(0, 500);
      Logger.log('バルクUPSERT失敗: HTTP ' + code + ' ' + body);
      return { success: false, error: 'HTTP ' + code + ': ' + body };
    }
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

// ============================================================
// トリガー設定（一度だけ手動実行）
// ============================================================
function buyerSetupTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'syncBuyers') {
      ScriptApp.deleteTrigger(triggers[i]);
      Logger.log('既存トリガーを削除しました');
    }
  }
  ScriptApp.newTrigger('syncBuyers')
    .timeBased()
    .everyMinutes(BUYER_CONFIG.SYNC_INTERVAL_MINUTES)
    .create();
  Logger.log('トリガーを設定しました: ' + BUYER_CONFIG.SYNC_INTERVAL_MINUTES + '分ごとに syncBuyers() を実行');
}

// ============================================================
// テスト用
// ============================================================
function buyerTestSync() {
  Logger.log('=== テスト同期開始 ===');
  syncBuyers();
  Logger.log('=== テスト同期完了 ===');
}

function syncSingleBuyer(buyerNumber) {
  var ss = SpreadsheetApp.openById(BUYER_CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(BUYER_CONFIG.SHEET_NAME);
  if (!sheet) { Logger.log('シートが見つかりません'); return; }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var buyerNumberColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (headers[i] === '買主番号') { buyerNumberColIndex = i; break; }
  }
  if (buyerNumberColIndex < 0) { Logger.log('「買主番号」列が見つかりません'); return; }

  var allData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  for (var j = 0; j < allData.length; j++) {
    if (String(allData[j][buyerNumberColIndex]) === String(buyerNumber)) {
      var record = buyerMapRowToRecord(headers, allData[j]);
      record.last_synced_at = new Date().toISOString();
      Logger.log('レコード: ' + JSON.stringify(record));
      var result = buyerUpsertToSupabase([record]);
      Logger.log('結果: ' + JSON.stringify(result));
      return;
    }
  }
  Logger.log('買主番号 ' + buyerNumber + ' が見つかりません');
}

/**
 * ハッシュキャッシュをリセット（全件再同期したい場合に手動実行）
 * 実行後の次回syncBuyers()で全行が差分ありとみなされupsertされる
 */
function buyerResetRowHashCache() {
  var props = PropertiesService.getScriptProperties();
  // 旧形式
  props.deleteProperty('buyer_row_hashes');
  // 新形式（チャンク分割）
  var chunkIndex = 0;
  while (true) {
    var key = BUYER_HASH_KEY_PREFIX + chunkIndex;
    if (!props.getProperty(key)) break;
    props.deleteProperty(key);
    chunkIndex++;
  }
  Logger.log('✅ ハッシュキャッシュをリセットしました。次回同期で全件再同期されます。');
}
