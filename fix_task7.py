#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク7: PropertyListingDetailPage.tsx の PurchaseStatusBadge 呼び出し箇所を更新する
latest_status_updated_at と offer_status_updated_at を getPurchaseStatusText に渡す
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 現在の呼び出し箇所を新しい呼び出し箇所に置換
old_call = """              <PurchaseStatusBadge
                statusText={getPurchaseStatusText(
                  buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status,
                  data.offer_status
                )}
              />"""

new_call = """              <PurchaseStatusBadge
                statusText={getPurchaseStatusText(
                  buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status,
                  data.offer_status,
                  buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status_updated_at,
                  data.offer_status_updated_at
                )}
              />"""

if old_call in text:
    text = text.replace(old_call, new_call)
    print("✅ タスク7.1: PurchaseStatusBadge 呼び出し箇所を更新しました")
else:
    print("❌ タスク7.1: 対象箇所が見つかりませんでした")
    # デバッグ用: 周辺テキストを確認
    idx = text.find('PurchaseStatusBadge')
    if idx >= 0:
        print(f"PurchaseStatusBadge の位置: {idx}")
        print(repr(text[idx:idx+300]))

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ ファイルを保存しました")

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f"BOM check: {repr(first_bytes[:3])}")
