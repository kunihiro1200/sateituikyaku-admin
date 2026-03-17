# -*- coding: utf-8 -*-
"""MUI importに Dialog/FormControl/Select/MenuItem を追加（強制版）"""

filepath = 'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# Link, の後に追加
old = "  Link,\n} from '@mui/material';"
new = "  Link,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n  FormControl,\n  Select,\n  MenuItem,\n} from '@mui/material';"

print(f"'Link,' in text: {'  Link,' in text}")
print(f"old in text: {old in text}")

# 実際のテキストを確認
idx = text.find("} from '@mui/material'")
print(f"位置: {idx}")
print(f"前後: {repr(text[idx-30:idx+25])}")

if old in text:
    text = text.replace(old, new, 1)
    print('✅ 置換成功')
else:
    # 別のパターンを試す
    old2 = "  Link,\r\n} from '@mui/material';"
    if old2 in text:
        new2 = "  Link,\r\n  Dialog,\r\n  DialogTitle,\r\n  DialogContent,\r\n  DialogActions,\r\n  FormControl,\r\n  Select,\r\n  MenuItem,\r\n} from '@mui/material';"
        text = text.replace(old2, new2, 1)
        print('✅ CRLF版で置換成功')
    else:
        print('❌ 置換失敗')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))
