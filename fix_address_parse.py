# encoding: utf-8
with open('backend/src/routes/sellers.ts', 'rb') as f:
    text = f.read().decode('utf-8')

# 住所解析部分を探して置換
old = '    // 住所から都道府県・市区町村・町丁目を抽出'
idx = text.find(old)
if idx == -1:
    print('ERROR: marker not found')
else:
    # 次の const today = の行まで置換
    end_marker = '    const today = new Date()'
    end_idx = text.find(end_marker, idx)
    if end_idx == -1:
        print('ERROR: end marker not found')
    else:
        new_block = '''    // 住所から市区町村・町名を抽出
    // 「大分県大分市南太平寺1丁目」→ city=大分市, town=南太平寺
    // 「大分県別府市亀川東町3-9」→ city=別府市, town=亀川東町
    const cityMatch = address.match(/[都道府県]([^都道府県]{2,6}?[市区町村])/);
    const townMatch = address.match(/[市区町村]([^\d\\s\\-0-9０-９]{2,10}?)(?=\\d|[0-9０-９]|$)/);

    const city = cityMatch ? cityMatch[1] : address.substring(0, 5);
    const townRaw = townMatch ? townMatch[1].trim() : '';
    const town = townRaw.replace(/[0-9０-９一二三四五六七八九十]+丁目$/, '').trim();
    const detailArea = town || city;
    const cityLabel = city;

'''
        new_text = text[:idx] + new_block + text[end_idx:]
        with open('backend/src/routes/sellers.ts', 'wb') as f:
            f.write(new_text.encode('utf-8'))
        print(f'Done! city={repr(city if False else "will be parsed at runtime")}')
        print('Preview of new block:')
        print(new_block[:200])
