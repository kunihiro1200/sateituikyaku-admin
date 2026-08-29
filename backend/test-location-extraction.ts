function extractLocationFromAddress(address: string): { prefecture: string; location: string } | null {
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
  
  // 市区町村名を除去（「別府市亀川中央町」→「亀川中央町」）
  // 政令指定都市の場合は区も除去（「福岡市中央区天神」→「天神」）
  let location = result.location;
  
  // まず市区町村を除去
  const cityMatch = location.match(/^(.+?[市区町村])(.*)$/);
  if (cityMatch) {
    location = cityMatch[2]; // 市区町村名以降
  }
  
  // 次に区を除去（政令指定都市対応）
  const wardMatch = location.match(/^(.+?区)(.*)$/);
  if (wardMatch) {
    location = wardMatch[2]; // 区以降
  }
  
  return {
    prefecture: result.prefecture,
    location: location, // 市区町村名・区名を除いた地名のみ
  };
}

function parsePrefectureAndLocation(fullLocation: string): { prefecture: string; location: string } | null {
  const prefectures = ['大分県', '福岡県'];

  for (const pref of prefectures) {
    if (fullLocation.startsWith(pref)) {
      return {
        prefecture: pref,
        location: fullLocation.substring(pref.length),
      };
    }
  }

  return { prefecture: '', location: fullLocation };
}

// テスト
const addr1 = '別府市亀川中央町２番2号';
const addr2 = '別府市田の湯町10-31トラスト別府駅前201';
const addr3 = '福岡市中央区天神1-1-1';
const addr4 = '大分市高城1丁目1-1';

const loc1 = extractLocationFromAddress(addr1);
const loc2 = extractLocationFromAddress(addr2);
const loc3 = extractLocationFromAddress(addr3);
const loc4 = extractLocationFromAddress(addr4);

console.log('addr1:', addr1);
console.log('  → location:', loc1?.location);

console.log('\naddr2:', addr2);
console.log('  → location:', loc2?.location);

console.log('\naddr3:', addr3);
console.log('  → location:', loc3?.location);

console.log('\naddr4:', addr4);
console.log('  → location:', loc4?.location);

console.log('\n共通部分チェック（addr1 vs addr2）:');
if (loc1 && loc2) {
  const normLoc1 = loc1.location;
  const normLoc2 = loc2.location;
  
  // 共通部分の抽出（最低2文字以上）
  for (let len = Math.min(normLoc1.length, normLoc2.length); len >= 2; len--) {
    for (let i = 0; i <= normLoc1.length - len; i++) {
      const subA = normLoc1.substring(i, i + len);
      if (normLoc2.includes(subA)) {
        console.log(`共通部分発見: "${subA}" (${len}文字)`);
        break;
      }
    }
  }
}
