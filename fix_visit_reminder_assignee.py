with open('frontend/frontend/src/components/AssigneeSection.tsx', 'r', encoding='utf-8') as f:
    content = f.read().replace('\r\n', '\n')

# SMS_TEMPLATE_ASSIGNEE_MAPにvisit_reminder追加
old_map = """export const SMS_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  initial_cancellation: 'unreachableSmsAssignee',
  cancellation:         'cancelNoticeAssignee',
  valuation:            'valuationSmsAssignee',
  long_term_customer:   'longTermEmailAssignee',
  call_reminder:        'callReminderEmailAssignee',
};"""

new_map = """export const SMS_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  initial_cancellation: 'unreachableSmsAssignee',
  cancellation:         'cancelNoticeAssignee',
  valuation:            'valuationSmsAssignee',
  long_term_customer:   'longTermEmailAssignee',
  call_reminder:        'callReminderEmailAssignee',
  visit_reminder:       'visitReminderAssignee',
};"""

content = content.replace(old_map, new_map)

# ASSIGNEE_FIELDSに訪問事前通知メール担当追加
old_fields = "  { label: '\u5f53\u793e\u304c\u96fb\u8a71\u3057\u305f\u3068\u3044\u3046\u30ea\u30de\u30a4\u30f3\u30c9\u30e1\u30fc\u30eb\u62c5\u5f53', sellerKey: 'callReminderEmailAssignee',    fieldType: 'assignee' },\n];"
new_fields = "  { label: '\u5f53\u793e\u304c\u96fb\u8a71\u3057\u305f\u3068\u3044\u3046\u30ea\u30de\u30a4\u30f3\u30c9\u30e1\u30fc\u30eb\u62c5\u5f53', sellerKey: 'callReminderEmailAssignee',    fieldType: 'assignee' },\n  { label: '\u8a2a\u554f\u4e8b\u524d\u901a\u77e5\u30e1\u30fc\u30eb\u62c5\u5f53',                     sellerKey: 'visitReminderAssignee',        fieldType: 'assignee' },\n];"

content = content.replace(old_fields, new_fields)

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done' if 'visitReminderAssignee' in content else 'FAILED')
