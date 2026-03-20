# -*- coding: utf-8 -*-
# 住所照合を部分一致に変更
# スプレッドシートのE列に「大分県」が含まれるがDBには含まれない場合でも一致させる
# どちらかが相手を含む（includes）で照合

with open('backend/src/routes/sellers.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

old = """      const dateMatch = sellerDateStr && rowDateStr && sellerDateStr === rowDateStr;
      const addressMatch = sellerAddress && rowAddress && sellerAddress === rowAddress;"""

new = """      const dateMatch = sellerDateStr && rowDateStr && sellerDateStr === rowDateStr;
      // 住所は部分一致で照合（スプレッドシートに「大分県」が含まれるがDBにはない場合に対応）
      const addressMatch = sellerAddress && rowAddress && (
        sellerAddress === rowAddress ||
        rowAddress.includes(sellerAddress) ||
        sellerAddress.includes(rowAddress)
      );"""

if old in text:
    text = text.replace(old, new)
    print("✅ 住所照合を部分一致に変更しました")
else:
    print("❌ 対象ブロックが見つかりません")

result = text.replace('\n', '\r\n')
with open('backend/src/routes/sellers.ts', 'wb') as f:
    f.write(result.encode('utf-8'))

print("完了")
