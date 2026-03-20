# CityNameExtractor.ts の extractCityFromAddress メソッドを修正
# パターン3（既知の市名リスト）を最初に試すように変更

with open('backend/src/services/CityNameExtractor.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_method = '''  extractCityFromAddress(address: string | null | undefined): string | null {
    if (!address || address.trim() === '') {
      return null;
    }

    const normalizedAddress = address.trim();

    // パターン1: 都道府県 + 市区町村 (例: "大分県大分市...")
    const pattern1 = /([^\\s]+?[都道府県])([^\\s]+?[市区町村])/;
    const match1 = normalizedAddress.match(pattern1);
    if (match1) {
      return match1[2]; // 市区町村部分を返す
    }

    // パターン2: 市区町村のみ (例: "大分市...")
    const pattern2 = /^([^\\s]+?[市区町村])/;
    const match2 = normalizedAddress.match(pattern2);
    if (match2) {
      return match2[1];
    }

    // パターン3: 特定の市名を直接検索
    const knownCities = [
      '大分市',
      '別府市',
      '中津市',
      '日田市',
      '佐伯市',
      '臼杵市',
      '津久見市',
      '竹田市',
      '豊後高田市',
      '杵築市',
      '宇佐市',
      '豊後大野市',
      '由布市',
      '国東市',
    ];

    for (const city of knownCities) {
      if (normalizedAddress.includes(city)) {
        return city;
      }
    }

    return null;
  }'''

new_method = '''  extractCityFromAddress(address: string | null | undefined): string | null {
    if (!address || address.trim() === '') {
      return null;
    }

    const normalizedAddress = address.trim();

    // パターン1: 特定の市名を直接検索（最優先）
    // 正規表現より先に既知の市名リストを検索することで、
    // 「別府市中島町...」→「市中島町」のような誤抽出を防ぐ
    const knownCities = [
      '大分市',
      '別府市',
      '中津市',
      '日田市',
      '佐伯市',
      '臼杵市',
      '津久見市',
      '竹田市',
      '豊後高田市',
      '杵築市',
      '宇佐市',
      '豊後大野市',
      '由布市',
      '国東市',
    ];

    for (const city of knownCities) {
      if (normalizedAddress.includes(city)) {
        return city;
      }
    }

    // パターン2: 都道府県 + 市区町村 (例: "大分県大分市...")
    const pattern1 = /([^\\s]+?[都道府県])([^\\s]+?[市区町村])/;
    const match1 = normalizedAddress.match(pattern1);
    if (match1) {
      return match1[2]; // 市区町村部分を返す
    }

    // パターン3: 市区町村のみ (例: "大分市...")
    const pattern2 = /^([^\\s]+?[市区町村])/;
    const match2 = normalizedAddress.match(pattern2);
    if (match2) {
      return match2[1];
    }

    return null;
  }'''

if old_method in text:
    text = text.replace(old_method, new_method)
    with open('backend/src/services/CityNameExtractor.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ CityNameExtractor.ts を修正しました')
else:
    print('❌ 対象テキストが見つかりませんでした')
    # デバッグ用に実際のテキストを確認
    idx = text.find('extractCityFromAddress')
    print(repr(text[idx:idx+200]))
