with open('frontend/frontend/src/components/PageNavigation.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')
text = text.replace('\r\n', '\n')

# ButtonGroupをBoxに変更し、個別Buttonにする
old = '''  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <ButtonGroup variant="outlined" size="large">
        {navItems.map((item) => {
          const color = NAV_COLORS[item.path as keyof typeof NAV_COLORS];
          const isActive = item.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/sellers')
            : location.pathname.startsWith(item.path);
          return (
            <Button
              key={item.path}
              onClick={() => navigate(item.path)}
              startIcon={item.icon}
              sx={{
                minWidth: 150,
                borderColor: color.main,
                color: isActive ? '#fff' : color.text,
                backgroundColor: isActive ? color.main : color.light,
                '&:hover': {
                  backgroundColor: isActive ? color.main : `${color.main}22`,
                  borderColor: color.main,
                },
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </ButtonGroup>'''

new = '''  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {navItems.map((item) => {
          const color = NAV_COLORS[item.path as keyof typeof NAV_COLORS];
          const isActive = item.path === '/'
            ? location.pathname === '/' || location.pathname.startsWith('/sellers')
            : location.pathname.startsWith(item.path);
          return (
            <Button
              key={item.path}
              variant="outlined"
              size="large"
              onClick={() => navigate(item.path)}
              startIcon={item.icon}
              sx={{
                minWidth: 130,
                borderColor: color.main,
                color: isActive ? '#fff' : color.text,
                backgroundColor: isActive ? color.main : color.light,
                '&:hover': {
                  backgroundColor: isActive ? color.main : `${color.main}22`,
                  borderColor: color.main,
                },
              }}
            >
              {item.label}
            </Button>
          );
        })}
      </Box>'''

if old in text:
    text = text.replace(old, new)
    print('✅ ButtonGroup → Box修正成功')
else:
    print('❌ 対象コードが見つかりません')

# ButtonGroupのインポートを削除
old_import = 'import { Box, Button, ButtonGroup } from \'@mui/material\';'
new_import = 'import { Box, Button } from \'@mui/material\';'
text = text.replace(old_import, new_import)

with open('frontend/frontend/src/components/PageNavigation.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
