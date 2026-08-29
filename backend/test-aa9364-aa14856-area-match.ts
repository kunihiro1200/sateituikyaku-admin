// エリアマッチングのテスト

// AA9364の物件住所
const sellerAddress = '別府市田の湯町10-31トラスト別府駅前201';

// AA14856の買いたいエリア
const buyerArea = '㊷別府駅周辺（中央町、駅前本町、上田の湯町、野口中町、西野口町、駅前町）';

console.log('=== エリアマッチングテスト ===\n');
console.log('売りたい（AA9364）:');
console.log('  物件住所:', sellerAddress);

console.log('\n買いたい（AA14856）:');
console.log('  エリア:', buyerArea);

console.log('\n=== 判定 ===');

// エリアコードは「㊷別府駅周辺」
// カッコ内は詳細地名リスト
const areaMatch = buyerArea.match(/㊷別府駅周辺（(.+)）/);
if (areaMatch) {
  const detailAreas = areaMatch[1].split(/[、,]/);
  console.log('詳細エリアリスト:', detailAreas);
  
  // 物件住所に含まれるか確認
  const matched = detailAreas.some(area => {
    const normalized = area.trim();
    const isMatch = sellerAddress.includes(normalized);
    console.log(`  "${normalized}" は物件住所に含まれる? ${isMatch}`);
    return isMatch;
  });
  
  console.log('\n結果:', matched ? 'マッチング✓' : 'マッチングせず✗');
  
  // 「上田の湯町」vs「田の湯町」の判定
  console.log('\n=== 共通部分チェック ===');
  console.log('「上田の湯町」と「田の湯町」の共通部分:');
  
  const addr1 = '上田の湯町';
  const addr2 = '田の湯町';
  
  for (let len = Math.min(addr1.length, addr2.length); len >= 2; len--) {
    for (let i = 0; i <= addr1.length - len; i++) {
      const sub = addr1.substring(i, i + len);
      if (addr2.includes(sub)) {
        console.log(`  共通部分: "${sub}" (${len}文字)`);
      }
    }
  }
} else {
  console.log('エリアコードのパースに失敗');
}
