# BuyerDetailPage.tsx に「内覧結果」セクションを追加するスクリプト
# UTF-8で安全に書き込む

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 「その他」セクションの後に「内覧結果」セクションを追加
old_str = """  {
    title: 'その他',
    fields: [
      { key: 'special_notes', label: '特記事項', multiline: true, inlineEditable: true },
      { key: 'message_to_assignee', label: '担当への伝言/質問事項', multiline: true, inlineEditable: true },
      { key: 'confirmation_to_assignee', label: '担当への確認事項', multiline: true, inlineEditable: true },
      { key: 'family_composition', label: '家族構成', inlineEditable: true },
      { key: 'must_have_points', label: '譲れない点', multiline: true, inlineEditable: true },
      { key: 'liked_points', label: '気に入っている点', multiline: true, inlineEditable: true },
      { key: 'disliked_points', label: 'ダメな点', multiline: true, inlineEditable: true },
      { key: 'purchase_obstacles', label: '購入時障害となる点', multiline: true, inlineEditable: true },
      { key: 'next_action', label: '次のアクション', multiline: true, inlineEditable: true },
    ],
  },
];"""

new_str = """  {
    title: 'その他',
    fields: [
      { key: 'special_notes', label: '特記事項', multiline: true, inlineEditable: true },
      { key: 'message_to_assignee', label: '担当への伝言/質問事項', multiline: true, inlineEditable: true },
      { key: 'confirmation_to_assignee', label: '担当への確認事項', multiline: true, inlineEditable: true },
      { key: 'family_composition', label: '家族構成', inlineEditable: true },
      { key: 'must_have_points', label: '譲れない点', multiline: true, inlineEditable: true },
      { key: 'liked_points', label: '気に入っている点', multiline: true, inlineEditable: true },
      { key: 'disliked_points', label: 'ダメな点', multiline: true, inlineEditable: true },
      { key: 'purchase_obstacles', label: '購入時障害となる点', multiline: true, inlineEditable: true },
      { key: 'next_action', label: '次のアクション', multiline: true, inlineEditable: true },
    ],
  },
  {
    title: '内覧結果',
    isViewingResultGroup: true,
    fields: [
      { key: 'latest_status', label: '★最新状況', inlineEditable: true },
      { key: 'latest_viewing_date', label: '内覧日（最新）', type: 'date', inlineEditable: true },
      { key: 'viewing_result_follow_up', label: '内覧結果・後続対応', multiline: true, inlineEditable: true },
    ],
  },
];"""

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ 内覧結果セクションを追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    import sys
    sys.exit(1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
