# 買主リスト用GAS 7フィールド追加手順

## 📋 追加が必要な7つのフィールド

1. `notification_sender` (通知送信者)
2. `pre_viewing_notes` (内覧前伝達事項)
3. `viewing_notes` (内覧の時の伝達事項)
4. `pre_viewing_hearing` (内覧前ヒアリング)
5. `offer_comment` (買付コメント（任意）)
6. `company_name` (法人名)
7. `email` (●メアド)

---

## 🔧 修正箇所1: fetchAllBuyersFromSupabase_関数

**ファイル**: `gas_buyer_complete_code.js`

**行番号**: 約370行目

**現在のコード**:
```javascript
var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email';
```

**修正後のコード**:
```javascript
var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,offer_comment,company_name,email';
```

**変更内容**: 末尾に7つのフィールドを追加

---

## 🔧 修正箇所2: syncUpdatesToSupabase_関数

**ファイル**: `gas_buyer_complete_code.js`

**行番号**: 約650行目（`viewing_promotion_email`ブロックの後）

**挿入位置**: 以下のブロックの直後
```javascript
    // 内覧促進メール
    var sheetViewingPromotionEmail = row['内覧促進メール'] ? String(row['内覧促進メール']) : null;
    var normalizedSheetViewingPromotionEmail = normalizeValue(sheetViewingPromotionEmail);
    var normalizedDbViewingPromotionEmail = normalizeValue(dbBuyer.viewing_promotion_email);
    if (normalizedSheetViewingPromotionEmail !== normalizedDbViewingPromotionEmail) {
      updateData.viewing_promotion_email = normalizedSheetViewingPromotionEmail;
      needsUpdate = true;
      if (normalizedSheetViewingPromotionEmail === null && normalizedDbViewingPromotionEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧促進メールを削除 (旧値: ' + normalizedDbViewingPromotionEmail + ')');
      }
    }
```

**追加するコード**:
```javascript
    
    // 通知送信者（2026年4月5日追加）
    var sheetNotificationSender = row['通知送信者'] ? String(row['通知送信者']) : null;
    var normalizedSheetNotificationSender = normalizeValue(sheetNotificationSender);
    var normalizedDbNotificationSender = normalizeValue(dbBuyer.notification_sender);
    if (normalizedSheetNotificationSender !== normalizedDbNotificationSender) {
      updateData.notification_sender = normalizedSheetNotificationSender;
      needsUpdate = true;
      if (normalizedSheetNotificationSender === null && normalizedDbNotificationSender !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 通知送信者を削除 (旧値: ' + normalizedDbNotificationSender + ')');
      }
    }
    
    // 内覧前伝達事項（2026年4月5日追加）
    var sheetPreViewingNotes = row['内覧前伝達事項'] ? String(row['内覧前伝達事項']) : null;
    var normalizedSheetPreViewingNotes = normalizeValue(sheetPreViewingNotes);
    var normalizedDbPreViewingNotes = normalizeValue(dbBuyer.pre_viewing_notes);
    if (normalizedSheetPreViewingNotes !== normalizedDbPreViewingNotes) {
      updateData.pre_viewing_notes = normalizedSheetPreViewingNotes;
      needsUpdate = true;
      if (normalizedSheetPreViewingNotes === null && normalizedDbPreViewingNotes !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧前伝達事項を削除 (旧値: ' + normalizedDbPreViewingNotes + ')');
      }
    }
    
    // 内覧の時の伝達事項（2026年4月5日追加）
    var sheetViewingNotes = row['内覧の時の伝達事項'] ? String(row['内覧の時の伝達事項']) : null;
    var normalizedSheetViewingNotes = normalizeValue(sheetViewingNotes);
    var normalizedDbViewingNotes = normalizeValue(dbBuyer.viewing_notes);
    if (normalizedSheetViewingNotes !== normalizedDbViewingNotes) {
      updateData.viewing_notes = normalizedSheetViewingNotes;
      needsUpdate = true;
      if (normalizedSheetViewingNotes === null && normalizedDbViewingNotes !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧の時の伝達事項を削除 (旧値: ' + normalizedDbViewingNotes + ')');
      }
    }
    
    // 内覧前ヒアリング（2026年4月5日追加）
    var sheetPreViewingHearing = row['内覧前ヒアリング'] ? String(row['内覧前ヒアリング']) : null;
    var normalizedSheetPreViewingHearing = normalizeValue(sheetPreViewingHearing);
    var normalizedDbPreViewingHearing = normalizeValue(dbBuyer.pre_viewing_hearing);
    if (normalizedSheetPreViewingHearing !== normalizedDbPreViewingHearing) {
      updateData.pre_viewing_hearing = normalizedSheetPreViewingHearing;
      needsUpdate = true;
      if (normalizedSheetPreViewingHearing === null && normalizedDbPreViewingHearing !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧前ヒアリングを削除 (旧値: ' + normalizedDbPreViewingHearing + ')');
      }
    }
    
    // 買付コメント（任意）（2026年4月5日追加）
    var sheetOfferComment = row['買付コメント（任意）'] ? String(row['買付コメント（任意）']) : null;
    var normalizedSheetOfferComment = normalizeValue(sheetOfferComment);
    var normalizedDbOfferComment = normalizeValue(dbBuyer.offer_comment);
    if (normalizedSheetOfferComment !== normalizedDbOfferComment) {
      updateData.offer_comment = normalizedSheetOfferComment;
      needsUpdate = true;
      if (normalizedSheetOfferComment === null && normalizedDbOfferComment !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 買付コメント（任意）を削除 (旧値: ' + normalizedDbOfferComment + ')');
      }
    }
    
    // 法人名（2026年4月5日追加）
    var sheetCompanyName = row['法人名'] ? String(row['法人名']) : null;
    var normalizedSheetCompanyName = normalizeValue(sheetCompanyName);
    var normalizedDbCompanyName = normalizeValue(dbBuyer.company_name);
    if (normalizedSheetCompanyName !== normalizedDbCompanyName) {
      updateData.company_name = normalizedSheetCompanyName;
      needsUpdate = true;
      if (normalizedSheetCompanyName === null && normalizedDbCompanyName !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 法人名を削除 (旧値: ' + normalizedDbCompanyName + ')');
      }
    }
    
    // ●メアド（2026年4月5日追加）
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
```

---

## ✅ 修正手順

1. Google Apps Scriptエディタで `gas_buyer_complete_code.js` を開く
2. **修正箇所1**: `fetchAllBuyersFromSupabase_`関数の`fields`変数を修正（7フィールド追加）
3. **修正箇所2**: `syncUpdatesToSupabase_`関数に7つのフィールド同期ブロックを追加
4. 保存（Ctrl+S）
5. `testBuyerSync`関数を実行してテスト

---

## 🚨 注意事項

- 既存のコードは絶対に削除しない
- 7つのフィールド同期ブロックは、`viewing_promotion_email`ブロックの直後、`if (!needsUpdate) continue;`の前に追加
- スプレッドシートの列名は正確に一致させる（例: `通知送信者`、`内覧前伝達事項`）

---

**作成日**: 2026年4月5日  
**目的**: 買主リスト用GASに7つの不足フィールドを追加し、内覧ページの全フィールドを双方向同期する
