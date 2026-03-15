#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PriceSection.tsx: 月々ローン支払いを全角数字 + ワンクリックコピーに変更
"""

import re

filepath = 'frontend/frontend/src/components/PriceSection.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 全角数字変換関数と、月々ローン支払い表示部分を更新
old_import = "import { useState, useEffect } from 'react';"
new_import = "import { useState, useEffect } from 'react';"

# 全角変換ユーティリティを calcMonthlyPayment の後に追加
old_calc = """// 月々ローン支払い計算（元利均等返済、金利年3%/12、420回）
function calcMonthlyPayment(price: number): number {
  const r = 0.0007916666667;
  const n = 420;
  return Math.round(price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}"""

new_calc = """// 月々ローン支払い計算（元利均等返済、金利年3%/12、420回）
function calcMonthlyPayment(price: number): number {
  const r = 0.0007916666667;
  const n = 420;
  return Math.round(price * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
}

// 半角数字を全角数字に変換
function toFullWidth(num: number): string {
  return num.toLocaleString().replace(/[0-9]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xFEE0));
}"""

text = text.replace(old_calc, new_calc)

# useState に Tooltip をインポートに追加
old_mui_import = "import { Box, Typography, TextField, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';"
new_mui_import = "import { Box, Typography, TextField, Grid, Button, Dialog, DialogTitle, DialogContent, DialogActions, Tooltip, IconButton as MuiIconButton } from '@mui/material';\nimport ContentCopyIcon from '@mui/icons-material/ContentCopy';\nimport CheckIcon from '@mui/icons-material/Check';"

text = text.replace(old_mui_import, new_mui_import)

# useState に copiedMonthly を追加
old_state = "  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);"
new_state = "  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);\n  const [copiedMonthly, setCopiedMonthly] = useState(false);"

text = text.replace(old_state, new_state)

# 月々ローン支払い表示部分を全角 + コピーボタンに変更
old_monthly = """          {showMonthlyPayment && monthlyPayment && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                月々ローン支払い
              </Typography>
              <Typography variant="h4" fontWeight="medium" sx={{ fontSize: '1.8rem', color: '#1976d2' }}>
                ¥{monthlyPayment.toLocaleString()}/月
              </Typography>
              <Typography variant="caption" color="text.secondary">
                ※金利3%・35年・元利均等返済
              </Typography>
            </Box>
          )}"""

new_monthly = """          {showMonthlyPayment && monthlyPayment && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                月々ローン支払い
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h4" fontWeight="medium" sx={{ fontSize: '1.8rem', color: '#1976d2' }}>
                  ¥{toFullWidth(monthlyPayment)}/月
                </Typography>
                <Tooltip title={copiedMonthly ? 'コピーしました' : '数字をコピー'}>
                  <MuiIconButton
                    size="small"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(String(monthlyPayment));
                        setCopiedMonthly(true);
                        setTimeout(() => setCopiedMonthly(false), 2000);
                      } catch {}
                    }}
                    sx={{ color: copiedMonthly ? 'success.main' : '#1976d2' }}
                  >
                    {copiedMonthly ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                  </MuiIconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" color="text.secondary">
                ※金利3%・35年・元利均等返済
              </Typography>
            </Box>
          )}"""

text = text.replace(old_monthly, new_monthly)

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PriceSection.tsx updated.')
