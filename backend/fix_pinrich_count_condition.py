# fix_pinrich_count_condition.py
# getSidebarCountsFallbackのpinrichUnregisteredカウント条件を
# getBuyersByStatusのフィルタ条件と一致させる

with open('src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧: email/broker_inquiryなしの条件
old = """      // Pinrich未登録: pinrichが空欄・「登録無し」かつ reception_date >= '2026-01-01'（動的計算）
      allBuyers.forEach((buyer: any) => {
        const pinrich = buyer.pinrich ?? '';
        const isPinrichUnregistered = pinrich === '' || pinrich === null || pinrich === '登録無し';
        if (
          isPinrichUnregistered &&
          buyer.reception_date && buyer.reception_date >= '2026-01-01'
        ) {
          result.pinrichUnregistered++;
        }
      });"""

# 新: getBuyersByStatusと完全一致する条件（email/broker_inquiryを含む）
new = """      // Pinrich未登録: getBuyersByStatusのフィルタ条件と完全一致させる
      // pinrichが空欄・「登録無し」かつ email存在 かつ broker_inquiry空欄 かつ reception_date >= '2026-01-01'
      allBuyers.forEach((buyer: any) => {
        const pinrich = buyer.pinrich ?? '';
        const isPinrichUnregistered = pinrich === '' || pinrich === null || pinrich === '登録無し';
        if (
          isPinrichUnregistered &&
          buyer.email && String(buyer.email).trim() &&
          (!buyer.broker_inquiry || buyer.broker_inquiry === '' || buyer.broker_inquiry === '0') &&
          buyer.reception_date && buyer.reception_date >= '2026-01-01'
        ) {
          result.pinrichUnregistered++;
        }
      });"""

if old in text:
    text = text.replace(old, new)
    print('✅ getSidebarCountsFallback の pinrichUnregistered 条件を修正しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用に周辺を表示
    idx = text.find('Pinrich未登録: pinrichが空欄')
    if idx >= 0:
        print(f'  周辺テキスト: {repr(text[idx:idx+300])}')

with open('src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
