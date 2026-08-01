// 手動でLIFULL HOME'Sメールの転記を実行するスクリプト
// 使用方法: node manual-lifull-transfer.js

const https = require('https');

const BACKEND_URL = 'sateituikyaku-admin-backend.vercel.app';
const CRON_SECRET = 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';

// 今回のLIFULL HOME'Sメール本文
const mailBody = `株式会社威風様（ ID 148254 ） いつもご利用ありがとうございます。 「不動産売却査定サービス」です。 お客様より下記の＜実名＞査定依頼がありました。 ご確認の上、ご対応・ご連絡をお願いいたします。 ▼Managerで、依頼内容と連絡先をご確認いただけます。 　https://manager.homes.co.jp/index.php?action=sale_assessment_visited_detail&id=64305701 （受信日時：2026/06/08 14:35:13） ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓ 　査定ID（問合せ番号）：64305701 　　　　物件種別：一戸建て 　　　　　所在地：大分県大分市大字田原918ー1 　　　　　間取り：4K/DK 　　　　建物面積：40m2 　　　　土地面積：90m2 　　　　　　築年：西暦1947年(昭和22年) 築79年 　　　　　　現況：ご自身またはご家族・親族が居住中 　　　　　　名義：名義人に売却の同意を得た家族、親族 　　　　売却理由：相続による不動産の売却、その他 　　売却希望時期：1年以上先 　　　　　ご要望：時間がかかってもなるべく高く売りたい、特にない 　　　　　お名前：大塚善隆 　　　　フリガナ：オオツカヨシタカ 　　　　　ご住所：大分県大分市大字田原918ー1 　　　　電話番号：09018798380 　メールアドレス：o.yoshi.win@yahoo.ne.jp 　希望の連絡時間：指定なし 　希望の連絡方法：メール を優先して希望 　　同時送信社数：5社 ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`;

const payload = JSON.stringify({ body: mailBody });

const options = {
  hostname: BACKEND_URL,
  path: '/api/sellers/lifull-transfer',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${CRON_SECRET}`,
    'Content-Length': Buffer.byteLength(payload),
  },
};

console.log('LIFULL HOME\'S転記APIを呼び出し中...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`Status: ${res.statusCode}`);
    try {
      const result = JSON.parse(data);
      console.log('Result:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.log('Response:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.write(payload);
req.end();
