#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PageNavigationのハイライト修正 + 検索バー追加
"""

import os

# ===== 1. PageNavigation.tsx のハイライトロジック修正 =====
nav_path = r'frontend/frontend/src/components/PageNavigation.tsx'
with open(nav_path, 'rb') as f:
    content = f.read().decode('utf-8')

old = "const isActive = item.path === '/'\n            ? location.pathname === '/'\n            : location.pathname.startsWith(item.path);"
new = "const isActive = item.path === '/'\n            ? location.pathname === '/' || location.pathname.startsWith('/sellers')\n            : location.pathname.startsWith(item.path);"

if old in content:
    content = content.replace(old, new)
    with open(nav_path, 'wb') as f:
        f.write(content.encode('utf-8'))
    print('✅ PageNavigation.tsx: ハイライトロジック修正完了')
else:
    print('❌ PageNavigation.tsx: 対象文字列が見つかりません')
    # デバッグ用に周辺を表示
    idx = content.find("isActive = item.path === '/'")
    if idx >= 0:
        print('周辺コード:', repr(content[idx:idx+200]))

print()

# ===== 2. CallModePage.tsx に売主番号検索バーを追加 =====
call_path = r'frontend/frontend/src/pages/CallModePage.tsx'
with open(call_path, 'rb') as f:
    content = f.read().decode('utf-8')

# importにSearchIcon, ClearIconを追加（まだない場合）
if 'SearchIcon' not in content:
    old_import = "import { ArrowBack, Phone, Save, CalendarToday, Email, Image as ImageIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';"
    new_import = "import { ArrowBack, Phone, Save, CalendarToday, Email, Image as ImageIcon, ContentCopy as ContentCopyIcon, Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';"
    if old_import in content:
        content = content.replace(old_import, new_import)
        print('✅ CallModePage.tsx: SearchIcon/ClearIcon import追加')
    else:
        print('⚠️ CallModePage.tsx: import行が見つかりません（手動確認が必要）')

# ナビゲーションバーに検索バーを追加
old_nav = """      {/* ナビゲーションバー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
      </Box>"""

new_nav = """      {/* ナビゲーションバー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
        <TextField
          size="small"
          placeholder="売主番号で移動"
          value={sellerNumberSearch}
          onChange={(e) => setSellerNumberSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && sellerNumberSearch.trim()) {
              navigate(`/sellers/${sellerNumberSearch.trim()}`);
              setSellerNumberSearch('');
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: sellerNumberSearch ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setSellerNumberSearch('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ width: 200 }}
        />
      </Box>"""

if old_nav in content:
    content = content.replace(old_nav, new_nav)
    print('✅ CallModePage.tsx: ナビゲーションバーに検索バー追加')
else:
    print('❌ CallModePage.tsx: ナビゲーションバーの対象文字列が見つかりません')

# sellerNumberSearch stateを追加（既存のstateの近くに追加）
if 'sellerNumberSearch' not in content:
    old_state = "  const [snackbarOpen, setSnackbarOpen] = useState(false); // スナックバー表示フラグ"
    new_state = "  const [snackbarOpen, setSnackbarOpen] = useState(false); // スナックバー表示フラグ\n  const [sellerNumberSearch, setSellerNumberSearch] = useState<string>(''); // 売主番号検索"
    if old_state in content:
        content = content.replace(old_state, new_state)
        print('✅ CallModePage.tsx: sellerNumberSearch state追加')
    else:
        print('⚠️ CallModePage.tsx: state追加箇所が見つかりません')

with open(call_path, 'wb') as f:
    f.write(content.encode('utf-8'))
print()

# ===== 3. PropertyListingDetailPage.tsx に物件番号検索バーを追加 =====
prop_path = r'frontend/frontend/src/pages/PropertyListingDetailPage.tsx'
with open(prop_path, 'rb') as f:
    content = f.read().decode('utf-8')

# importにSearchIcon, ClearIcon, InputAdornment, IconButtonを追加
if 'SearchIcon' not in content:
    old_import = "import {\n  ArrowBack as ArrowBackIcon,\n  OpenInNew as OpenInNewIcon,\n  ContentCopy as ContentCopyIcon,\n  Check as CheckIcon,\n  Person as PersonIcon,\n  Phone as PhoneIcon,\n  Email as EmailIcon,\n  Assignment as AssignmentIcon,\n} from '@mui/icons-material';"
    new_import = "import {\n  ArrowBack as ArrowBackIcon,\n  OpenInNew as OpenInNewIcon,\n  ContentCopy as ContentCopyIcon,\n  Check as CheckIcon,\n  Person as PersonIcon,\n  Phone as PhoneIcon,\n  Email as EmailIcon,\n  Assignment as AssignmentIcon,\n  Search as SearchIcon,\n  Clear as ClearIcon,\n} from '@mui/icons-material';"
    if old_import in content:
        content = content.replace(old_import, new_import)
        print('✅ PropertyListingDetailPage.tsx: SearchIcon/ClearIcon import追加')
    else:
        print('⚠️ PropertyListingDetailPage.tsx: import行が見つかりません')

# InputAdornmentがimportに含まれているか確認・追加
if 'InputAdornment' not in content:
    old_mui = "import {\n  Box,\n  Typography,\n  Paper,\n  Button,\n  CircularProgress,\n  IconButton,\n  Snackbar,\n  Alert,\n  Grid,\n  TextField,\n  Link,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n  FormControl,\n  Tooltip,\n  Select,\n  MenuItem,\n} from '@mui/material';"
    new_mui = "import {\n  Box,\n  Typography,\n  Paper,\n  Button,\n  CircularProgress,\n  IconButton,\n  Snackbar,\n  Alert,\n  Grid,\n  TextField,\n  Link,\n  Dialog,\n  DialogTitle,\n  DialogContent,\n  DialogActions,\n  FormControl,\n  Tooltip,\n  Select,\n  MenuItem,\n  InputAdornment,\n} from '@mui/material';"
    if old_mui in content:
        content = content.replace(old_mui, new_mui)
        print('✅ PropertyListingDetailPage.tsx: InputAdornment import追加')
    else:
        print('⚠️ PropertyListingDetailPage.tsx: MUI import行が見つかりません')

# ナビゲーションバーに検索バーを追加
old_nav_prop = """      {/* ナビゲーションバー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
      </Box>"""

new_nav_prop = """      {/* ナビゲーションバー */}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 200, bgcolor: 'background.default', borderBottom: '1px solid', borderColor: 'divider', px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
        <PageNavigation />
        <TextField
          size="small"
          placeholder="物件番号で移動"
          value={propertyNumberSearch}
          onChange={(e) => setPropertyNumberSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && propertyNumberSearch.trim()) {
              navigate(`/property-listings/${propertyNumberSearch.trim()}`);
              setPropertyNumberSearch('');
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: propertyNumberSearch ? (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setPropertyNumberSearch('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
          sx={{ width: 200 }}
        />
      </Box>"""

if old_nav_prop in content:
    content = content.replace(old_nav_prop, new_nav_prop)
    print('✅ PropertyListingDetailPage.tsx: ナビゲーションバーに検索バー追加')
else:
    print('❌ PropertyListingDetailPage.tsx: ナビゲーションバーの対象文字列が見つかりません')

# propertyNumberSearch stateを追加
if 'propertyNumberSearch' not in content:
    old_state_prop = "  const [copiedPropertyNumber, setCopiedPropertyNumber] = useState(false);"
    new_state_prop = "  const [copiedPropertyNumber, setCopiedPropertyNumber] = useState(false);\n  const [propertyNumberSearch, setPropertyNumberSearch] = useState<string>(''); // 物件番号検索"
    if old_state_prop in content:
        content = content.replace(old_state_prop, new_state_prop)
        print('✅ PropertyListingDetailPage.tsx: propertyNumberSearch state追加')
    else:
        print('⚠️ PropertyListingDetailPage.tsx: state追加箇所が見つかりません')

with open(prop_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print()
print('=== 完了 ===')
