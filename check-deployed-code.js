// 本番環境のJavaScriptファイルに修正が含まれているか確認
const https = require('https');

const url = 'https://sateituikyaku-admin-frontend.vercel.app/assets/index-*.js';

console.log('🔍 本番環境のコードを確認中...');
console.log('');
console.log('⚠️ 注意: Vercelのビルド出力ファイル名はハッシュ付きのため、');
console.log('ブラウザの開発者ツールで実際のファイル名を確認してください。');
console.log('');
console.log('確認方法:');
console.log('1. ブラウザで https://sateituikyaku-admin-frontend.vercel.app を開く');
console.log('2. F12で開発者ツールを開く');
console.log('3. Sourcesタブ → assets フォルダ → index-[hash].js を開く');
console.log('4. Ctrl+F で "専任媒介" または "一般媒介" を検索');
console.log('5. isTodayCallBase 関数内に除外条件があるか確認');
console.log('');
console.log('期待される除外条件:');
console.log('  if (status.includes("追客不要") || status.includes("専任媒介") || status.includes("一般媒介"))');
