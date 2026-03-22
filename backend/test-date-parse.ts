// dateHelpersのisTodayOrPastが正しく動作するか確認
import { isTodayOrPast } from './src/utils/dateHelpers';

const testDates = [
  '2026-03-22T00:00:00+00:00',  // UTC 00:00 = JST 09:00 → 今日
  '2026-03-22T00:00:00.000Z',   // UTC 00:00 = JST 09:00 → 今日
  '2026-03-22',                  // ローカル日付 → 今日
  '2026-03-21',                  // 昨日
  '2026-03-23',                  // 明日
];

console.log('今日:', new Date().toLocaleDateString('ja-JP'));
console.log('');

for (const d of testDates) {
  console.log(`${d} → isTodayOrPast: ${isTodayOrPast(d)}`);
}
