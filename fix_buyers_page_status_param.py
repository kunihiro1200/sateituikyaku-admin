#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyersPage.tsx に URL クエリパラメータ status を読み取る変更を適用する
"""

with open('frontend/frontend/src/pages/BuyersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更1: useNavigate のインポートに useSearchParams を追加
old_import = "import { useNavigate } from 'react-router-dom';"
new_import = "import { useNavigate, useSearchParams } from 'react-router-dom';"
assert old_import in text, f"変更1のターゲットが見つかりません: {old_import}"
text = text.replace(old_import, new_import, 1)

# 変更2: useNavigate() の直後に useSearchParams と initialStatus を追加
old_navigate = "  const navigate = useNavigate();\n  const theme = useTheme();"
new_navigate = "  const navigate = useNavigate();\n  const [searchParams] = useSearchParams();\n  const initialStatus = searchParams.get('status');\n  const theme = useTheme();"
assert old_navigate in text, f"変更2のターゲットが見つかりません"
text = text.replace(old_navigate, new_navigate, 1)

# 変更3: selectedCalculatedStatus の初期値を null から initialStatus に変更
old_state = "  const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(null);"
new_state = "  const [selectedCalculatedStatus, setSelectedCalculatedStatus] = useState<string | null>(initialStatus);"
assert old_state in text, f"変更3のターゲットが見つかりません"
text = text.replace(old_state, new_state, 1)

# UTF-8 (BOMなし) で書き込む
with open('frontend/frontend/src/pages/BuyersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: 3箇所の変更を適用しました')
