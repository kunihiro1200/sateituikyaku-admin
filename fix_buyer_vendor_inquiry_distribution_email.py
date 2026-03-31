# UTF-8安全な修正スクリプト
# 業者問合せ時の配信メール必須除外バグを修正

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のコード
old_code = '''    // 配信メールが「要」の場合は希望条件の必須チェック
    if (buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {'''

# 修正後のコード（業者問合せの場合は除外）
new_code = '''    // 配信メールが「要」の場合は希望条件の必須チェック
    // 業者問合せの場合は配信メールを送らないため、希望条件は不要
    if (buyer.broker_inquiry !== '業者問合せ' && buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {'''

# 置換
text = text.replace(old_code, new_code)

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了: broker_inquiry !== "業者問合せ" 条件を追加しました')
