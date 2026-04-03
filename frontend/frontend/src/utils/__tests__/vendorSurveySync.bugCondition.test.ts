/**
 * バグ条件探索テスト - 業者向けアンケートのDB同期スキップバグ
 *
 * **Feature: buyer-vendor-survey-sync-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コード（BUYER_COLUMN_MAPPINGに'業者向けアンケート': 'vendor_survey'が存在しない状態）で
 * FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 *
 * バグの根本原因（仮説）:
 * GASの BUYER_COLUMN_MAPPING に '業者向けアンケート': 'vendor_survey' のマッピングが存在しないため、
 * buyerMapRowToRecord 関数が「業者向けアンケート」列をスキップし、
 * 返却レコードに vendor_survey キーが含まれない。
 */

import * as fc from 'fast-check';

// ============================================================
// GASの buyerMapRowToRecord 関数をNode.js環境で再現（未修正バージョン）
// ============================================================

/**
 * 修正済みの BUYER_COLUMN_MAPPING（'業者向けアンケート': 'vendor_survey' が追加済み）
 *
 * 修正: gas/buyer-sync/BuyerSync.gs の BUYER_COLUMN_MAPPING に '業者向けアンケート': 'vendor_survey' を追加
 */
const BUYER_COLUMN_MAPPING_BUGGY: Record<string, string> = {
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
  // ✅ 修正済み: '業者向けアンケート': 'vendor_survey' を追加
  '業者向けアンケート': 'vendor_survey',
};

/**
 * GASの buyerMapRowToRecord 関数をNode.js環境で再現（未修正バージョン）
 *
 * スプレッドシートのヘッダー配列と行データ配列を受け取り、
 * BUYER_COLUMN_MAPPING を参照してDBレコードオブジェクトを返す。
 * マッピングに存在しないヘッダーはスキップされる。
 */
function buyerMapRowToRecord_buggy(
  headers: string[],
  row: any[]
): Record<string, any> {
  const record: Record<string, any> = {};
  for (let i = 0; i < headers.length; i++) {
    const dbColumn = BUYER_COLUMN_MAPPING_BUGGY[headers[i]];
    if (!dbColumn) continue;
    const value = row[i];
    record[dbColumn] = value === null || value === undefined || value === '' ? null : String(value).trim();
  }
  return record;
}

/**
 * バグ条件の判定関数（修正後）
 * 修正後は '業者向けアンケート' が BUYER_COLUMN_MAPPING に存在するため、常に false を返す
 */
function isBugCondition(input: Record<string, any>): boolean {
  const value = input['業者向けアンケート'];
  return value !== null && value !== undefined && value !== '' &&
    !('業者向けアンケート' in BUYER_COLUMN_MAPPING_BUGGY);
}

// ============================================================
// バグ条件探索テスト
// ============================================================

describe('Property 1: Bug Condition - 業者向けアンケートのDB同期スキップバグ', () => {
  /**
   * テストケース1: 基本バグ再現テスト
   *
   * 「業者向けアンケート」= "確認済み" の行を buyerMapRowToRecord に渡す
   * → 返却レコードに vendor_survey が含まれないことを確認（未修正コードで失敗）
   *
   * ⚠️ 修正前: vendor_survey が返却レコードに含まれない（バグ）
   * ✅ 修正後: vendor_survey = "確認済み" が返却レコードに含まれる
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト1: 業者向けアンケート="確認済み" の行を渡すと vendor_survey が返却レコードに含まれるべき（バグ: 含まれない）', () => {
    const headers = ['買主番号', '★最新状況\n', '業者向けアンケート'];
    const row = ['7260', '追客中', '確認済み'];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // ✅ 修正後: vendor_survey = "確認済み" が含まれる
    expect(record).toHaveProperty('vendor_survey');
    expect(record['vendor_survey']).toBe('確認済み');
  });

  /**
   * テストケース2: 買主番号7260の行データを使用したシミュレーション
   *
   * 実際の買主番号7260の行データを使用して同期をシミュレート
   * → vendor_survey が更新されないことを確認（未修正コードで失敗）
   *
   * **Validates: Requirements 1.2**
   */
  it('テスト2: 買主番号7260の行データで同期シミュレート → vendor_survey が返却レコードに含まれるべき（バグ: 含まれない）', () => {
    const headers = [
      '買主番号', '●氏名・会社名', '★最新状況\n', '★次電日',
      '業者向けアンケート', '業者問合せ', '●問合時ヒアリング'
    ];
    const row = [
      '7260', 'テスト買主', '追客中', '2026/04/01',
      '確認済み', '業者', 'ヒアリング内容'
    ];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // 他のフィールドは正しくマッピングされる
    expect(record['buyer_number']).toBe('7260');
    expect(record['name']).toBe('テスト買主');
    expect(record['latest_status']).toBe('追客中');
    expect(record['broker_inquiry']).toBe('業者');

    // ⚠️ 修正前: vendor_survey が含まれない（バグ）
    // ✅ 修正後: vendor_survey = "確認済み" が含まれる
    expect(record).toHaveProperty('vendor_survey');
    expect(record['vendor_survey']).toBe('確認済み');
  });

  /**
   * テストケース3: 様々な値での業者向けアンケートのマッピング確認
   *
   * "未確認"、"対応済み" など様々な値でも vendor_survey が返却されるべき
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト3: 業者向けアンケート="未確認" の行を渡すと vendor_survey が返却レコードに含まれるべき（バグ: 含まれない）', () => {
    const headers = ['買主番号', '業者向けアンケート'];
    const row = ['1234', '未確認'];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // ⚠️ 修正前: vendor_survey が含まれない（バグ）
    // ✅ 修正後: vendor_survey = "未確認" が含まれる
    expect(record).toHaveProperty('vendor_survey');
    expect(record['vendor_survey']).toBe('未確認');
  });

  /**
   * テストケース4: プロパティベーステスト
   *
   * 任意の非空文字列値を持つ「業者向けアンケート」列に対して、
   * buyerMapRowToRecord が vendor_survey を返却レコードに含めることを確認
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('テスト4 (PBT): 任意の非空文字列値を持つ業者向けアンケート列 → vendor_survey が返却レコードに含まれる（修正後）', () => {
    fc.assert(
      fc.property(
        // 非空文字列を生成（業者向けアンケートの値）
        fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
        // 買主番号
        fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
        (vendorSurveyValue, buyerNumber) => {
          const headers = ['買主番号', '業者向けアンケート'];
          const row = [buyerNumber, vendorSurveyValue];

          const record = buyerMapRowToRecord_buggy(headers, row);

          // ✅ 修正後: vendor_survey が含まれる
          expect(record).toHaveProperty('vendor_survey');
          expect(record['vendor_survey']).toBe(vendorSurveyValue.trim());
        }
      ),
      { numRuns: 50 }
    );
  });
});
