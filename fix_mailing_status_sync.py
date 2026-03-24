"""
EnhancedAutoSyncService.ts に mailing_status 同期処理を追加するスクリプト
- 2.1: detectUpdatedSellers の SELECT クエリに mailing_status を追加
- 2.2: detectUpdatedSellers の比較ロジックに mailing_status の比較を追加
- 2.3: updateSingleSeller メソッドに mailing_status の更新処理を追加
- 2.4: syncSingleSeller メソッドに mailing_status の設定処理を追加
"""

with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 2.1: detectUpdatedSellers の SELECT クエリに mailing_status を追加
# ============================================================
old_select = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, name, address, phone_number, email, property_address, current_status, updated_at, visit_reminder_assignee')"
new_select = "        .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, valuation_amount_1, valuation_amount_2, valuation_amount_3, first_call_person, valuation_reason, valuation_method, name, address, phone_number, email, property_address, current_status, updated_at, visit_reminder_assignee, mailing_status')"

if old_select in text:
    text = text.replace(old_select, new_select)
    print("✅ 2.1: SELECT クエリに mailing_status を追加しました")
else:
    print("❌ 2.1: SELECT クエリが見つかりませんでした")

# ============================================================
# 2.2: detectUpdatedSellers の比較ロジックに mailing_status の比較を追加
# visit_reminder_assigneeの比較の直後に追加
# ============================================================
old_visit_reminder_compare = """          // visit_reminder_assigneeの比較
          const dbVisitReminderAssignee = dbSeller.visit_reminder_assignee || '';
          const sheetVisitReminderAssignee = sheetRow['訪問事前通知メール担当'] || '';
          if (sheetVisitReminderAssignee !== dbVisitReminderAssignee) {
            needsUpdate = true;
          }

          // 査定額の比較"""

new_visit_reminder_compare = """          // visit_reminder_assigneeの比較
          const dbVisitReminderAssignee = dbSeller.visit_reminder_assignee || '';
          const sheetVisitReminderAssignee = sheetRow['訪問事前通知メール担当'] || '';
          if (sheetVisitReminderAssignee !== dbVisitReminderAssignee) {
            needsUpdate = true;
          }

          // mailing_statusの比較（スプレッドシートが空欄の場合は同期対象外）
          const dbMailingStatus = dbSeller.mailing_status || '';
          const sheetMailingStatus = sheetRow['郵送'] || '';
          if (sheetMailingStatus !== '' && sheetMailingStatus !== dbMailingStatus) {
            needsUpdate = true;
          }

          // 査定額の比較"""

if old_visit_reminder_compare in text:
    text = text.replace(old_visit_reminder_compare, new_visit_reminder_compare)
    print("✅ 2.2: mailing_status の比較ロジックを追加しました")
else:
    print("❌ 2.2: visit_reminder_assignee の比較ロジックが見つかりませんでした")

# ============================================================
# 2.3: updateSingleSeller メソッドに mailing_status の更新処理を追加
# 査定方法を追加 の直後に追加
# ============================================================
old_valuation_method_update = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      updateData.valuation_method = String(valuationMethod);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由（査定サイトから転記）'];"""

new_valuation_method_update = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      updateData.valuation_method = String(valuationMethod);
    }

    // 郵送ステータスを追加（空欄の場合は同期しない）
    const mailingStatus = row['郵送'];
    if (mailingStatus !== undefined && mailingStatus !== '') {
      updateData.mailing_status = String(mailingStatus);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由（査定サイトから転記）'];"""

if old_valuation_method_update in text:
    text = text.replace(old_valuation_method_update, new_valuation_method_update)
    print("✅ 2.3: updateSingleSeller に mailing_status の更新処理を追加しました")
else:
    print("❌ 2.3: updateSingleSeller の査定方法追加部分が見つかりませんでした")

# ============================================================
# 2.4: syncSingleSeller メソッドに mailing_status の設定処理を追加
# syncSingleSeller 内の「査定方法を追加」の直後に追加
# updateSingleSeller と syncSingleSeller の両方に「査定方法を追加」があるため、
# syncSingleSeller 固有の文脈（encryptedData）を使って特定する
# ============================================================
old_valuation_method_sync = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      encryptedData.valuation_method = String(valuationMethod);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由（査定サイトから転記）'];"""

new_valuation_method_sync = """    // 査定方法を追加
    const valuationMethod = row['査定方法'];
    if (valuationMethod) {
      encryptedData.valuation_method = String(valuationMethod);
    }

    // 郵送ステータスを追加（空欄の場合は設定しない）
    const mailingStatusNew = row['郵送'];
    if (mailingStatusNew !== undefined && mailingStatusNew !== '') {
      encryptedData.mailing_status = String(mailingStatusNew);
    }

    // 査定理由（AO列）を追加
    const valuationReason = row['査定理由（査定サイトから転記）'];"""

if old_valuation_method_sync in text:
    text = text.replace(old_valuation_method_sync, new_valuation_method_sync)
    print("✅ 2.4: syncSingleSeller に mailing_status の設定処理を追加しました")
else:
    print("❌ 2.4: syncSingleSeller の査定方法追加部分が見つかりませんでした")

# UTF-8 で書き込む（BOMなし）
with open('backend/src/services/EnhancedAutoSyncService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ 完了: EnhancedAutoSyncService.ts を更新しました")

# BOM チェック
with open('backend/src/services/EnhancedAutoSyncService.ts', 'rb') as f:
    first_bytes = f.read(3)
print(f"BOM チェック: {repr(first_bytes[:3])} (BOMなしなら OK)")
