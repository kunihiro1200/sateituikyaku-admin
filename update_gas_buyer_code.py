#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主リスト用GASコードに7つの不足フィールドを追加するスクリプト
"""

# 元のファイルを読み取る
with open('gas_buyer_complete_code.js', 'rb') as f:
    original_content = f.read().decode('utf-8')

# fetchAllBuyersFromSupabase_関数のfields変数に7つのフィールドを追加
# 現在: 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email'
# 追加: notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,offer_comment,company_name,email

old_fields = "var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email';"

new_fields = "var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,offer_comment,company_name,email';"

updated_content = original_content.replace(old_fields, new_fields)

# syncUpdatesToSupabase_関数に7つのフィールド同期ブロックを追加
# viewing_promotion_emailブロックの後、if (!needsUpdate) continue; の前に追加

viewing_promotion_email_block_end = """    if (normalizedSheetViewingPromotionEmail !== normalizedDbViewingPromotionEmail) {
      updateData.viewing_promotion_email = normalizedSheetViewingPromotionEmail;
      needsUpdate = true;
      if (normalizedSheetViewingPromotionEmail === null && normalizedDbViewingPromotionEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧促進メールを削除 (旧値: ' + normalizedDbViewingPromotionEmail + ')');
      }
    }"""

# 7つの新しいフィールド同期ブロック
new_sync_blocks = """
    
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
    }"""

# viewing_promotion_emailブロックの後に新しいブロックを挿入
updated_content = updated_content.replace(
    viewing_promotion_email_block_end,
    viewing_promotion_email_block_end + new_sync_blocks
)

# UTF-8で保存
with open('gas_buyer_complete_code_UPDATED.js', 'wb') as f:
    f.write(updated_content.encode('utf-8'))

print('✅ 更新完了！')
print('📄 新しいファイル: gas_buyer_complete_code_UPDATED.js')
print('')
print('🚨 次のステップ:')
print('1. gas_buyer_complete_code_UPDATED.js を開く')
print('2. 全ての内容をコピー')
print('3. Google Apps Scriptエディタにペースト')
print('4. 保存して実行')
