#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
タスク3.6: 郵送フィールドに査定方法変更日時の表示を追加
seller.updatedAt を使って「（更新日時）」を郵送フィールドのラベルに表示する
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 査定額あり・非編集モードの郵送フィールドに日時表示を追加
# ============================================================
old_datetime_1 = """                    {/* 郵送フィールド - 査定方法が「郵送」系の場合のみ表示 */}
                    {editedValuationMethod.includes('郵送') && (
                      <Box sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 1, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          郵送
                        </Typography>"""

new_datetime_1 = """                    {/* 郵送フィールド - 査定方法が「郵送」系の場合のみ表示 */}
                    {editedValuationMethod.includes('郵送') && (
                      <Box sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 1, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          郵送
                          {seller?.updatedAt && (
                            <span style={{ marginLeft: 8, color: '#888', fontSize: '0.75rem' }}>
                              （{formatDateTime(seller.updatedAt)}）
                            </span>
                          )}
                        </Typography>"""

assert old_datetime_1 in text, "タスク3.6（非編集モード）: 挿入箇所が見つかりません"
text = text.replace(old_datetime_1, new_datetime_1, 1)
print("✅ タスク3.6: 郵送フィールド（非編集モード）に日時表示を追加しました")

# ============================================================
# 編集モードの郵送フィールドにも日時表示を追加
# ============================================================
old_datetime_2 = """                      {/* 郵送フィールド（編集モード） - 査定方法が「郵送」系の場合のみ表示 */}
                      {editedValuationMethod.includes('郵送') && (
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              郵送
                            </Typography>"""

new_datetime_2 = """                      {/* 郵送フィールド（編集モード） - 査定方法が「郵送」系の場合のみ表示 */}
                      {editedValuationMethod.includes('郵送') && (
                        <Grid item xs={12}>
                          <Box sx={{ p: 2, bgcolor: 'info.50', border: '1px solid', borderColor: 'info.200', borderRadius: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                              郵送
                              {seller?.updatedAt && (
                                <span style={{ marginLeft: 8, color: '#888', fontSize: '0.75rem' }}>
                                  （{formatDateTime(seller.updatedAt)}）
                                </span>
                              )}
                            </Typography>"""

assert old_datetime_2 in text, "タスク3.6（編集モード）: 挿入箇所が見つかりません"
text = text.replace(old_datetime_2, new_datetime_2, 1)
print("✅ タスク3.6: 郵送フィールド（編集モード）に日時表示を追加しました")

# ============================================================
# UTF-8で書き込む（BOMなし）
# ============================================================
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n🎉 タスク3.6の変更を適用しました（UTF-8エンコーディング保持）")

# BOMチェック
with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f"BOMチェック: {repr(first_bytes[:3])}")
