#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
1. main.tsx: MUIテーマにnumber inputのスピナー非表示スタイルを追加
2. PriceSection.tsx: 売買価格入力欄をxs={12}（全幅）に変更
"""

# ===== 1. main.tsx の修正 =====
with open('frontend/frontend/src/main.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_theme = """const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});"""

new_theme = """const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1565c0',
    },
    secondary: {
      main: '#dc004e',
    },
  },
  components: {
    MuiTextField: {
      styleOverrides: {
        root: {
          '& input[type=number]': {
            MozAppearance: 'textfield',
          },
          '& input[type=number]::-webkit-outer-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
          },
          '& input[type=number]::-webkit-inner-spin-button': {
            WebkitAppearance: 'none',
            margin: 0,
          },
        },
      },
    },
  },
});"""

if old_theme in text:
    text = text.replace(old_theme, new_theme)
    print('main.tsx: テーマ更新成功')
else:
    print('main.tsx: 対象文字列が見つかりません')

with open('frontend/frontend/src/main.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

# ===== 2. PriceSection.tsx の修正 =====
with open('frontend/frontend/src/components/PriceSection.tsx', 'rb') as f:
    content2 = f.read()

text2 = content2.decode('utf-8')

# 売買価格のGridをxs={12} sm={6} → xs={12}に変更
old_grid = """          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              売買価格
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={displaySalesPrice || ''}
              onChange={(e) => onFieldChange('sales_price', e.target.value ? Number(e.target.value) : null)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'primary.main',
                },
              }}
            />
          </Grid>"""

new_grid = """          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              売買価格
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={displaySalesPrice || ''}
              onChange={(e) => onFieldChange('sales_price', e.target.value ? Number(e.target.value) : null)}
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
              sx={{
                '& .MuiInputBase-input': {
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: 'primary.main',
                },
              }}
            />
          </Grid>"""

if old_grid in text2:
    text2 = text2.replace(old_grid, new_grid)
    print('PriceSection.tsx: 売買価格全幅化成功')
else:
    print('PriceSection.tsx: 対象文字列が見つかりません')

with open('frontend/frontend/src/components/PriceSection.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))

print('完了')
