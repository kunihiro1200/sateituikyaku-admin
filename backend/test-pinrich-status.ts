import { calculateBuyerStatus } from './src/services/BuyerStatusCalculator';

// 買主115のデータ（ピンリッチ未登録のはず）
const buyer115 = {
  buyer_number: '115',
  pinrich: '登録無し',
  email: 'myu.krn05@gmail.com',
  broker_inquiry: 'null',
  // 他の必須フィールド
  name: 'テスト',
  phone_number: null,
  reception_date: null,
  latest_viewing_date: null,
  viewing_date: null,
  next_call_date: null,
  follow_up_assignee: null,
  latest_status: null,
  inquiry_confidence: null,
  inquiry_email_phone: null,
  inquiry_email_reply: null,
  three_calls_confirmed: null,
  inquiry_source: null,
  viewing_result_follow_up: null,
  viewing_unconfirmed: null,
};

console.log('買主115のステータス計算:');
const result = calculateBuyerStatus(buyer115 as any);
console.log('  status:', result.status);
console.log('  priority:', result.priority);
console.log('  matchedCondition:', result.matchedCondition);
console.log('');

// 買主5351のデータ（ピンリッチ未登録のはず）
const buyer5351 = {
  buyer_number: '5351',
  pinrich: 'null',  // 文字列の'null'
  email: 'ls_xxx07.pq@docomo.ne.jp',
  broker_inquiry: 'null',
  // 他の必須フィールド
  name: 'テスト',
  phone_number: null,
  reception_date: null,
  latest_viewing_date: null,
  viewing_date: null,
  next_call_date: null,
  follow_up_assignee: null,
  latest_status: null,
  inquiry_confidence: null,
  inquiry_email_phone: null,
  inquiry_email_reply: null,
  three_calls_confirmed: null,
  inquiry_source: null,
  viewing_result_follow_up: null,
  viewing_unconfirmed: null,
};

console.log('買主5351のステータス計算:');
const result2 = calculateBuyerStatus(buyer5351 as any);
console.log('  status:', result2.status);
console.log('  priority:', result2.priority);
console.log('  matchedCondition:', result2.matchedCondition);
