# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

# 壊れた置換コードを正しいものに置き換える
old = """    // AIが勝手に市名に町名を付け足した場合を強制修正
    // 例: 「別府市石垣全体」→「別府市全体」
    // cityLabel = "別府市" の場合、「別府市」の後に「全体」以外の文字が続く場合を置換
    htmlContent = htmlContent.replace(
      new RegExp(cityLabel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\4cabe1e9-125f-462e-a0bb-f3a4db33c346') + '(?!全体)([^<]{1,15}?)全体', 'g'),
      cityLabel + '全体'
    );
    // さらに念のため：cityLabel+任意文字+全体 を全て cityLabel+全体 に置換
    htmlContent = htmlContent.replace(
      new RegExp(cityLabel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\4cabe1e9-125f-462e-a0bb-f3a4db33c346') + '[\\\\u3000-\\\\u9FFF]{1,8}全体', 'g'),
      cityLabel + '全体'
    );"""

# 正しい置換コード（シンプルに全パターンを網羅）
new = """    // AIが市名に余分な文字を付け足した場合を強制修正
    // 例: 「別府市石垣全体」→「別府市全体」
    // 方法: cityLabel の後に「全体」が来ない場合、次の「全体」までを削除
    const escapedCity = cityLabel.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
    htmlContent = htmlContent.replace(
      new RegExp(escapedCity + '(?!全体)[^<]*?全体', 'g'),
      cityLabel + '全体'
    );"""

if old in text:
    text = text.replace(old, new)
    with open('backend/src/routes/sellers.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    # 壊れた部分を探す
    idx = text.find('4cabe1e9')
    if idx >= 0:
        print('Found UUID at:', idx)
        print(repr(text[idx-200:idx+200]))
    else:
        idx2 = text.find('AIが勝手に市名')
        print('Found at:', idx2)
        print(repr(text[idx2:idx2+500]))
