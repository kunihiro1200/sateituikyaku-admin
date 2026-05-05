#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EmailTemplateService.ts の <<GoogleMap>> プレースホルダー置換形式を変更する
変更前: Googleマップ: URL
変更後: GoogleMap：URL
"""

file_path = 'backend/src/services/EmailTemplateService.ts'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更1: 物件1件の場合の <<GoogleMap>> 置換
old1 = "result = result.replace(/<<GoogleMap>>/g, prop.googleMapUrl ? `Googleマップ: ${prop.googleMapUrl}` : '');"
new1 = "result = result.replace(/<<GoogleMap>>/g, prop.googleMapUrl ? `GoogleMap：${prop.googleMapUrl}` : '');"

# 変更2: 複数物件の場合の mapList 生成
old2 = "const mapList = properties.filter(p => p.googleMapUrl).map((p, i) => `【物件${i + 1}】Googleマップ: ${p.googleMapUrl}`).join('\\n');"
new2 = "const mapList = properties.filter(p => p.googleMapUrl).map((p, i) => `【物件${i + 1}】GoogleMap：${p.googleMapUrl}`).join('\\n');"

# 変更3: 複数物件の場合の <<GoogleMap>> 置換
old3 = "result = result.replace(/<<GoogleMap>>/g, mapList ? `Googleマップ:\\n${mapList}` : '');"
new3 = "result = result.replace(/<<GoogleMap>>/g, mapList ? mapList : '');"

if old1 in text:
    text = text.replace(old1, new1)
    print('変更1 適用完了: 物件1件の場合の <<GoogleMap>> 置換形式を変更')
else:
    print('変更1 スキップ: 対象文字列が見つかりません')

if old2 in text:
    text = text.replace(old2, new2)
    print('変更2 適用完了: 複数物件の mapList 生成形式を変更')
else:
    print('変更2 スキップ: 対象文字列が見つかりません')

if old3 in text:
    text = text.replace(old3, new3)
    print('変更3 適用完了: 複数物件の <<GoogleMap>> 置換形式を変更')
else:
    print('変更3 スキップ: 対象文字列が見つかりません')

# UTF-8（BOMなし）で書き込む
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了: ファイルを UTF-8 で保存しました')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM チェック: {repr(first_bytes[:3])} (b"\\xef\\xbb\\xbf" はBOM付き、それ以外はOK)')
