# -*- coding: utf-8 -*-
"""MUI importに Dialog/FormControl/Select/MenuItem を追加"""

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "  Link,\n} from '@mui/material';"
new = "  Link,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n  FormControl,\n  Select,\n  MenuItem,\n} from '@mui/material';"

if 'Dialog,' not in text:
    if old in text:
        text = text.replace(old, new, 1)
        print('✅ Dialog/FormControl/Select/MenuItem を追加しました')
    else:
        print('❌ 置換対象が見つかりません')
        # デバッグ用
        idx = text.find("from '@mui/material'")
        print(f'  from @mui/material の位置: {idx}')
        print(f'  前後のテキスト: {repr(text[idx-50:idx+30])}')
else:
    print('ℹ️  既にimportされています')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
