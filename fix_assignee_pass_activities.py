with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """            {/* 担当者設定セクション */}
            {seller && (
              <Box sx={{ mt: 2 }}>
                <AssigneeSection
                  seller={seller}
                  onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
                />
              </Box>
            )}"""

new = """            {/* 担当者設定セクション */}
            {seller && (
              <Box sx={{ mt: 2 }}>
                <AssigneeSection
                  seller={seller}
                  activities={activities}
                  onUpdate={(fields) => setSeller((prev) => prev ? { ...prev, ...fields } : prev)}
                />
              </Box>
            )}"""

if old in text:
    text = text.replace(old, new)
    print('✅ activities prop追加成功')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
