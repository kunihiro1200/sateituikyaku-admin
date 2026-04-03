// システムの現在日時を取得するユーティリティ
// 日付計算の前に必ずこのスクリプトを実行して、今日の日付を確認する

const now = new Date();

console.log('=== システムの現在日時 ===');
console.log('');
console.log('📅 日付:', now.toISOString().split('T')[0]);
console.log('📅 曜日:', ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'][now.getDay()]);
console.log('🕐 時刻:', now.toTimeString().split(' ')[0]);
console.log('');
console.log('ISO形式:', now.toISOString());
console.log('');
console.log('=== 使用方法 ===');
console.log('日付計算を行う前に、必ずこのスクリプトを実行して今日の日付を確認してください。');
console.log('');
console.log('例: npx ts-node backend/get-current-date.js');
