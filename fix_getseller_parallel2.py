#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellerService.supabase.ts (CRLF) の getSeller 内で
properties クエリと decryptSeller を並列化する
"""

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

# CRLF のまま処理
old_code = (
    b"    // \xe7\x89\xa9\xe4\xbb\xb6\xe6\x83\x85\xe5\xa0\xb1\xe3\x82\x92\xe5\x8f\x96\xe5\xbe\x97\xef\xbc\x88.single()\xe3\x81\xa7\xe3\x81\xaf\xe3\x81\xaa\xe3\x81\x8f\xe9\x85\x8d\xe5\x88\x97\xe3\x81\xa7\xe5\x8f\x96\xe5\xbe\x97\xef\xbc\x89\r\n"
    b"    // properties\xe3\x83\x86\xe3\x83\xbc\xe3\x83\x96\xe3\x83\xab\xe3\x81\xab\xe3\x81\xafdeleted_at\xe3\x82\xab\xe3\x83\xa9\xe3\x83\xa0\xe3\x81\x8c\xe5\xad\x98\xe5\x9c\xa8\xe3\x81\x97\xe3\x81\xaa\xe3\x81\x84\xe3\x81\x9f\xe3\x82\x81\xe3\x83\x95\xe3\x82\xa3\xe3\x83\xab\xe3\x82\xbf\xe3\x83\xbc\xe3\x81\xaa\xe3\x81\x97\r\n"
    b"    const propertyQuery = this.table('properties')\r\n"
    b"      .select('*')\r\n"
    b"      .eq('seller_id', sellerId);\r\n"
    b"    \r\n"
    b"    const { data: properties, error: propertyError } = await propertyQuery;\r\n"
    b"\r\n"
    b"    const decryptedSeller = await this.decryptSeller(seller);"
)

new_code = (
    b"    // \xe7\x89\xa9\xe4\xbb\xb6\xe6\x83\x85\xe5\xa0\xb1\xe5\x8f\x96\xe5\xbe\x97\xe3\x81\xa8 decryptSeller \xe3\x82\x92\xe4\xb8\xa6\xe5\x88\x97\xe5\xae\x9f\xe8\xa1\x8c\xef\xbc\x88\xe3\x83\x91\xe3\x83\x95\xe3\x82\xa9\xe3\x83\xbc\xe3\x83\x9e\xe3\x83\xb3\xe3\x82\xb9\xe6\x94\xb9\xe5\x96\x84\xef\xbc\x89\r\n"
    b"    const [{ data: properties, error: propertyError }, decryptedSeller] = await Promise.all([\r\n"
    b"      this.table('properties')\r\n"
    b"        .select('*')\r\n"
    b"        .eq('seller_id', sellerId),\r\n"
    b"      this.decryptSeller(seller),\r\n"
    b"    ]);"
)

if old_code in content:
    content = content.replace(old_code, new_code, 1)
    print('Replacement successful!')
else:
    print('ERROR: target not found, trying alternative approach...')
    # 代替: テキストとして処理（CRLF保持）
    text = content.decode('utf-8')
    old_text = (
        "    // 物件情報を取得（.single()ではなく配列で取得）\r\n"
        "    // propertiesテーブルにはdeleted_atカラムが存在しないためフィルターなし\r\n"
        "    const propertyQuery = this.table('properties')\r\n"
        "      .select('*')\r\n"
        "      .eq('seller_id', sellerId);\r\n"
        "    \r\n"
        "    const { data: properties, error: propertyError } = await propertyQuery;\r\n"
        "\r\n"
        "    const decryptedSeller = await this.decryptSeller(seller);"
    )
    new_text = (
        "    // 物件情報取得と decryptSeller を並列実行（パフォーマンス改善）\r\n"
        "    const [{ data: properties, error: propertyError }, decryptedSeller] = await Promise.all([\r\n"
        "      this.table('properties')\r\n"
        "        .select('*')\r\n"
        "        .eq('seller_id', sellerId),\r\n"
        "      this.decryptSeller(seller),\r\n"
        "    ]);"
    )
    if old_text in text:
        text = text.replace(old_text, new_text, 1)
        content = text.encode('utf-8')
        print('Alternative replacement successful!')
    else:
        print('ERROR: alternative also failed')
        import sys
        sys.exit(1)

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(content)

print('Done!')
