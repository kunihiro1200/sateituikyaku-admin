with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# bodyスタイルにwidth:794pxを追加（A4 = 794px at 96dpi）
content = content.replace(
    'body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}',
    'body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;width:794px;}'
)

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
