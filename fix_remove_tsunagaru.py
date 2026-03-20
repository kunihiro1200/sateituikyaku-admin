# -*- coding: utf-8 -*-
# つながるオンラインブロックを削除するスクリプト（CRLF対応）

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLFをLFに統一して処理
text_lf = text.replace('\r\n', '\n')

old = """                {/* つながるオンライン */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e8f4fd', borderRadius: 1, border: '1px solid #90caf9' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                    つながるオンライン
                  </Typography>
                  <Button
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open('https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I', '_blank', 'noopener,noreferrer');
                    }}
                    sx={{ color: '#1976d2', fontSize: '0.875rem', textTransform: 'none', p: 0, minWidth: 0, justifyContent: 'flex-start' }}
                  >
                    つながるオンラインを開く
                  </Button>
                </Box>"""

new = ""

if old in text_lf:
    text_lf = text_lf.replace(old, new)
    print("✅ つながるオンラインブロックを削除しました")
else:
    print("❌ 対象ブロックが見つかりません")

# CRLFに戻して書き込み
result = text_lf.replace('\n', '\r\n')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(result.encode('utf-8'))

print("完了")
