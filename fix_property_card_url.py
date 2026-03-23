with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# Link を MUI インポートに追加
old_mui_import = '''} from '@mui/material';'''
new_mui_import = '''  Link,
} from '@mui/material';'''

if '  Link,' not in text:
    text = text.replace(old_mui_import, new_mui_import, 1)
    print('Link インポート追加')

# LaunchIcon を icons インポートに追加
old_icons_import = '''  Clear as ClearIcon,
} from '@mui/icons-material';'''
new_icons_import = '''  Clear as ClearIcon,
  Launch as LaunchIcon,
} from '@mui/icons-material';'''

if 'Launch as LaunchIcon' not in text:
    text = text.replace(old_icons_import, new_icons_import, 1)
    print('LaunchIcon インポート追加')

# 「1件」Chipを削除して、公開サイトURLリンクに変更
old = '''            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6">物件詳細カード</Typography>
              {linkedProperties.length > 0 && (
                <Chip label={`${linkedProperties.length}件`} size="small" sx={{ ml: 2 }} />
              )}
            </Box>'''

new = '''            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Typography variant="h6">物件詳細カード</Typography>
              {linkedProperties.map((lp) => (
                <Link
                  key={lp.property_number}
                  href={`https://property-site-frontend-kappa.vercel.app/public/properties/${lp.property_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  {`https://property-site-frontend-kappa.vercel.app/public/properties/${lp.property_number}`}
                  <LaunchIcon sx={{ fontSize: 12 }} />
                </Link>
              ))}
            </Box>'''

if old in text:
    text = text.replace(old, new)
    print('Chip → URL リンク 置換成功')
else:
    print('対象文字列が見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
