#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク5: PropertyListingDetailPage.tsx の型定義を更新する
- Buyer インターフェースに latest_status_updated_at?: string を追加
- PropertyListing インターフェースに offer_status_updated_at?: string を追加
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# タスク5.1: Buyer インターフェースに latest_status_updated_at を追加
old_buyer = """interface Buyer {
  buyer_id?: string;
  id?: number;
  name: string;
  buyer_number?: string;
  confidence_level?: string;
  inquiry_confidence?: string;
  phone?: string;
  phone_number?: string;
  email?: string;
  reception_date?: string;
  viewing_date?: string;
  latest_status?: string;
}"""

new_buyer = """interface Buyer {
  buyer_id?: string;
  id?: number;
  name: string;
  buyer_number?: string;
  confidence_level?: string;
  inquiry_confidence?: string;
  phone?: string;
  phone_number?: string;
  email?: string;
  reception_date?: string;
  viewing_date?: string;
  latest_status?: string;
  latest_status_updated_at?: string;
}"""

if old_buyer in text:
    text = text.replace(old_buyer, new_buyer)
    print("✅ タスク5.1: Buyer インターフェースに latest_status_updated_at を追加しました")
else:
    print("❌ タスク5.1: Buyer インターフェースが見つかりませんでした")

# タスク5.2: PropertyListing インターフェースに offer_status_updated_at を追加
# offer_comment の後に追加する
old_offer = """  offer_date?: string;
  offer_status?: string;
  offer_amount?: string;
  offer_comment?: string;
  company_name?: string;"""

new_offer = """  offer_date?: string;
  offer_status?: string;
  offer_amount?: string;
  offer_comment?: string;
  offer_status_updated_at?: string;
  company_name?: string;"""

if old_offer in text:
    text = text.replace(old_offer, new_offer)
    print("✅ タスク5.2: PropertyListing インターフェースに offer_status_updated_at を追加しました")
else:
    print("❌ タスク5.2: PropertyListing インターフェースの対象箇所が見つかりませんでした")

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("✅ ファイルを保存しました")

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f"BOM check: {repr(first_bytes[:3])} (b'imp' などであればOK)")
