// 住所抽出ロジックのテスト
function extractLocationFromAddress(address: string): { prefecture: string; city: string; location: string } | null {
  if (!address || address.length < 3) return null;

  // 番地・号の後の建物名を除去
  let extracted = address;
  
  // パターン1: 丁目まである場合
  const match1 = address.match(/^(.+?[都道府県市区町村][^0-9]+[0-9０-９]+丁目)/);
  if (match1) {
    extracted = match1[1];
  } else {
    // パターン2: 丁目がない場合は、番地の前まで
    const match2 = address.match(/^(.+?[都道府県市区町村][^0-9]+)/);
    if (match2) {
      extracted = match2[1];
    }
  }

  const result = parsePrefectureAndLocation(extracted);
  if (!result) return null;
  
  // 市区町村名を抽出（「別府市亀川中央町」→ city: "別府市", location: "亀川中央町"）
  let location = result.location;
  let city = '';
  
  // まず市区町村を抽出
  const cityMatch = location.match(/^(.+?[市区町村])(.*)$/);
  if (cityMatch) {
    city = cityMatch[1]; // 市区町村名（例: 「別府市」「福岡市」）
    location = cityMatch[2]; // 市区町村名以降
  }
  
  // 次に区を除去（政令指定都市対応）
  const wardMatch = location.match(/^(.+?区)(.*)$/);
  if (wardMatch) {
    city = city + wardMatch[1]; // 市区町村名+区（例: 「福岡市中央区」）
    location = wardMatch[2]; // 区以降
  }
  
  return {
    prefecture: result.prefecture,
    city: city, // 市区町村名（例: 「別府市」「福岡市中央区」「大分市」）
    location: location, // 市区町村名・区名を除いた地名のみ
  };
}

function parsePrefectureAndLocation(fullLocation: string): { prefecture: string; location: string } | null {
  const prefectures = ['北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'];

  for (const pref of prefectures) {
    if (fullLocation.startsWith(pref)) {
      return {
        prefecture: pref,
        location: fullLocation.substring(pref.length),
      };
    }
  }

  // 都道府県が見つからない場合は空文字列
  return { prefecture: '', location: fullLocation };
}

// テスト
const fi915Address = '福岡県福岡市中央区谷２丁目20-8サンブリック桜坂106';
const aa14856Address = '別府市亀川中央町２番2号';

console.log('FI915の住所:', fi915Address);
const fi915Result = extractLocationFromAddress(fi915Address);
console.log('抽出結果:', fi915Result);
console.log('');

console.log('AA14856の住所:', aa14856Address);
const aa14856Result = extractLocationFromAddress(aa14856Address);
console.log('抽出結果:', aa14856Result);
console.log('');

if (fi915Result && aa14856Result) {
  console.log('市区町村の比較:');
  console.log('  FI915:', fi915Result.city);
  console.log('  AA14856:', aa14856Result.city);
  console.log('  一致:', fi915Result.city === aa14856Result.city);
}
