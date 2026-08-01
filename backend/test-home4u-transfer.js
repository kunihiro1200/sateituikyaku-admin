// HOME4Uメール本文を手動でバックエンドAPIに送信するテスト
var https = require('https');

var BACKEND_HOST = 'sateituikyaku-admin-backend.vercel.app';
var CRON_SECRET = 'a0z8ahNnFyUY+BXloL5JsotDTbuu9b5L6UApoflR59s=';

var mailBody = `HOME4Uログアウト R5/28　不通　留守入り 査定依頼 株式会社威風 担当者様 HOME4Uをご利用いただきありがとうございます。 貴社への査定依頼がございましたのでお知らせいたします。 【 査定依頼 -- <大分県> 大分市 】 ■査定ナンバー　　　　　: SA2605-8190673 ■ご依頼日　　　　　　　: 2026/05/28 (木) 09:27:08 ----------------------------------------------------------------- ■査定方法　　　　　　　: 簡易査定 ----------------------------------------------------------------- ■物件種別　　　　　　　: 分譲マンション（区分所有） ■物件名称　　　　　　　: 豊国スカイマンション大分 ■階数（棟物の場合記載）: ■戸数（棟物の場合記載）: ■土地面積　　　　　　　: ■建物（専有）面積　　　: 21 平米 ■間取り　　　　　　　　: 1R ■物件所在地　　　　　　: 大分県大分市原新町353豊国スカイマンション大分305 ■築年（西暦）　　　　　: 1990 年 ■現況　　　　　　　　　: 賃貸中 [賃料 ] ■名義　　　　　　　　　: 本人所有 ----------------------------------------------------------------- ■フリガナ　　　　　　　: イナダ　アキヒロ ■お名前　　　　　　　　: 稲田　明浩 ■年齢　　　　　　　　　: 78 歳 ■ご住所　　　　　　　　: 〒315-0001 　　　　　　　　　　　　: 茨城県石岡市石岡２丁目１０－７ ■電話番号　　　　　　　: 09023008265 ■第二電話番号（任意）　: ■E-mail　　　　　　　　: inatyan-2024@outlook.jp ■査定の理由　　　　　　: 住宅ローンの返済が厳しい ■売却の希望時期　　　　: ■要望・質問（自由記入）: ----------------------------------------------------------------- `;

var payload = JSON.stringify({ body: mailBody });

var req = https.request({
  hostname: BACKEND_HOST,
  path: '/api/sellers/home4u-transfer',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + CRON_SECRET,
    'Content-Length': Buffer.byteLength(payload)
  }
}, function(res) {
  var data = '';
  res.on('data', function(chunk) { data += chunk; });
  res.on('end', function() {
    console.log('HTTPステータス:', res.statusCode);
    console.log('レスポンス:', data);
  });
});
req.write(payload);
req.end();
