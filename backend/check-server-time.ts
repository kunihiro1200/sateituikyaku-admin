import * as dotenv from 'dotenv';

dotenv.config();

console.log('サーバー時刻の確認:');
console.log('  new Date():', new Date());
console.log('  new Date().toISOString():', new Date().toISOString());
console.log('  new Date().toISOString().split("T")[0]:', new Date().toISOString().split('T')[0]);

const today = new Date();
today.setHours(0, 0, 0, 0);
console.log('  today (setHours(0,0,0,0)):', today);
console.log('  today.toISOString():', today.toISOString());
console.log('  today.toISOString().split("T")[0]:', today.toISOString().split('T')[0]);

// タイムゾーンを考慮した日付取得
const jstDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
console.log('\nJST (Asia/Tokyo):');
console.log('  jstDate:', jstDate);
console.log('  jstDate.toISOString():', jstDate.toISOString());
console.log('  jstDate.toISOString().split("T")[0]:', jstDate.toISOString().split('T')[0]);
