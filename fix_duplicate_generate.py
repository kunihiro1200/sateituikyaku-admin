#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
GmailDistributionButton.tsx の重複 generatePriceChangeText を削除し、
props に salesPrice / previousSalesPrice を追加する修正スクリプト
"""

button_path = 'frontend/frontend/src/components/GmailDistributionButton.tsx'

with open(button_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ---- 1. 重複している generatePriceChangeText を1つに統合 ----
duplicate_block = (
    "\r\n  // 価格変更テキストを生成\r\n"
    "  const generatePriceChangeText = (): string => {\r\n"
    "    if (previousSalesPrice && salesPrice && previousSalesPrice !== salesPrice) {\r\n"
    "      const oldMan = Math.floor(previousSalesPrice / 10000);\r\n"
    "      const newMan = Math.floor(salesPrice / 10000);\r\n"
    "      const diffMan = oldMan - newMan;\r\n"
    "      if (diffMan > 0) {\r\n"
    "        return `${oldMan}万円から${newMan}万円に${diffMan}万円値下げしました！問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！`;\r\n"
    "      }\r\n"
    "    }\r\n"
    "    return '現状の価格→変更後の価格';\r\n"
    "  };\r\n"
    "\r\n"
    "  // 価格変更テキストを生成\r\n"
    "  const generatePriceChangeText = (): string => {\r\n"
    "    if (previousSalesPrice && salesPrice && previousSalesPrice !== salesPrice) {\r\n"
    "      const oldMan = Math.floor(previousSalesPrice / 10000);\r\n"
    "      const newMan = Math.floor(salesPrice / 10000);\r\n"
    "      const diffMan = oldMan - newMan;\r\n"
    "      if (diffMan > 0) {\r\n"
    "        return `${oldMan}万円から${newMan}万円に${diffMan}万円値下げしました！問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！`;\r\n"
    "      }\r\n"
    "    }\r\n"
    "    return '現状の価格→変更後の価格';\r\n"
    "  };\r\n"
)

single_block = (
    "\r\n  // 価格変更テキストを生成\r\n"
    "  const generatePriceChangeText = (): string => {\r\n"
    "    if (previousSalesPrice && salesPrice && previousSalesPrice !== salesPrice) {\r\n"
    "      const oldMan = Math.floor(previousSalesPrice / 10000);\r\n"
    "      const newMan = Math.floor(salesPrice / 10000);\r\n"
    "      const diffMan = oldMan - newMan;\r\n"
    "      if (diffMan > 0) {\r\n"
    "        return `${oldMan}万円から${newMan}万円に${diffMan}万円値下げしました！問合せが増えることが予想されますので、ご興味のある方はお早めにご連絡ください！`;\r\n"
    "      }\r\n"
    "    }\r\n"
    "    return '現状の価格→変更後の価格';\r\n"
    "  };\r\n"
)

if duplicate_block in text:
    text = text.replace(duplicate_block, single_block)
    print('✅ 重複した generatePriceChangeText を削除しました')
else:
    print('❌ 重複ブロックが見つかりませんでした（既に修正済みか、改行コードが異なる可能性）')
    # 件数確認
    count = text.count('const generatePriceChangeText')
    print(f'   generatePriceChangeText の出現回数: {count}')

# ---- 2. props インターフェースに salesPrice / previousSalesPrice を追加（未追加の場合のみ） ----
if 'salesPrice?: number;' not in text:
    text = text.replace(
        "  distributionAreas?: string;\r\n  size?: 'small' | 'medium' | 'large';",
        "  distributionAreas?: string;\r\n  salesPrice?: number;\r\n  previousSalesPrice?: number;\r\n  size?: 'small' | 'medium' | 'large';"
    )
    print('✅ props インターフェースに salesPrice / previousSalesPrice を追加しました')
else:
    print('ℹ️  salesPrice は既に props に存在します')

# ---- 3. デストラクチャリングに salesPrice / previousSalesPrice を追加（未追加の場合のみ） ----
if 'salesPrice,\r\n  previousSalesPrice,' not in text:
    text = text.replace(
        "  distributionAreas,\r\n  size = 'small',",
        "  distributionAreas,\r\n  salesPrice,\r\n  previousSalesPrice,\r\n  size = 'small',"
    )
    print('✅ デストラクチャリングに salesPrice / previousSalesPrice を追加しました')
else:
    print('ℹ️  salesPrice は既にデストラクチャリングに存在します')

with open(button_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n完了')
