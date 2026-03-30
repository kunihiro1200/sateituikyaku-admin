#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingsPage.tsx のスマホ版ステータスフィルターを Accordion 形式に変更
"""

import sys

FILE_PATH = 'frontend/frontend/src/pages/PropertyListingsPage.tsx'

with open(FILE_PATH, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# --- サブタスク1.1: MUI インポートに Accordion, AccordionSummary, AccordionDetails を追加 ---
old_mui_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Checkbox,
  Button,
  Link,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search as SearchIcon, ClearAll as ClearAllIcon, Clear as ClearIcon } from '@mui/icons-material';"""

new_mui_import = """import {
  Container,
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Badge,
  Checkbox,
  Button,
  Link,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { Search as SearchIcon, ClearAll as ClearAllIcon, Clear as ClearIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';"""

if old_mui_import in text:
    text = text.replace(old_mui_import, new_mui_import)
    print('✅ サブタスク1.1: MUI インポート更新完了')
else:
    print('❌ サブタスク1.1: MUI インポートが見つかりません')
    sys.exit(1)

# --- サブタスク1.2: mobileStatusOpen state を削除し、mobileAccordionExpanded state を追加 ---
old_state = "  // スマホ時のアコーディオン開閉状態\n  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);"
new_state = "  // スマホ時のアコーディオン開閉状態\n  const [mobileAccordionExpanded, setMobileAccordionExpanded] = useState(false);"

if old_state in text:
    text = text.replace(old_state, new_state)
    print('✅ サブタスク1.2: state 変更完了')
else:
    print('❌ サブタスク1.2: mobileStatusOpen state が見つかりません')
    sys.exit(1)

# --- サブタスク1.3: ヘッダー内の「ステータス ▼」ボタンを削除 ---
old_header_button = """        {/* スマホ時：ステータス・担当者フィルターボタン */}
        {isMobile && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant={sidebarStatus && sidebarStatus !== 'all' ? 'contained' : 'outlined'}
              onClick={() => setMobileStatusOpen(!mobileStatusOpen)}
              sx={{ fontSize: '0.75rem', py: 0.5, color: sidebarStatus && sidebarStatus !== 'all' ? '#fff' : SECTION_COLORS.property.main, borderColor: SECTION_COLORS.property.main, bgcolor: sidebarStatus && sidebarStatus !== 'all' ? SECTION_COLORS.property.main : undefined }}
            >
              ステータス {mobileStatusOpen ? '▲' : '▼'}
            </Button>
          </Box>
        )}"""

if old_header_button in text:
    text = text.replace(old_header_button, '')
    print('✅ サブタスク1.3: ヘッダーボタン削除完了')
else:
    print('❌ サブタスク1.3: ヘッダーボタンが見つかりません')
    sys.exit(1)

# --- サブタスク1.4: スマホ版のステータスフィルター表示を Accordion 形式に変更 ---
old_sidebar = """        {/* 左サイドバー - サイドバーステータス */}
        {/* スマホ時はアコーディオンで表示 */}
        {isMobile ? (
          <Box sx={{ width: '100%', mb: 1 }}>
            {mobileStatusOpen && (
              <Paper sx={{ mb: 1, p: 1 }}>
                <PropertySidebarStatus
                  listings={allListings}
                  selectedStatus={sidebarStatus}
                  onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); setMobileStatusOpen(false); }}
                />
              </Paper>
            )}
          </Box>
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
          />
        </Box>
        )}"""

new_sidebar = """        {/* 左サイドバー - サイドバーステータス */}
        {/* モバイル：ステータスサイドバーをアコーディオンで表示 */}
        {isMobile && (
          <Accordion
            expanded={mobileAccordionExpanded}
            onChange={(_, expanded) => setMobileAccordionExpanded(expanded)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={
                sidebarStatus && sidebarStatus !== 'all'
                  ? { bgcolor: `${SECTION_COLORS.property.main}15` }
                  : {}
              }
            >
              <Typography variant="body1" fontWeight="bold">
                ステータスフィルター
                {sidebarStatus && sidebarStatus !== 'all' && (
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ ml: 1, color: SECTION_COLORS.property.main }}
                  >
                    ({sidebarStatus})
                  </Typography>
                )}
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 1 }}>
              <PropertySidebarStatus
                listings={allListings}
                selectedStatus={sidebarStatus}
                onStatusChange={(status) => {
                  setSidebarStatus(status);
                  setSearchQuery('');
                  setLastFilter('sidebar');
                  setPage(0);
                  setMobileAccordionExpanded(false);
                }}
              />
            </AccordionDetails>
          </Accordion>
        )}

        {/* デスクトップ：サイドバー形式 */}
        {!isMobile && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
          />
        </Box>
        )}"""

if old_sidebar in text:
    text = text.replace(old_sidebar, new_sidebar)
    print('✅ サブタスク1.4: Accordion 形式に変更完了')
else:
    print('❌ サブタスク1.4: サイドバー部分が見つかりません')
    sys.exit(1)

# UTF-8 で書き込む（BOMなし）
with open(FILE_PATH, 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ PropertyListingsPage.tsx の変更が完了しました')

# BOM チェック
with open(FILE_PATH, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (should NOT be b\'\\xef\\xbb\\xbf\')')
