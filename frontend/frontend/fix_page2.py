with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 買付申込書のpaddingを縮小してコンテンツを1ページに収める
content = content.replace(
    'width:100%;height:100%;padding:15mm 20mm;background:#fff;font-family:${FONT};font-size:10pt;color:#000;box-sizing:border-box;overflow:hidden;',
    'width:100%;height:100%;padding:8mm 14mm;background:#fff;font-family:${FONT};font-size:9pt;color:#000;box-sizing:border-box;overflow:hidden;'
)

# タイトルのmargin縮小
content = content.replace(
    'font-size:18pt;font-weight:bold;text-align:center;text-decoration:underline;margin-bottom:16px;',
    'font-size:16pt;font-weight:bold;text-align:center;text-decoration:underline;margin-bottom:10px;'
)

# 日付のmargin縮小
content = content.replace(
    'text-align:right;margin-bottom:24px;font-size:10pt;',
    'text-align:right;margin-bottom:12px;font-size:9pt;'
)

# テーブルのmargin縮小
content = content.replace(
    'width:100%;border-collapse:collapse;margin-bottom:24px;',
    'width:100%;border-collapse:collapse;margin-bottom:12px;'
)

# 仲介業者情報のmargin縮小
content = content.replace(
    'font-size:9pt;margin-bottom:16px;',
    'font-size:8.5pt;margin-bottom:8px;'
)

# 宣言文のmargin縮小
content = content.replace(
    '<div style="margin-bottom:16px;">私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明致します。</div>',
    '<div style="margin-bottom:8px;font-size:9pt;">私は、下記不動産を、下記の条件にて購入したく、買い付けることを証明致します。</div>'
)

# 記のmargin縮小
content = content.replace(
    '<div style="text-align:center;margin-bottom:16px;">記</div>',
    '<div style="text-align:center;margin-bottom:8px;">記</div>'
)

# 物件欄のmargin縮小
content = content.replace(
    'display:flex;align-items:baseline;margin-bottom:16px;padding-left:4px;',
    'display:flex;align-items:baseline;margin-bottom:8px;padding-left:4px;'
)

# 条件欄のmargin縮小
content = content.replace(
    'padding-left:4px;margin-bottom:16px;',
    'padding-left:4px;margin-bottom:8px;'
)

# 支払い方法のmargin縮小
content = content.replace(
    'display:flex;align-items:baseline;padding-left:4px;margin-bottom:16px;',
    'display:flex;align-items:baseline;padding-left:4px;margin-bottom:8px;'
)

# 購入価格・手付金のmargin縮小
content = content.replace(
    'display:flex;align-items:baseline;padding-left:48px;margin-bottom:12px;',
    'display:flex;align-items:baseline;padding-left:48px;margin-bottom:6px;'
)

with open('frontend/frontend/src/utils/printHtmlGenerators.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
