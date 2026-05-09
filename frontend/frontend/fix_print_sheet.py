with open('src/components/ViewingPreparationPrintSheet.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Divider my: 1 -> my: 0.5
content = content.replace('my: 1, borderColor', 'my: 0.5, borderColor')

# box padding縮小
content = content.replace("p: 1, bgcolor: '#f5f5f5'", "p: 0.5, bgcolor: '#f5f5f5'")
content = content.replace("p: 1, bgcolor: '#f0f0f0'", "p: 0.5, bgcolor: '#f0f0f0'")
content = content.replace("p: 1, bgcolor: '#f8f8f8'", "p: 0.5, bgcolor: '#f8f8f8'")

# 内部テキストフォントサイズ縮小
content = content.replace("fontSize: '8.5pt', whiteSpace: 'pre-wrap', lineHeight: 1.5", "fontSize: '7pt', whiteSpace: 'pre-wrap', lineHeight: 1.3")
content = content.replace("fontSize: '8pt', fontWeight: 'bold', color: '#000', mb: 0.5", "fontSize: '7pt', fontWeight: 'bold', color: '#000', mb: 0.3")
content = content.replace("fontSize: '8pt', fontWeight: 'bold', color: '#333', mb: 0.5", "fontSize: '7pt', fontWeight: 'bold', color: '#333', mb: 0.3")
content = content.replace("fontSize: '8pt', color: '#333', mt: 0.5", "fontSize: '7pt', color: '#333', mt: 0.3")

# mb: 1.5 -> mb: 1
content = content.replace('mb: 1.5 }}', 'mb: 1 }}')
content = content.replace('mb: 1.5,', 'mb: 0.8,')

# footer margin
content = content.replace('mt: 2, pt: 1', 'mt: 0.5, pt: 0.5')

with open('src/components/ViewingPreparationPrintSheet.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Done')
