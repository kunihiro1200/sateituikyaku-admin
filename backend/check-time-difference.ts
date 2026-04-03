/**
 * GAS実行時刻と現在時刻の差を確認
 */

const gasExecutionTime = new Date('2026-04-03T21:17:34.401+00:00');
const now = new Date();

console.log('⏰ 時刻の比較:\n');
console.log(`  GAS実行時刻（UTC）: ${gasExecutionTime.toISOString()}`);
console.log(`  GAS実行時刻（JST）: ${gasExecutionTime.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);
console.log(`  現在時刻（UTC）: ${now.toISOString()}`);
console.log(`  現在時刻（JST）: ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`);

const diffMinutes = Math.floor((now.getTime() - gasExecutionTime.getTime()) / (1000 * 60));
console.log(`\n  時間差: ${diffMinutes}分`);

// 日付が変わったかチェック
const gasDate = new Date(gasExecutionTime);
gasDate.setHours(0, 0, 0, 0);

const nowDate = new Date(now);
nowDate.setHours(0, 0, 0, 0);

if (gasDate.getTime() !== nowDate.getTime()) {
  console.log('\n⚠️ 日付が変わりました！');
  console.log('  GASが実行された日と現在の日が異なるため、「内覧日前日」の条件を満たす買主が変わった可能性があります。');
} else {
  console.log('\n✅ 同じ日です');
}
