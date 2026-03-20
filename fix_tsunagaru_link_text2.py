with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

# CRLF -> LF に正規化してから処理
text = content.decode('utf-8').replace('\r\n', '\n')

# リンクテキストを「つながるオンライン査定書」に変更
old = '''                {/* つながるオンライン（反響URL） */}
                <Box sx={{ mb: 2, p: 1.5, bgcolor: '#e8f4fd', borderRadius: 1, border: '1px solid #90caf9' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                    つながるオンライン
                  </Typography>
                  {inquiryUrl ? (
                    <a
                      href={inquiryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#1976d2', fontSize: '0.875rem', fontWeight: 'bold', textDecoration: 'underline' }}
                    >
                      つながるオンライン
                    </a>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      反響URLが見つかりません
                    </Typography>
                  )}
                </Box>'''

new = '''                {/* つながるオンライン査定書（反響URL） */}
                {inquiryUrl && (
                  <Box sx={{ mb: 2 }}>
                    <a
                      href={inquiryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#1976d2', fontSize: '0.9rem', fontWeight: 'bold', textDecoration: 'underline' }}
                    >
                      つながるオンライン査定書
                    </a>
                  </Box>
                )}'''

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ 修正完了')
else:
    print('❌ 対象テキストが見つかりません')
    idx = text.find('つながるオンライン（反響URL）')
    if idx >= 0:
        print('見つかった位置:', idx)
        print(repr(text[idx-50:idx+300]))
