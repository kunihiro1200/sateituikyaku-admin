/**
 * AA13888の重複検出キャッシュをクリア
 */

const sellerId = 'dd457e95-a785-4d27-aa17-5feeeb61c21a'; // AA13888のID
const cacheKey = `duplicates_${sellerId}`;

console.log('🗑️  AA13888の重複検出キャッシュをクリア\n');
console.log('キャッシュキー:', cacheKey);
console.log('\nブラウザのDevToolsで以下を実行してください:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`sessionStorage.removeItem('${cacheKey}');`);
console.log(`sessionStorage.removeItem('duplicate_details_${sellerId}');`);
console.log('location.reload();');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nまたは、ブラウザのシークレットモードで開いてください。');
