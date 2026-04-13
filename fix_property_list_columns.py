#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingsPage.tsx の列変更を適用するスクリプト
- 「公開URL」「格納先URL」列を削除
- 「所在地」列の直後に「住居表示」列を追加
- colSpan を 12 → 11 に更新
- PublicUrlCell インポートを削除
"""

import re

FILE_PATH = 'frontend/frontend/src/pages/PropertyListingsPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. PublicUrlCell インポート行を削除
text = text.replace(
    "import PublicUrlCell from '../components/PublicUrlCell';\n",
    ""
)

# 2. テーブルヘッダーから「公開URL」を削除
text = text.replace(
    "                  <TableCell>公開URL</TableCell>\n",
    ""
)

# 3. テーブルヘッダーから「格納先URL」を削除
text = text.replace(
    "                  <TableCell>格納先URL</TableCell>\n",
    ""
)

# 4. テーブルヘッダーの「所在地」直後に「住居表示」を追加
text = text.replace(
    "                  <TableCell>所在地</TableCell>\n                  <TableCell>売主</TableCell>",
    "                  <TableCell>所在地</TableCell>\n                  <TableCell>住居表示</TableCell>\n                  <TableCell>売主</TableCell>"
)

# 5. データ行から PublicUrlCell を含む TableCell ブロックを削除
text = text.replace(
    "                        <TableCell onClick={(e) => e.stopPropagation()}>\n                          <PublicUrlCell propertyNumber={listing.property_number} />\n                        </TableCell>\n",
    ""
)

# 6. データ行から storage_location を使う Link を含む TableCell ブロックを削除
old_storage_cell = (
    "                        <TableCell onClick={(e) => e.stopPropagation()}>\n"
    "                          {listing.storage_location ? (\n"
    "                            <Link\n"
    "                              href={listing.storage_location}\n"
    "                              target=\"_blank\"\n"
    "                              rel=\"noopener noreferrer\"\n"
    "                              underline=\"hover\"\n"
    "                              sx={{ fontSize: '0.875rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}\n"
    "                            >\n"
    "                              Google Drive\n"
    "                            </Link>\n"
    "                          ) : (\n"
    "                            <Typography variant=\"body2\" color=\"text.secondary\">-</Typography>\n"
    "                          )}\n"
    "                        </TableCell>\n"
)
text = text.replace(old_storage_cell, "")

# 7. データ行の「所在地」セルの直後に「住居表示」セルを追加
old_address_cell = (
    "                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>\n"
    "                          {listing.address || listing.display_address || '-'}\n"
    "                        </TableCell>\n"
    "                        <TableCell>{listing.seller_name || '-'}</TableCell>"
)
new_address_cell = (
    "                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>\n"
    "                          {listing.address || listing.display_address || '-'}\n"
    "                        </TableCell>\n"
    "                        <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>\n"
    "                          {listing.display_address || '-'}\n"
    "                        </TableCell>\n"
    "                        <TableCell>{listing.seller_name || '-'}</TableCell>"
)
text = text.replace(old_address_cell, new_address_cell)

# 8. colSpan={12} を colSpan={11} に更新（2箇所）
text = text.replace("colSpan={12}", "colSpan={11}")

# UTF-8 で書き込む（BOMなし）
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done! 変更を適用しました。")

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
print(f"BOM check: {repr(head)} (b'imp' などであればOK)")
