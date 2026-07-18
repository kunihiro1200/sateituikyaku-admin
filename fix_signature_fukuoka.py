#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OtherCompanyDistributionPage.tsx の署名を福岡/大分で切り替えるように修正するスクリプト
"""

file_path = r'C:\Users\kunih\sateituikyaku-admin\frontend\frontend\src\pages\OtherCompanyDistributionPage.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 変更1: SIGNATURE_EMAIL 定数を削除し、getSignatureEmail 関数に置き換え
# ============================================================
# 実際のファイル内の文字列（テンプレートリテラル内の \n は \\n として保存されている）

old_str = (
    'SIGNATURE_EMAIL = `\\\\n\\\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7'
    '\\\\n\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046'
    '\\\\n\u5927\u5206\u5e02\u821e\u9db4\u753a1-3-30'
    '\\\\nST\u30d3\u30eb\uff11F'
    '\\\\n097-533-2022'
    '\\\\ntenant@ifoo-oita.com'
    '\\\\n\u5b9a\u4f11\u65e5\uff1a\u6c34\u66dc'
    '\\\\n\u55b6\u696d\u6642\u9593\uff1a10\u6642\uff5e18\u6642'
    '\\\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7`;'
)

# 実際にファイルに保存されているのは \\n (2文字: バックスラッシュ+n)
# Pythonの文字列で \\n は 実際の文字列として \n（バックスラッシュ+n）を表す
old_search = (
    'SIGNATURE_EMAIL = `\\n\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7'
    '\\n\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046'
    '\\n\u5927\u5206\u5e02\u821e\u9db4\u753a1-3-30'
    '\\nST\u30d3\u30eb\uff11F'
    '\\n097-533-2022'
    '\\ntenant@ifoo-oita.com'
    '\\n\u5b9a\u4f11\u65e5\uff1a\u6c34\u66dc'
    '\\n\u55b6\u696d\u6642\u9593\uff1a10\u6642\uff5e18\u6642'
    '\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7`;'
)

if old_search not in text:
    print('ERROR: 置換対象の SIGNATURE_EMAIL が見つかりません。')
    idx = text.find('SIGNATURE_EMAIL')
    if idx >= 0:
        print('実際の内容:')
        print(repr(text[idx:idx+300]))
    exit(1)

new_str = (
    '// 署名を物件住所（福岡県か否か）に応じて切り替える関数\n'
    'const getSignatureEmail = (address?: string): string => {\n'
    '  const isFukuoka = address ? address.includes(\'\u798f\u5ca1\') : false;\n'
    '  if (isFukuoka) {\n'
    '    return `\\n\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7'
    '\\n\u682a\u5f0f\u4f1a\u793e\u304f\u3058\u3089\u4e0d\u52d5\u7523'
    '\\n\u798f\u5ca1\u5e02\u4e2d\u592e\u533a\u821e\u97403\uff0d1\uff0d10'
    '\\nTEL\uff1a092-401-5331'
    '\\nMAIL: tenant@ifoo-oita.com'
    '\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7`;\n'
    '  }\n'
    '  // デフォルト：大分店署名\n'
    '  return `\\n\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7'
    '\\n\u682a\u5f0f\u4f1a\u793e\u3044\u3075\u3046'
    '\\n\u5927\u5206\u5e02\u821e\u9db4\u753a1-3-30'
    '\\nST\u30d3\u30eb\uff11F'
    '\\n097-533-2022'
    '\\ntenant@ifoo-oita.com'
    '\\n\u5b9a\u4f11\u65e5\uff1a\u6c34\u66dc'
    '\\n\u55b6\u696d\u6642\u9593\uff1a10\u6642\uff5e18\u6642'
    '\\n\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7\u00d7`;\n'
    '};'
)

text = text.replace(old_search, new_str, 1)
print('変更1: SIGNATURE_EMAIL -> getSignatureEmail 関数 完了')

# ============================================================
# 変更2: buildEmailBody 内の SIGNATURE_EMAIL 参照を変更（2箇所）
# ============================================================
old_sig_ref = "${SIGNATURE_EMAIL.replace(/\\n/g, '<br>')}"
new_sig_ref = "${getSignatureEmail(previewData?.address).replace(/\\n/g, '<br>')}"

count = text.count(old_sig_ref)
if count == 0:
    print('ERROR: buildEmailBody 内の SIGNATURE_EMAIL 参照が見つかりません。')
    idx = text.find('SIGNATURE_EMAIL')
    if idx >= 0:
        print(repr(text[max(0,idx-50):idx+200]))
    exit(1)

text = text.replace(old_sig_ref, new_sig_ref)
print(f'変更2: SIGNATURE_EMAIL.replace 参照 {count}箇所 -> getSignatureEmail 完了')

# 残存チェック
remaining = text.find('SIGNATURE_EMAIL')
if remaining >= 0:
    print(f'WARNING: まだ SIGNATURE_EMAIL が残っています (pos={remaining})。手動で確認してください。')
    print(repr(text[max(0,remaining-50):remaining+200]))
else:
    print('全ての SIGNATURE_EMAIL 箇所が置換されました。')

# UTF-8で書き込む（BOMなし）
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了！ファイルを保存しました。')

# BOMチェック
with open(file_path, 'rb') as f:
    head = f.read(3)
if head == b'\xef\xbb\xbf':
    print('WARNING: BOM付き UTF-8 です。BOMを削除してください。')
else:
    print('BOMチェック OK（BOMなし UTF-8）')
