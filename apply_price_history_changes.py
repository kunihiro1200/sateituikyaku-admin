#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx に値下げ履歴自動追記ロジックを追加するスクリプト
改行コード CRLF 対応版
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF を LF に正規化して処理
text_lf = text.replace('\r\n', '\n')

old_func = (
    "  const handleSavePrice = async () => {\n"
    "    if (!propertyNumber || Object.keys(editedData).length === 0) return;\n"
    "    try {\n"
    "      await api.put(`/api/property-listings/${propertyNumber}`, editedData);\n"
    "      setSnackbar({\n"
    "        open: true,\n"
    "        message: '\u4fa1\u683c\u60c5\u5831\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f',\n"
    "        severity: 'success',\n"
    "      });\n"
    "      await fetchPropertyData();\n"
    "      setEditedData({});\n"
    "    } catch (error) {\n"
    "      setSnackbar({\n"
    "        open: true,\n"
    "        message: '\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f',\n"
    "        severity: 'error',\n"
    "      });\n"
    "      throw error;\n"
    "    }\n"
    "  };"
)

new_func = (
    "  const handleSavePrice = async () => {\n"
    "    if (!propertyNumber || Object.keys(editedData).length === 0) return;\n"
    "\n"
    "    // \u4fa1\u683c\u5909\u66f4\u306e\u691c\u51fa\u3068\u5024\u4e0b\u3052\u5c65\u6b74\u306e\u81ea\u52d5\u8ffd\u8a18\n"
    "    const newSalesPrice = editedData.sales_price;\n"
    "    const oldSalesPrice = data?.sales_price;\n"
    "\n"
    "    let dataToSave = { ...editedData };\n"
    "\n"
    "    if (newSalesPrice !== undefined && newSalesPrice !== null && newSalesPrice !== oldSalesPrice) {\n"
    "      const initials = employee?.initials ?? '';\n"
    "      const now = new Date();\n"
    "      const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;\n"
    "      const existingHistory =\n"
    "        editedData.price_reduction_history !== undefined\n"
    "          ? editedData.price_reduction_history\n"
    "          : (data?.price_reduction_history ?? '');\n"
    "      const updatedHistory = buildUpdatedHistory(\n"
    "        oldSalesPrice,\n"
    "        newSalesPrice,\n"
    "        initials,\n"
    "        existingHistory,\n"
    "        dateStr\n"
    "      );\n"
    "      dataToSave = { ...dataToSave, price_reduction_history: updatedHistory };\n"
    "    }\n"
    "\n"
    "    try {\n"
    "      await api.put(`/api/property-listings/${propertyNumber}`, dataToSave);\n"
    "      setSnackbar({\n"
    "        open: true,\n"
    "        message: '\u4fa1\u683c\u60c5\u5831\u3092\u4fdd\u5b58\u3057\u307e\u3057\u305f',\n"
    "        severity: 'success',\n"
    "      });\n"
    "      await fetchPropertyData();\n"
    "      setEditedData({});\n"
    "    } catch (error) {\n"
    "      setSnackbar({\n"
    "        open: true,\n"
    "        message: '\u4fdd\u5b58\u306b\u5931\u6557\u3057\u307e\u3057\u305f',\n"
    "        severity: 'error',\n"
    "      });\n"
    "      throw error;\n"
    "    }\n"
    "  };"
)

if old_func in text_lf:
    text_lf = text_lf.replace(old_func, new_func, 1)
    print('✅ handleSavePrice を修正しました')
else:
    print('❌ handleSavePrice の対象が見つかりませんでした')

# UTF-8（BOMなし、LF）で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text_lf.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (b\'imp\' などであればOK)')
