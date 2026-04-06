// ============================================================
// GASファイル（gas_buyer_complete_code.js）に追加するコード
// ============================================================

// syncUpdatesToSupabase_関数内の、他のフィールド同期ロジックの後に追加してください
// 例: 「●メアド」の同期ロジックの後

// 業者向けアンケート
var sheetBrokerSurvey = row['業者向けアンケート'] ? String(row['業者向けアンケート']) : null;
var normalizedSheetBrokerSurvey = normalizeValue(sheetBrokerSurvey);
var normalizedDbBrokerSurvey = normalizeValue(dbBuyer.broker_survey);
if (normalizedSheetBrokerSurvey !== normalizedDbBrokerSurvey) {
  updateData.broker_survey = normalizedSheetBrokerSurvey;
  needsUpdate = true;
  if (normalizedSheetBrokerSurvey === null && normalizedDbBrokerSurvey !== null) {
    Logger.log('  🗑️ ' + buyerNumber + ': 業者向けアンケートを削除 (旧値: ' + normalizedDbBrokerSurvey + ')');
  }
}

// ============================================================
// 追加場所の例
// ============================================================

// 既存のコード（●メアドの同期ロジック）:
/*
    // ●メアド
    var sheetEmail = row['●メアド'] ? String(row['●メアド']) : null;
    var normalizedSheetEmail = normalizeValue(sheetEmail);
    var normalizedDbEmail = normalizeValue(dbBuyer.email);
    if (normalizedSheetEmail !== normalizedDbEmail) {
      updateData.email = normalizedSheetEmail;
      needsUpdate = true;
      if (normalizedSheetEmail === null && normalizedDbEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': ●メアドを削除 (旧値: ' + normalizedDbEmail + ')');
      }
    }
*/

// ↓ ここに上記のコードを追加 ↓

// ============================================================
// 注意事項
// ============================================================

// 1. スプレッドシートに「業者向けアンケート」列が存在することを確認してください
// 2. 列名は完全一致する必要があります（全角・半角・スペースに注意）
// 3. コードを追加後、GASエディタで保存してデプロイしてください
// 4. 買主7260で動作確認してください:
//    - スプレッドシートの「業者向けアンケート」を「未」に変更
//    - GAS同期を実行
//    - データベースの`broker_survey`が「未」になることを確認
//    - サイドバーに「業者問合せあり」と表示されることを確認

// ============================================================
// fetchAllBuyersFromSupabase_関数の修正
// ============================================================

// fetchAllBuyersFromSupabase_関数のfieldsパラメータに`broker_survey`を追加してください:

// 修正前:
/*
  var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,inquiry_hearing,offer_comment,company_name,email';
*/

// 修正後:
/*
  var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,inquiry_hearing,offer_comment,company_name,email,broker_survey';
*/

// ↑ 最後に`,broker_survey`を追加 ↑
