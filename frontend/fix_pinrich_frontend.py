# fix_pinrich_frontend.py
# BuyersPage.tsxでpinrichUnregisteredも英語キーのままAPIに渡すよう修正

with open('frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧: pinrich500manUnregisteredのみ英語キーで渡す
old = """          // pinrich500manUnregistered は英語キーをそのままAPIに渡す（バックエンドが英語キーで処理）
          // その他のカテゴリはカテゴリキーを日本語表示名に変換してからAPIに渡す
          if (selectedCalculatedStatus === 'pinrich500manUnregistered') {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }"""

# 新: pinrichUnregisteredとpinrich500manUnregisteredは英語キーのままAPIに渡す
new = """          // 英語キーをそのままAPIに渡すカテゴリ（バックエンドが英語キーで処理）
          // pinrichUnregistered, pinrich500manUnregistered は英語キーで渡す
          // その他のカテゴリはカテゴリキーを日本語表示名に変換してからAPIに渡す
          const englishKeyCategories = ['pinrichUnregistered', 'pinrich500manUnregistered'];
          if (englishKeyCategories.includes(selectedCalculatedStatus)) {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }"""

if old in text:
    text = text.replace(old, new)
    print('✅ BuyersPage.tsx の pinrichUnregistered 英語キー修正完了')
else:
    print('❌ 対象文字列が見つかりませんでした')
    idx = text.find('pinrich500manUnregistered は英語キー')
    if idx >= 0:
        print(f'  周辺テキスト: {repr(text[idx:idx+400])}')

with open('frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
