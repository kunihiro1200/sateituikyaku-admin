# BuyerDetailPage.tsx に内覧結果セクションを追加し、★最新状況を両セクションに表示する
# UTF-8 安全な変更スクリプト

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 'その他'セクションの後に内覧結果セクションを追加
old = """      { key: 'next_action', label: '次のアクション', multiline: true, inlineEditable: true },
    ],
  },
];"""

new = """      { key: 'next_action', label: '次のアクション', multiline: true, inlineEditable: true },
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

if old in text:
    text = text.replace(old, new)
    print('✅ 内覧結果セクションを追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    idx = text.find('次のアクション')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx:idx+200]))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
