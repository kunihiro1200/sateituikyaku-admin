# -*- coding: utf-8 -*-
# つながるオンラインのリンク表示をURLではなく「つながるオンライン」テキストに変更

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

old = """                  {inquiryUrl ? (
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
                  )}"""

new = """                  {inquiryUrl ? (
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
                  )}"""

if old in text:
    text = text.replace(old, new)
    print("✅ リンクテキストを「つながるオンライン」に変更しました")
else:
    print("❌ 対象ブロックが見つかりません")

result = text.replace('\n', '\r\n')
with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(result.encode('utf-8'))

print("完了")
