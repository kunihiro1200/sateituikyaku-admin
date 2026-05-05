// スプレッドシートIDの抽出をテスト
const url = "https://docs.google.com/spreadsheets/d/1pu66LWhtbHt8_HxInR4OHIpLHpIJNaZqukix38gdo1w/edit?usp=drivesdk";
const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
console.log('Extracted ID:', match ? match[1] : 'FAILED');
console.log('Expected:     1pu66LWhtbHt8_HxInR4OHIpLHpIJNaZqukix38gdo1w');
console.log('Match:', match ? match[1] === '1pu66LWhtbHt8_HxInR4OHIpLHpIJNaZqukix38gdo1w' : false);

// シート名の文字コードを確認
const sheetName = '重説';
console.log('\nSheet name chars:');
for (let i = 0; i < sheetName.length; i++) {
  console.log(`  [${i}] '${sheetName[i]}' = U+${sheetName.charCodeAt(i).toString(16).toUpperCase().padStart(4,'0')}`);
}
