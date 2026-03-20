"""
updateSellerにassigneeフィールドの処理を追加する
対象: backend/src/services/SellerService.supabase.ts
"""

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# duplicateConfirmedの処理の後に挿入する
old = """    if (data.duplicateConfirmed !== undefined) {
      updates.duplicate_confirmed = data.duplicateConfirmed;
      if (data.duplicateConfirmed) {
        updates.duplicate_confirmed_at = new Date();
        // duplicate_confirmed_by should be set by the calling code
      }
    }

    if (Object.keys(updates).length === 0) {"""

new = """    if (data.duplicateConfirmed !== undefined) {
      updates.duplicate_confirmed = data.duplicateConfirmed;
      if (data.duplicateConfirmed) {
        updates.duplicate_confirmed_at = new Date();
        // duplicate_confirmed_by should be set by the calling code
      }
    }

    // 担当者設定フィールド（call-mode-assignee-section）
    if ((data as any).unreachableSmsAssignee !== undefined) {
      updates.unreachable_sms_assignee = (data as any).unreachableSmsAssignee;
    }
    if ((data as any).valuationSmsAssignee !== undefined) {
      updates.valuation_sms_assignee = (data as any).valuationSmsAssignee;
    }
    if ((data as any).valuationReasonEmailAssignee !== undefined) {
      updates.valuation_reason_email_assignee = (data as any).valuationReasonEmailAssignee;
    }
    if ((data as any).valuationReason !== undefined) {
      updates.valuation_reason = (data as any).valuationReason;
    }
    if ((data as any).cancelNoticeAssignee !== undefined) {
      updates.cancel_notice_assignee = (data as any).cancelNoticeAssignee;
    }
    if ((data as any).longTermEmailAssignee !== undefined) {
      updates.long_term_email_assignee = (data as any).longTermEmailAssignee;
    }
    if ((data as any).callReminderEmailAssignee !== undefined) {
      updates.call_reminder_email_assignee = (data as any).callReminderEmailAssignee;
    }
    if ((data as any).visitReminderAssignee !== undefined) {
      updates.visit_reminder_assignee = (data as any).visitReminderAssignee;
    }
    // unreachableStatus（不通ステータス文字列）
    if ((data as any).unreachableStatus !== undefined) {
      updates.unreachable_status = (data as any).unreachableStatus;
    }

    if (Object.keys(updates).length === 0) {"""

if old in text:
    text = text.replace(old, new)
    with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ 修正完了')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ用
    idx = text.find('duplicate_confirmed_by should be set by the calling code')
    print(f'  "duplicate_confirmed_by" の位置: {idx}')
    if idx > 0:
        print(text[idx-50:idx+200])
