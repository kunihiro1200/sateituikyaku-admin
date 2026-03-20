#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerService.supabase.ts の getSeller 内で
properties クエリと decryptSeller を並列化する
"""

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_code = """    // 物件情報を取得（.single()ではなく配列で取得）
    // propertiesテーブルにはdeleted_atカラムが存在しないためフィルターなし
    const propertyQuery = this.table('properties')
      .select('*')
      .eq('seller_id', sellerId);
    
    const { data: properties, error: propertyError } = await propertyQuery;

    const decryptedSeller = await this.decryptSeller(seller);"""

new_code = """    // 物件情報取得と decryptSeller を並列実行（パフォーマンス改善）
    const [{ data: properties, error: propertyError }, decryptedSeller] = await Promise.all([
      this.table('properties')
        .select('*')
        .eq('seller_id', sellerId),
      this.decryptSeller(seller),
    ]);"""

text = text.replace(old_code, new_code, 1)

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
