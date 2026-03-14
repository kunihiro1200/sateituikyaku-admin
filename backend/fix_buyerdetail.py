with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'r', encoding='utf-8-sig') as f:
    text = f.read()

search = 'INQUIRY_HEARING_QUICK_INPUTS'
idx = text.find(search)
comment_start = text.rfind('\n', 0, idx - 50) + 1
end_bracket = text.find('];\n', idx) + 3

new_block = """// フィールドをセクションごとにグループ化
// 問合時ヒアリング用クイック入力ボタンの定義
const INQUIRY_HEARING_QUICK_INPUTS = [
  { label: '初見か', text: '初見か：' },
  { label: '希望時期', text: '希望時期：' },
  { label: '駐車場希望台数', text: '駐車場希望台数：' },
  { label: 'リフォーム条件', text: 'リフォーム済みの条件（最低限）：' },
  { label: '持ち家か', text: '持ち家か：' },
  { label: '他物件', text: '他に気になる物件はあるか？：' },
];
"""

new_text = text[:comment_start] + new_block + text[end_bracket:]

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(new_text)
print('Done')
