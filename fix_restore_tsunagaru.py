# -*- coding: utf-8 -*-
# つながるオンラインブロックを復活させるスクリプト（CRLF対応）

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 現在の反響URLブロック（条件付き表示）を、常時表示のつながるオンラインブロックに置き換え
old = """                {/* 反響URL */}
                {inquiryUrl && (
                  <Box sx={{ mb: 2, p: 1.5, bgcolor: '#f3e5f5', borderRadius: 1, border: '1px solid #ce93d8' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold' }}>
                      反響URL
                    </Typography>
                    <a
                      href={inquiryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: '#7b1fa2', fontSize: '0.875rem', wordBreak: 'break-all' }}
                    >
                      {inquiryUrl}
                    </a>
                  </Box>
                )}"""

new = """                {/* つながるオンライン（反響URL） */}
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
                      style={{ color: '#1976d2', fontSize: '0.875rem', wordBreak: 'break-all' }}
                    >
                      {inquiryUrl}
                    </a>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                      反響URLが見つかりません
                    </Typography>
                  )}
                </Box>"""

if old in text:
    text = text.replace(old, new)
    print("✅ つながるオンラインブロックを復活させました")
else:
    print("❌ 対象ブロックが見つかりません")
    idx = text.find('反響URL')
    if idx >= 0:
        print(f"  前後: {repr(text[idx-50:idx+400])}")

result = text.replace('\n', '\r\n')
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(result.encode('utf-8'))

print("完了")
