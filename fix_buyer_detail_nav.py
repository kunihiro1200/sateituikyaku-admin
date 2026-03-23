#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BuyerDetailPage.tsx にPageNavigation + 買主番号検索バーを追加"""

import sys

filepath = r'frontend\frontend\src\pages\BuyerDetailPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. PageNavigation と TextField/InputAdornment/Search/Clear のインポートを追加
old_import = "import { SmsDropdownButton } from '../components/SmsDropdownButton';"
new_import = """import { SmsDropdownButton } from '../components/SmsDropdownButton';
import PageNavigation from '../components/PageNavigation';"""

if old_import not in text:
    print("ERROR: import target not found")
    sys.exit(1)

text = text.replace(old_import, new_import, 1)

# 2. TextField と InputAdornment を MUI インポートに追加
old_mui = "  FormControl,\n  Select,\n  InputLabel,\n  MenuItem,\n} from '@mui/material';"
new_mui = """  FormControl,
  Select,
  InputLabel,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material';"""

if old_mui not in text:
    print("ERROR: MUI import target not found")
    sys.exit(1)

text = text.replace(old_mui, new_mui, 1)

# 3. Search と Clear アイコンを追加
old_icons = "  Home as HomeIcon,\n} from '@mui/icons-material';"
new_icons = """  Home as HomeIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';"""

if old_icons not in text:
    print("ERROR: icons import target not found")
    sys.exit(1)

text = text.replace(old_icons, new_icons, 1)

# 4. buyerNumberSearch state を追加（hearingSaving の後）
old_state = "  const [hearingSaving, setHearingSaving] = useState(false);"
new_state = """  const [hearingSaving, setHearingSaving] = useState(false);
  // 買主番号検索バー用
  const [buyerNumberSearch, setBuyerNumberSearch] = useState('');"""

if old_state not in text:
    print("ERROR: state target not found")
    sys.exit(1)

text = text.replace(old_state, new_state, 1)

# 5. return文の最初の Box の直後に PageNavigation + 検索バーを追加
old_return_start = "  return (\n    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>\n      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>"

new_return_start = """  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* ナビゲーションバー + 買主番号検索バー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
        <TextField
          size="small"
          placeholder="買主番号"
          value={buyerNumberSearch}
          onChange={(e) => setBuyerNumberSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              navigate(`/buyers/${buyerNumberSearch.trim()}`);
            }
          }}
          sx={{ width: 160 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            endAdornment: buyerNumberSearch ? (
              <InputAdornment position="end">
                <ClearIcon
                  fontSize="small"
                  sx={{ cursor: 'pointer', color: 'text.secondary' }}
                  onClick={() => setBuyerNumberSearch('')}
                />
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>"""

if old_return_start not in text:
    print("ERROR: return start target not found")
    # デバッグ用に周辺テキストを表示
    idx = text.find("return (")
    if idx >= 0:
        print("Found 'return (' at index:", idx)
        print("Context:", repr(text[idx:idx+300]))
    sys.exit(1)

text = text.replace(old_return_start, new_return_start, 1)

# UTF-8 (BOMなし) で書き込む
with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done! BuyerDetailPage.tsx updated successfully.")
