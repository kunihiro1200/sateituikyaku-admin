with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 全ページのmin-height:297mmをheight:297mm+overflow:hiddenに変更
content = content.replace(
    'width:210mm;min-height:297mm;padding:8mm 10mm;background:#fff;font-family:${FONT};font-size:8pt;color:#000;box-sizing:border-box;',
    'width:210mm;height:297mm;padding:8mm 10mm;background:#fff;font-family:${FONT};font-size:8pt;color:#000;box-sizing:border-box;overflow:hidden;'
)
content = content.replace(
    'width:210mm;min-height:297mm;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;',
    'width:210mm;height:297mm;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;overflow:hidden;'
)
content = content.replace(
    'width:210mm;min-height:297mm;padding:12mm 18mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;',
    'width:210mm;height:297mm;padding:12mm 18mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;'
)
content = content.replace(
    'width:210mm;min-height:297mm;padding:10mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;display:flex;flex-direction:column;',
    'width:210mm;height:297mm;padding:10mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;display:flex;flex-direction:column;overflow:hidden;'
)
content = content.replace(
    'width:210mm;min-height:297mm;padding:12mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;',
    'width:210mm;height:297mm;padding:12mm 15mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;'
)

# .pageクラスもmin-height->height+overflow:hidden
content = content.replace(
    '.page{width:210mm;min-height:297mm;background:white;page-break-after:always;break-after:page;}',
    '.page{width:210mm;height:297mm;background:white;page-break-after:always;break-after:page;overflow:hidden;}'
)

# generateAllPagesHtmlのHTML全体にビューポート設定を追加
old_head = '<meta charset="UTF-8">'
new_head = '<meta charset="UTF-8">\n<meta name="viewport" content="width=794px">'
content = content.replace(old_head, new_head)

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Fixed, replacements done')
