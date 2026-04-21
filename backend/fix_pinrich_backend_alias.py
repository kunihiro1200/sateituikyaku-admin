# fix_pinrich_backend_alias.py
# getBuyersByStatusで日本語の'ピンリッチ未登録'が渡された場合も
# 英語キー'pinrichUnregistered'と同じフィルタを使うよう修正

with open('src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 旧: pinrichUnregisteredのみ英語キーで判定
old = """      } else if (status === 'pinrichUnregistered') {
        // Pinrich未登録: pinrichが空欄・「登録無し」かつ reception_date >= '2026-01-01'
        console.log(`[getBuyersByStatus] pinrichUnregistered カテゴリ検出`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          const pinrich = buyer.pinrich ?? '';
          const isPinrichUnregistered = pinrich === '' || pinrich === null || pinrich === '登録無し';
          return (
            isPinrichUnregistered &&
            buyer.email && String(buyer.email).trim() &&
            (!buyer.broker_inquiry || buyer.broker_inquiry === '' || buyer.broker_inquiry === '0') &&
            buyer.reception_date && buyer.reception_date >= '2026-01-01'
          );
        });
        console.log(`[getBuyersByStatus] pinrichUnregistered フィルタ結果: ${filteredBuyers.length}件`);"""

# 新: 英語キーと日本語名の両方に対応
new = """      } else if (status === 'pinrichUnregistered' || status === 'ピンリッチ未登録') {
        // Pinrich未登録: pinrichが空欄・「登録無し」かつ reception_date >= '2026-01-01'
        // 英語キー('pinrichUnregistered')と日本語名('ピンリッチ未登録')の両方に対応
        console.log(`[getBuyersByStatus] pinrichUnregistered カテゴリ検出 (status=${status})`);
        filteredBuyers = allBuyers.filter((buyer: any) => {
          const pinrich = buyer.pinrich ?? '';
          const isPinrichUnregistered = pinrich === '' || pinrich === null || pinrich === '登録無し';
          return (
            isPinrichUnregistered &&
            buyer.email && String(buyer.email).trim() &&
            (!buyer.broker_inquiry || buyer.broker_inquiry === '' || buyer.broker_inquiry === '0') &&
            buyer.reception_date && buyer.reception_date >= '2026-01-01'
          );
        });
        console.log(`[getBuyersByStatus] pinrichUnregistered フィルタ結果: ${filteredBuyers.length}件`);"""

if old in text:
    text = text.replace(old, new)
    print('✅ BuyerService.ts の getBuyersByStatus 日本語エイリアス修正完了')
else:
    print('❌ 対象文字列が見つかりませんでした')
    idx = text.find("status === 'pinrichUnregistered'")
    if idx >= 0:
        print(f'  周辺テキスト: {repr(text[idx:idx+400])}')

with open('src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
