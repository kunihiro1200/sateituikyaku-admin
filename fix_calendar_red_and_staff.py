"""
1. カレンダーボタンを緑→赤に変更
2. 後続担当ボタンのフォールバック: スプシ失敗時にDBから取得していたが、
   スプシが正常に動いていても「TENANT」「生」が出る場合は
   フロントエンド側でフィルタリングが必要かもしれない。
   ただし今回はバックエンドが正しく動いていれば不要なので、
   まずカレンダーボタンの色変更のみ実施。
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 緑(success) → 赤(error) に変更
old_color = "                    color={shouldHighlight ? 'success' : 'primary'}"
new_color = "                    color={shouldHighlight ? 'error' : 'primary'}"

if old_color in text:
    text = text.replace(old_color, new_color)
    print('✅ カレンダーボタンの色を success → error（赤）に変更')
else:
    print('⚠️ 対象箇所が見つかりません')
    idx = text.find('shouldHighlight')
    if idx >= 0:
        print('周辺:', repr(text[idx:idx+300]))

# pulse アニメーションの色も赤に変更
old_pulse = "                        animation: 'calendarPulse 1.5s ease-in-out infinite',\n                        '@keyframes calendarPulse': {\n                          '0%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.5)' },\n                          '70%': { boxShadow: '0 0 0 6px rgba(46, 125, 50, 0)' },\n                          '100%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },"
new_pulse = "                        animation: 'calendarPulse 1.5s ease-in-out infinite',\n                        '@keyframes calendarPulse': {\n                          '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.5)' },\n                          '70%': { boxShadow: '0 0 0 6px rgba(211, 47, 47, 0)' },\n                          '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },"

if old_pulse in text:
    text = text.replace(old_pulse, new_pulse)
    print('✅ pulse アニメーションの色を赤に変更')
else:
    print('⚠️ pulse アニメーション箇所が見つかりません')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
