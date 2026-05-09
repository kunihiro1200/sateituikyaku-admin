with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# generateAllPagesHtmlのCSSを修正
# mmではなくpxで指定し、印刷時はmmに戻す
old_style = '''  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;width:794px;}
  .page{width:210mm;height:297mm;background:white;page-break-after:always;break-after:page;overflow:hidden;}'''

new_style = '''  @page{size:A4 portrait;margin:0;}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  html{font-size:16px;}
  body{margin:0;padding:0;font-family:"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif;}
  .page{width:794px;min-height:1123px;background:white;page-break-after:always;break-after:page;overflow:hidden;}
  @media print{
    .page{width:210mm;height:297mm;min-height:unset;}
  }'''

content = content.replace(old_style, new_style)

# 各ページのdivスタイルもpxに変更（画面表示用）
# page1: 210mm -> 794px, height:297mm -> min-height:1123px
content = content.replace(
    'width:210mm;height:297mm;padding:8mm 10mm;background:#fff;font-family:${FONT};font-size:8pt;color:#000;box-sizing:border-box;overflow:hidden;',
    'width:100%;height:100%;padding:8mm 10mm;background:#fff;font-family:${FONT};font-size:8pt;color:#000;box-sizing:border-box;overflow:hidden;'
)
content = content.replace(
    'width:210mm;height:297mm;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;overflow:hidden;',
    'width:100%;height:100%;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;overflow:hidden;'
)
content = content.replace(
    'width:210mm;height:297mm;padding:12mm 18mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;',
    'width:100%;height:100%;padding:12mm 18mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;'
)
content = content.replace(
    'width:210mm;height:297mm;padding:10mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;',
    'width:100%;height:100%;padding:10mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;'
)
content = content.replace(
    'width:210mm;height:297mm;padding:12mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;',
    'width:100%;height:100%;padding:12mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;'
)

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
