#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx の査定計算セクション先頭に「つながるオンライン」リンクを追加
"""

filepath = 'frontend/frontend/src/pages/CallModePage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

# CRLF -> LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

# 挿入ターゲット：査定計算セクションのPaper直後
target = "              <Paper sx={{ p: 2, bgcolor: '#fff8f0' }}>\n                {!property && !editedValuationAmount1 && ("

insert_block = """              <Paper sx={{ p: 2, bgcolor: '#fff8f0' }}>
                {/* つながるオンライン */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e8f4fd', borderRadius: 1, border: '1px solid #90caf9' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                    つながるオンライン
                  </Typography>
                  <a
                    href="https://docs.google.com/spreadsheets/d/1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#1976d2', fontSize: '0.875rem', wordBreak: 'break-all' }}
                  >
                    つながるオンラインを開く
                  </a>
                </Box>
                {!property && !editedValuationAmount1 && ("""

if target in text:
    text = text.replace(target, insert_block, 1)
    print('✅ つながるオンラインリンクを追加しました')
else:
    # デバッグ：前後の文字列を確認
    idx = text.find("bgcolor: '#fff8f0'")
    if idx >= 0:
        print('DEBUG: found bgcolor at', idx)
        print(repr(text[idx-50:idx+200]))
    else:
        print('❌ bgcolor も見つかりません')

# LF -> CRLF に戻す
text = text.replace('\n', '\r\n')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))
