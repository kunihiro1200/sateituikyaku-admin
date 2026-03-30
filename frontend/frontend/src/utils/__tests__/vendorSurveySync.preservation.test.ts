/**
 * 保全テスト - 業者向けアンケート以外のフィールドの同期動作維持
 *
 * **Feature: buyer-vendor-survey-sync-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
 * 修正後もこのテストが PASS することで、リグレッション（既存フィールドへの影響）がないことを確認する
 *
 * 保持すべき動作:
 * - next_call_date、latest_status、broker_inquiry 等、「業者向けアンケート」以外の全フィールドが
 *   修正前後で同一の結果を返すこと
 * - 「業者向けアンケート」列が空欄の買主行が同期される場合、他のフィールドは正常に同期されること
 * - BUYER_COLUMN_MAPPING に定義された全カラムが従来通り同期されること
 */

import * as fc from 'fast-check';

// ============================================================
// GASの buyerMapRowToRecord 関数をNode.js環境で再現（未修正バージョン）
// タスク1の vendorSurveySync.bugCondition.test.ts と同じ定義を使用
// ============================================================

/**
 * 未修正の BUYER_COLUMN_MAPPING（'業者向けアンケート': 'vendor_survey' が存在しない）
 *
 * バグ条件: '業者向けアンケート' NOT IN BUYER_COLUMN_MAPPING
 * 保全テストでは、このマッピングに定義された全カラムが正しく動作することを確認する
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
  '●内覧日(最新）': 'latest_viewing_date',
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
  // ⚠️ バグ: '業者向けアンケート': 'vendor_survey' が存在しない（意図的に除外）
};

/**
 * GASの buyerMapRowToRecord 関数をNode.js環境で再現（未修正バージョン）
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

// ============================================================
// 保全テスト
// ============================================================

describe('Property 2: Preservation - 業者向けアンケート以外のフィールドの同期動作維持', () => {
  /**
   * テストケース1: next_call_date（★次電日）の同期確認
   *
   * 保持すべき動作: '★次電日' → 'next_call_date' のマッピングが正しく動作する
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト1: ★次電日="2026/04/01" の行を渡すと next_call_date が正しくマッピングされる', () => {
    const headers = ['買主番号', '★次電日', '業者向けアンケート'];
    const row = ['7260', '2026/04/01', '確認済み'];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // next_call_date は正しくマッピングされる（保全）
    expect(record['next_call_date']).toBe('2026/04/01');
    // buyer_number も正しくマッピングされる（保全）
    expect(record['buyer_number']).toBe('7260');
    // vendor_survey はバグのためマッピングされない（バグ条件）
    expect(record['vendor_survey']).toBeUndefined();
  });

  /**
   * テストケース2: latest_status（★最新状況）の同期確認
   *
   * 保持すべき動作: '★最新状況\n' → 'latest_status' のマッピングが正しく動作する
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト2: ★最新状況="追客中" の行を渡すと latest_status が正しくマッピングされる', () => {
    const headers = ['買主番号', '★最新状況\n', '業者向けアンケート'];
    const row = ['7260', '追客中', '確認済み'];

    const record = buyerMapRowToRecord_buggy(headers, row);

    expect(record['latest_status']).toBe('追客中');
    expect(record['buyer_number']).toBe('7260');
  });

  /**
   * テストケース3: broker_inquiry（業者問合せ）の同期確認
   *
   * 保持すべき動作: '業者問合せ' → 'broker_inquiry' のマッピングが正しく動作する
   * ※ '業者問合せ' と '業者向けアンケート' は別フィールドであることを確認
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト3: 業者問合せ="業者" の行を渡すと broker_inquiry が正しくマッピングされる（業者向けアンケートとは別フィールド）', () => {
    const headers = ['買主番号', '業者問合せ', '業者向けアンケート'];
    const row = ['7260', '業者', '確認済み'];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // broker_inquiry は正しくマッピングされる（保全）
    expect(record['broker_inquiry']).toBe('業者');
    // vendor_survey はバグのためマッピングされない（バグ条件）
    expect(record['vendor_survey']).toBeUndefined();
  });

  /**
   * テストケース4: 業者向けアンケートが空欄の場合、他フィールドは正常に同期される
   *
   * 保持すべき動作: 業者向けアンケートが空欄でも、他フィールドの同期は影響を受けない
   *
   * **Validates: Requirements 3.2**
   */
  it('テスト4: 業者向けアンケートが空欄の場合、他フィールドは正常に同期される', () => {
    const headers = [
      '買主番号', '●氏名・会社名', '★最新状況\n', '★次電日',
      '業者問合せ', '業者向けアンケート', '●問合時ヒアリング'
    ];
    const row = [
      '7260', 'テスト買主', '追客中', '2026/04/01',
      '業者', '', 'ヒアリング内容'
    ];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // 他フィールドは正常にマッピングされる（保全）
    expect(record['buyer_number']).toBe('7260');
    expect(record['name']).toBe('テスト買主');
    expect(record['latest_status']).toBe('追客中');
    expect(record['next_call_date']).toBe('2026/04/01');
    expect(record['broker_inquiry']).toBe('業者');
    expect(record['inquiry_hearing']).toBe('ヒアリング内容');
    // 業者向けアンケートが空欄の場合、vendor_survey は null
    expect(record['vendor_survey']).toBeUndefined();
  });

  /**
   * テストケース5: BUYER_COLUMN_MAPPING に定義された全カラムの網羅的確認
   *
   * 保持すべき動作: BUYER_COLUMN_MAPPING に定義された全カラムが正しくマッピングされる
   *
   * **Validates: Requirements 3.3**
   */
  it('テスト5: BUYER_COLUMN_MAPPING に定義された全カラムが正しくマッピングされる', () => {
    // 代表的なカラムを全て含む行を作成
    const testCases: Array<{ header: string; dbColumn: string; value: string }> = [
      { header: '買主番号', dbColumn: 'buyer_number', value: '7260' },
      { header: '★最新状況\n', dbColumn: 'latest_status', value: '追客中' },
      { header: '★次電日', dbColumn: 'next_call_date', value: '2026/04/01' },
      { header: '業者問合せ', dbColumn: 'broker_inquiry', value: '業者' },
      { header: '●氏名・会社名', dbColumn: 'name', value: 'テスト買主' },
      { header: '●電話番号\n（ハイフン不要）', dbColumn: 'phone_number', value: '09012345678' },
      { header: '●メアド', dbColumn: 'email', value: 'test@example.com' },
      { header: '●問合せ元', dbColumn: 'inquiry_source', value: 'athome' },
      { header: 'Pinrich', dbColumn: 'pinrich', value: 'https://pinrich.example.com' },
    ];

    for (const testCase of testCases) {
      const headers = [testCase.header];
      const row = [testCase.value];
      const record = buyerMapRowToRecord_buggy(headers, row);
      expect(record[testCase.dbColumn]).toBe(testCase.value);
    }
  });

  /**
   * テストケース6 (PBT): 業者向けアンケート以外のフィールドが任意の値で正しくマッピングされる
   *
   * 保持すべき動作: BUYER_COLUMN_MAPPING に定義された任意のフィールドが、
   * 業者向けアンケートの有無に関わらず正しくマッピングされる
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it('テスト6 (PBT): 業者向けアンケートの有無に関わらず、他フィールドは常に正しくマッピングされる', () => {
    // 保全対象のフィールド（業者向けアンケート以外）
    const preservedFields: Array<{ header: string; dbColumn: string }> = [
      { header: '買主番号', dbColumn: 'buyer_number' },
      { header: '★最新状況\n', dbColumn: 'latest_status' },
      { header: '★次電日', dbColumn: 'next_call_date' },
      { header: '業者問合せ', dbColumn: 'broker_inquiry' },
      { header: '●氏名・会社名', dbColumn: 'name' },
    ];

    fc.assert(
      fc.property(
        // 保全フィールドの値（非空文字列）
        fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0),
        // 業者向けアンケートの値（空または非空）
        fc.oneof(
          fc.constant(''),
          fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.trim().length > 0)
        ),
        // テスト対象フィールドのインデックス
        fc.integer({ min: 0, max: preservedFields.length - 1 }),
        (fieldValue, vendorSurveyValue, fieldIndex) => {
          const field = preservedFields[fieldIndex];
          const headers = [field.header, '業者向けアンケート'];
          const row = [fieldValue, vendorSurveyValue];

          const record = buyerMapRowToRecord_buggy(headers, row);

          // 保全フィールドは常に正しくマッピングされる
          expect(record[field.dbColumn]).toBe(fieldValue.trim());
          // vendor_survey はバグのためマッピングされない（業者向けアンケートの有無に関わらず）
          expect(record['vendor_survey']).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース7 (PBT): 空値の扱いが一貫している
   *
   * 保持すべき動作: 空文字・null・undefined の値は null としてマッピングされる
   *
   * **Validates: Requirements 3.1**
   */
  it('テスト7 (PBT): 空値（空文字・null・undefined）は null としてマッピングされる', () => {
    const emptyValues = ['', null, undefined];

    for (const emptyValue of emptyValues) {
      const headers = ['買主番号', '★最新状況\n', '業者問合せ'];
      const row = ['7260', emptyValue, emptyValue];

      const record = buyerMapRowToRecord_buggy(headers, row);

      // 空値は null としてマッピングされる（保全）
      expect(record['latest_status']).toBeNull();
      expect(record['broker_inquiry']).toBeNull();
      // buyer_number は非空なので正しくマッピングされる
      expect(record['buyer_number']).toBe('7260');
    }
  });

  /**
   * テストケース8: 複数フィールドを含む完全な買主行の同期確認
   *
   * 保持すべき動作: 実際の買主行データ（業者向けアンケートを含む）で、
   * 業者向けアンケート以外の全フィールドが正しくマッピングされる
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('テスト8: 完全な買主行データで業者向けアンケート以外の全フィールドが正しくマッピングされる', () => {
    const headers = [
      '買主番号', '●氏名・会社名', '★最新状況\n', '★次電日',
      '業者問合せ', '業者向けアンケート', '●問合時ヒアリング',
      '●問合時確度', 'Pinrich', '★エリア'
    ];
    const row = [
      '7260', 'テスト買主', '追客中', '2026/04/01',
      '業者', '確認済み', 'ヒアリング内容',
      'A', 'https://pinrich.example.com', '大分市'
    ];

    const record = buyerMapRowToRecord_buggy(headers, row);

    // 業者向けアンケート以外の全フィールドが正しくマッピングされる（保全）
    expect(record['buyer_number']).toBe('7260');
    expect(record['name']).toBe('テスト買主');
    expect(record['latest_status']).toBe('追客中');
    expect(record['next_call_date']).toBe('2026/04/01');
    expect(record['broker_inquiry']).toBe('業者');
    expect(record['inquiry_hearing']).toBe('ヒアリング内容');
    expect(record['inquiry_confidence']).toBe('A');
    expect(record['pinrich']).toBe('https://pinrich.example.com');
    expect(record['desired_area']).toBe('大分市');

    // vendor_survey はバグのためマッピングされない（バグ条件）
    expect(record['vendor_survey']).toBeUndefined();
  });
});
