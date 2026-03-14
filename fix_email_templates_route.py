#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
emailTemplates.ts の重複コード（古いモック実装）を削除する
"""

with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    content = f.read()

# 改行コードを確認
crlf_count = content.count(b'\r\n')
lf_count = content.count(b'\n') - crlf_count
print(f"CRLF: {crlf_count}, LF only: {lf_count}")

# 統一して処理
text = content.decode('utf-8').replace('\r\n', '\n')

# 問題の箇所を探す
idx = text.find('Placeholder: Return mock data')
if idx >= 0:
    print(f"'Placeholder: Return mock data' found at index {idx}")
    print("Context around it:")
    print(repr(text[max(0, idx-200):idx+200]))
else:
    print("Not found")

# 正しい終端の後に古い残骸がある部分を削除
# 新しい実装の終わり: res.json(mergedContent);\n  } catch ... \n  }\n});\n
# その後に古い残骸が続く

# 古い残骸の開始パターン（新しい実装の });  の直後）
marker = "    res.json(mergedContent);\n  } catch (error: any) {\n    console.error('Error merging template with multiple properties:', error);\n    res.status(500).json({ error: 'Failed to merge template with multiple properties' });\n  }\n});"

idx_marker = text.find(marker)
print(f"\nmarker found at: {idx_marker}")

if idx_marker >= 0:
    # marker の終わり位置
    end_of_marker = idx_marker + len(marker)
    print(f"After marker: {repr(text[end_of_marker:end_of_marker+100])}")
    
    # marker の後に古い残骸がある場合、それを削除して export default router; を追加
    rest = text[end_of_marker:]
    if 'mock data' in rest or 'Placeholder' in rest:
        # 古い残骸を削除
        text = text[:end_of_marker] + '\n\nexport default router;\n'
        print("✅ 古いモック実装を削除しました")
    else:
        print("古い残骸は見つかりませんでした")

# UTF-8 LF で書き込み
with open('backend/src/routes/emailTemplates.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ ファイルを保存しました")

# 確認
with open('backend/src/routes/emailTemplates.ts', 'rb') as f:
    final = f.read().decode('utf-8')

print(f"  ファイルサイズ: {len(final)} 文字")
print(f"  'export default router;' の出現回数: {final.count('export default router;')}")
print(f"  'mock data' の出現回数: {final.count('mock data')}")
