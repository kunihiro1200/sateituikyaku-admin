# extractAreaNumbers の正規表現を修正する
# ①〜⑳（U+2460〜U+2473）だけでなく、㉑〜㊿（U+3251〜U+32BF）も含める

with open('backend/src/services/BuyerService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "    return areaString.match(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]/g) || [];"
new = "    // ①〜⑳（U+2460〜U+2473）および㉑〜㊿（U+3251〜U+32BF）の囲み数字を全て抽出\n    return areaString.match(/[\\u2460-\\u2473\\u3251-\\u32BF]/g) || [];"

if old in text:
    text = text.replace(old, new)
    print('✅ extractAreaNumbers を修正しました')
else:
    print('❌ 対象テキストが見つかりません')
    idx = text.find('extractAreaNumbers')
    print(repr(text[idx:idx+200]))

with open('backend/src/services/BuyerService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

# 動作確認
import re
def extractAreaNumbers(areaString):
    return re.findall(r'[\u2460-\u2473\u3251-\u32BF]', areaString)

tests = [
    ('㊶別府 , ㊷別府駅周辺', ['㊶', '㊷']),
    ('①大分市中心部 , ②高城', ['①', '②']),
    ('⑮別府浜脇', ['⑮']),
    ('㊶別府 , ①大分', ['㊶', '①']),
]
for area, expected in tests:
    result = extractAreaNumbers(area)
    ok = set(result) == set(expected)
    print(f'{"✅" if ok else "❌"} {area!r} → {result}')
