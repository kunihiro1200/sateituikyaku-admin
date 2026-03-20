"""
AssigneeSection.tsx の変更:
1. セクション名「担当者設定」→「メール送信確認」
2. onSmsTemplateUsed コールバック prop を追加
   - SMS送信時に対応フィールドへ自動セット（外部から呼び出せるようにする）
"""

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# セクション名変更
text = text.replace('        担当者設定\n', '        メール送信確認\n')

# AssigneeSectionProps に onSmsTemplateUsed を追加
old_props = '''interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
}'''

new_props = '''// SMSテンプレートID → 対応するsellerKeyのマッピング
export const SMS_TEMPLATE_ASSIGNEE_MAP: Partial<Record<string, keyof Seller>> = {
  initial_cancellation: 'unreachableSmsAssignee',
  cancellation:         'cancelNoticeAssignee',
  valuation:            'valuationSmsAssignee',
  long_term_customer:   'longTermEmailAssignee',
  call_reminder:        'callReminderEmailAssignee',
};

interface AssigneeSectionProps {
  seller: Seller;
  onUpdate: (updatedFields: Partial<Seller>) => void;
  /** SMS送信後に呼び出す: templateId と送信者イニシャルを渡す */
  onSmsTemplateUsed?: (templateId: string, initial: string) => void;
}'''

text = text.replace(old_props, new_props)

# コンポーネント引数に onSmsTemplateUsed を追加
old_sig = 'export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate }) => {'
new_sig = 'export const AssigneeSection: React.FC<AssigneeSectionProps> = ({ seller, onUpdate, onSmsTemplateUsed }) => {'
text = text.replace(old_sig, new_sig)

# useImperativeHandle の代わりに、外部から呼べる setFieldValue 関数を公開する
# → onSmsTemplateUsed は CallModePage 側で直接 saveField を呼ぶ形にする
# AssigneeSection 側では不要なので、CallModePage 側で seller 更新 API を直接叩く方式にする

with open('frontend/frontend/src/components/AssigneeSection.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ AssigneeSection.tsx を更新しました')

# 確認
with open('frontend/frontend/src/components/AssigneeSection.tsx', 'rb') as f:
    verify = f.read().decode('utf-8')

if 'メール送信確認' in verify:
    print('✅ セクション名変更: OK')
if 'SMS_TEMPLATE_ASSIGNEE_MAP' in verify:
    print('✅ SMS_TEMPLATE_ASSIGNEE_MAP: OK')
