# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx に変更前の値を保持する ref を追加するスクリプト
UTF-8エンコーディングを保護しながら変更を適用する
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/BuyerDetailPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ============================================================
# 変更1: hearingEditorRef の直前に initialInquiryEmailPhoneRef と
#         initialInquiryHearingRef を追加する
# ============================================================
OLD_REF_BLOCK = '  // ヒアリング項目用RichTextEditorのref\n  const hearingEditorRef = useRef<RichTextCommentEditorHandle>(null);'
NEW_REF_BLOCK = (
    '  // 変更前の値を保持（_THISROW_BEFORE相当）\n'
    '  const initialInquiryEmailPhoneRef = useRef<string>(\'\');\n'
    '  const initialInquiryHearingRef = useRef<string>(\'\');\n'
    '\n'
    '  // ヒアリング項目用RichTextEditorのref\n'
    '  const hearingEditorRef = useRef<RichTextCommentEditorHandle>(null);'
)

if OLD_REF_BLOCK not in text:
    print('ERROR: ref 挿入位置が見つかりませんでした。')
    sys.exit(1)

text = text.replace(OLD_REF_BLOCK, NEW_REF_BLOCK, 1)
print('✅ 変更1: ref を追加しました')

# ============================================================
# 変更2: fetchBuyer() 内で初期値を記録する
#         setHearingEditValue の直後に追加する
# ============================================================
OLD_FETCH_BLOCK = (
    '      // ヒアリング項目の初期値をセット（HTML形式で保存されている場合はそのまま）\n'
    '      setHearingEditValue(res.data.inquiry_hearing || \'\');\n'
    '      // 担当への伝言/質問事項の初期値をセット'
)
NEW_FETCH_BLOCK = (
    '      // ヒアリング項目の初期値をセット（HTML形式で保存されている場合はそのまま）\n'
    '      setHearingEditValue(res.data.inquiry_hearing || \'\');\n'
    '      // 変更前の値として記録（_THISROW_BEFORE相当）\n'
    '      initialInquiryEmailPhoneRef.current = res.data.inquiry_email_phone || \'\';\n'
    '      initialInquiryHearingRef.current = res.data.inquiry_hearing || \'\';\n'
    '      // 担当への伝言/質問事項の初期値をセット'
)

if OLD_FETCH_BLOCK not in text:
    print('ERROR: fetchBuyer 内の挿入位置が見つかりませんでした。')
    sys.exit(1)

text = text.replace(OLD_FETCH_BLOCK, NEW_FETCH_BLOCK, 1)
print('✅ 変更2: fetchBuyer() に初期値記録を追加しました')

# ============================================================
# UTF-8 (BOMなし) で書き込む
# ============================================================
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print(f'✅ {FILE_PATH} を UTF-8 で保存しました')

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    head = f.read(3)
if head == b'\xef\xbb\xbf':
    print('⚠️  WARNING: BOM が検出されました')
else:
    print('✅ BOM なし UTF-8 で保存されています')
