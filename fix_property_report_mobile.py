#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyReportPage.tsx にスマホ用レイアウトを追加
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/PropertyReportPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- サブタスク3.1: useTheme と useMediaQuery を MUI からインポートし、isMobile を取得 ---
old_mui_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';"""

new_mui_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  Button,
  CircularProgress,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  useMediaQuery,
} from '@mui/material';"""

if old_mui_import in text:
    text = text.replace(old_mui_import, new_mui_import)
    print('✅ サブタスク3.1a: useTheme/useMediaQuery インポート追加完了')
else:
    print('❌ サブタスク3.1a: MUI インポートが見つかりません')
    sys.exit(1)

# isMobile を取得するコードを追加
old_params = "  const { propertyNumber } = useParams<{ propertyNumber: string }>();\n  const navigate = useNavigate();"
new_params = """  const { propertyNumber } = useParams<{ propertyNumber: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));"""

if old_params in text:
    text = text.replace(old_params, new_params)
    print('✅ サブタスク3.1b: isMobile 変数追加完了')
else:
    print('❌ サブタスク3.1b: useParams 行が見つかりません')
    sys.exit(1)

# --- サブタスク3.2: ヘッダーの flexDirection を isMobile ? 'column' : 'row' に変更 ---
old_header = "      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>"
new_header = """      <Box sx={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 2,
        mb: 3,
      }}>"""

if old_header in text:
    text = text.replace(old_header, new_header)
    print('✅ サブタスク3.2: ヘッダー flexDirection 変更完了')
else:
    print('❌ サブタスク3.2: ヘッダー Box が見つかりません')
    sys.exit(1)

# --- サブタスク3.3: 2カラムレイアウトの flexDirection を isMobile ? 'column' : 'row' に変更 ---
old_two_col = "      {/* 左右2カラムレイアウト */}\n      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>"
new_two_col = "      {/* 左右2カラムレイアウト */}\n      <Box sx={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 3, alignItems: 'flex-start' }}>"

if old_two_col in text:
    text = text.replace(old_two_col, new_two_col)
    print('✅ サブタスク3.3: 2カラムレイアウト flexDirection 変更完了')
else:
    print('❌ サブタスク3.3: 2カラムレイアウト Box が見つかりません')
    sys.exit(1)

# --- サブタスク3.4: 左カラムを isMobile 時は width: '100%' に変更 ---
old_left_col = "        {/* 左カラム：報告情報 + Gmail送信 */}\n        <Box sx={{ flex: '0 0 380px', minWidth: 0 }}>"
new_left_col = "        {/* 左カラム：報告情報 + Gmail送信 */}\n        <Box sx={isMobile ? { width: '100%' } : { flex: '0 0 380px', minWidth: 0 }}>"

if old_left_col in text:
    text = text.replace(old_left_col, new_left_col)
    print('✅ サブタスク3.4: 左カラム幅変更完了')
else:
    print('❌ サブタスク3.4: 左カラム Box が見つかりません')
    sys.exit(1)

# --- サブタスク3.5: 送信履歴テーブルを isMobile 時は overflowX: 'auto' で横スクロール可能に変更 ---
old_table_container = "            <TableContainer sx={{ maxHeight: 220, overflow: 'auto' }}>"
new_table_container = "            <TableContainer sx={{ maxHeight: isMobile ? 'none' : 220, overflow: 'auto', overflowX: 'auto' }}>"

if old_table_container in text:
    text = text.replace(old_table_container, new_table_container)
    print('✅ サブタスク3.5: TableContainer 横スクロール変更完了')
else:
    print('❌ サブタスク3.5: TableContainer が見つかりません')
    sys.exit(1)

# UTF-8 で書き込む（BOMなし）
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ PropertyReportPage.tsx の変更が完了しました')

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (should NOT be b\'\\xef\\xbb\\xbf\')')
