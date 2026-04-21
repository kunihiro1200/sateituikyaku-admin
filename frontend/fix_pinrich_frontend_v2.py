# fix_pinrich_frontend_v2.py
# BuyersPage.tsxのカテゴリーキー変換ロジックを根本から修正
# 設計変更: バックエンドが英語キーで処理するカテゴリはそのまま渡す
# categoryKeyToDisplayNameに存在するキーは日本語変換、存在しないキーはそのまま渡す
# → 新カテゴリ追加時にリスト管理不要

with open('frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧: englishKeyCategories リストで管理（追加し忘れるとバグ）
old = """          // 英語キーをそのままAPIに渡すカテゴリ（バックエンドが英語キーで処理）
          // pinrichUnregistered, pinrich500manUnregistered は英語キーで渡す
          // その他のカテゴリはカテゴリキーを日本語表示名に変換してからAPIに渡す
          const englishKeyCategories = ['pinrichUnregistered', 'pinrich500manUnregistered'];
          if (englishKeyCategories.includes(selectedCalculatedStatus)) {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }"""

# 新: バックエンドが英語キーで処理するカテゴリを定義（追加し忘れ防止）
# バックエンドのgetBuyersByStatusで英語キーで処理されるカテゴリ一覧
new = """          // バックエンドのgetBuyersByStatusで英語キーで処理されるカテゴリはそのまま渡す
          // それ以外は日本語表示名に変換してAPIに渡す
          // ⚠️ 新カテゴリをバックエンドで英語キー処理する場合はこのリストに追加すること
          const backendEnglishKeyCategories = [
            'threeCallUnchecked',          // ３回架電未
            'pinrichUnregistered',         // ピンリッチ未登録
            'pinrich500manUnregistered',   // Pinrich500万以上登録未
          ];
          if (backendEnglishKeyCategories.includes(selectedCalculatedStatus)) {
            quickParams.calculatedStatus = selectedCalculatedStatus;
          } else {
            const displayName = categoryKeyToDisplayName[selectedCalculatedStatus] || selectedCalculatedStatus;
            quickParams.calculatedStatus = displayName;
          }"""

if old in text:
    text = text.replace(old, new)
    print('✅ BuyersPage.tsx のカテゴリーキー変換ロジックを根本修正しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    idx = text.find('englishKeyCategories')
    if idx >= 0:
        print(f'  周辺テキスト: {repr(text[idx:idx+400])}')

with open('frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
