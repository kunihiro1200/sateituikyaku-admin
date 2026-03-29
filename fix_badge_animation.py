with open('frontend/frontend/src/components/PurchaseStatusBadge.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old = '''    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'error.main',    // 濃い赤背景
        color: 'white',           // 白文字
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
      }}
    >
      {/* 警告アイコンで視覚的強調 */}
      <WarningAmberIcon sx={{ fontSize: '1.1rem', color: 'white' }} />
      <Typography
        sx={{
          fontWeight: 'bold',     // 太字
          fontSize: '1rem',       // フォントサイズ
          color: 'white',         // 白文字
        }}
      >
        {statusText}
      </Typography>
    </Box>'''

new = '''    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: 'error.main',
        color: 'white',
        px: 1.5,
        py: 0.5,
        borderRadius: 1,
        // パルスアニメーション（光る）
        animation: 'purchasePulse 1.5s ease-in-out infinite',
        '@keyframes purchasePulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.8)' },
          '50%':  { boxShadow: '0 0 12px 6px rgba(211, 47, 47, 0.4)' },
          '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
        },
      }}
    >
      {/* 警告アイコンで視覚的強調 */}
      <WarningAmberIcon sx={{ fontSize: '1.1rem', color: 'white' }} />
      <Typography
        sx={{
          fontWeight: 'bold',
          fontSize: '1rem',
          color: 'white',
        }}
      >
        {statusText}
      </Typography>
    </Box>'''

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/components/PurchaseStatusBadge.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done')
else:
    print('Pattern not found')
