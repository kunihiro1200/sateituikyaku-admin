with open('src/services/EnhancedBuyerDistributionService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '    // If no price range specified or all are "\u6307\u5b9a\u306a\u3057", check property type match\r\n    if (priceRangeTexts.length === 0 || \r\n        priceRangeTexts.every(text => !text || text.includes(\'\u6307\u5b9a\u306a\u3057\') || text.trim() === \'\')) {'

new = '    // If no price range specified or any are "\u6307\u5b9a\u306a\u3057", check property type match\r\n    // Note: use "some" so that if ANY record has "\u6307\u5b9a\u306a\u3057" (no restriction), the buyer passes\r\n    if (priceRangeTexts.length === 0 || \r\n        priceRangeTexts.some(text => !text || text.includes(\'\u6307\u5b9a\u306a\u3057\') || text.trim() === \'\')) {'

if old in text:
    text = text.replace(old, new)
    with open('src/services/EnhancedBuyerDistributionService.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done! Fixed every -> some')
else:
    print('ERROR: Target string not found')
    # デバッグ用に周辺を表示
    idx = text.find('priceRangeTexts.every')
    if idx >= 0:
        print('Found at:', idx)
        print(repr(text[idx-100:idx+200]))
    else:
        print('priceRangeTexts.every not found either')
