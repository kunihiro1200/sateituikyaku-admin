#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
つながるオンラインの <a> タグを Button コンポーネントに変更
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF を LF に統一して検索
text_lf = text.replace('\r\n', '\n')

old_code = """                {/* つながるオンライン */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e8f4fd', borderRadius: 1, border: '1px solid #90caf9' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                    つながるオンライン
                  </Typography>
                  <a
                    href="https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open('https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I', '_blank', 'noopener,noreferrer'); }}
                    style={{ color: '#1976d2', fontSize: '0.875rem', wordBreak: 'break-all' }}
                  >
                    つながるオンラインを開く
                  </a>
                </Box>"""

new_code = """                {/* つながるオンライン */}
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

if old_code in text_lf:
    text_lf = text_lf.replace(old_code, new_code)
    print('✅ つながるオンラインのリンクを Button に変更しました')
else:
    print('❌ 対象コードが見つかりませんでした')

# CRLF に戻す
result = text_lf.replace('\n', '\r\n')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(result.encode('utf-8'))

print('完了')
