#!/usr/bin/env python3
# BuyerDetailPage.tsx の MUI インポートに FormControl, Select, InputLabel, MenuItem を追加

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 既存のMUIインポートに追加
old_import = """  Tooltip,
} from '@mui/material';"""

new_import = """  Tooltip,
  FormControl,
  Select,
  InputLabel,
  MenuItem,
} from '@mui/material';"""

if old_import in text:
    text = text.replace(old_import, new_import)
    print('✅ MUIインポートを更新しました')
else:
    print('❌ 対象文字列が見つかりませんでした')
    # デバッグ用
    idx = text.find('Tooltip,')
    print(f'Tooltip の位置: {idx}')
    print(repr(text[idx:idx+50]))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
