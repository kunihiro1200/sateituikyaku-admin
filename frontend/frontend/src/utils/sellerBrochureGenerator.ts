// 売主向けパンフレット生成ユーティリティ
// PDFの内容をHTMLで再現し、印刷可能にする

const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// 表紙ページ（1ページ目）
// ============================================================
export function generateCoverPageHtml(): string {
  return `<div style="width:210mm;height:297mm;position:relative;overflow:hidden;">
    <!-- 背景画像 -->
    <img src="/ifoo-assets/brochure/page1-bg.png" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" />
    
    <!-- 会社情報を上書き（画像の下部にある会社情報エリア） -->
    <div style="position:absolute;bottom:22mm;left:50%;transform:translateX(-50%);text-align:center;background:white;padding:18px 30px;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
      <div style="font-size:11pt;margin-bottom:5px;color:#666;">HPはコチラ</div>
      <div style="font-size:18pt;font-weight:bold;margin-bottom:8px;color:#000;">株式会社　くじら　不動産</div>
      <div style="font-size:10pt;margin-bottom:3px;color:#333;">〒810-0073</div>
      <div style="font-size:10pt;margin-bottom:8px;color:#333;line-height:1.5;">福岡市中央区舞鶴3－1－10<br/>オフィスニューガイア赤坂セレスNo.19 201号</div>
      <div style="font-size:16pt;font-weight:bold;margin-bottom:5px;color:#000;">☎ 097-533-2022</div>
      <div style="font-size:9pt;color:#666;">AM10:00〜PM18:00/定休日：水曜日</div>
    </div>
  </div>`;
}

// ============================================================
// 会社概要ページ（2ページ目）
// ============================================================
export function generateCompanyPageHtml(): string {
  return `<div style="width:210mm;height:297mm;background:#fff;padding:20mm;box-sizing:border-box;font-family:${FONT};">
    <!-- タイトル -->
    <div style="background:#f5c518;padding:20px;margin-bottom:30px;">
      <div style="font-size:24pt;font-weight:bold;color:#000;">会社概要</div>
    </div>

    <!-- 会社情報テーブル -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:40px;">
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;width:150px;font-size:11pt;font-weight:bold;">社名</td>
        <td style="padding:12px;font-size:11pt;">株式会社 くじら不動産</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">創業年月日</td>
        <td style="padding:12px;font-size:11pt;">平成17年10月</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">代表取締役</td>
        <td style="padding:12px;font-size:11pt;">國廣智子 / 宅地建物取引士、ファイナンシャルプランナー</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">住所</td>
        <td style="padding:12px;font-size:11pt;">〒870-0044 大分県大分市舞鶴町1-3-30 STビル1階</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">電話/FAX</td>
        <td style="padding:12px;font-size:11pt;">097-533-2022 / 097-529-7160</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">E-mail</td>
        <td style="padding:12px;font-size:11pt;">tenant@ifoo-oita.com</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">ホームページ</td>
        <td style="padding:12px;font-size:11pt;">https://ifoo-oita.com</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">免許番号</td>
        <td style="padding:12px;font-size:11pt;">大分県知事免許（03）第003183号</td>
      </tr>
      <tr style="border-bottom:1px solid #ddd;">
        <td style="padding:12px;background:#f5f5f5;font-size:11pt;font-weight:bold;">加盟団体</td>
        <td style="padding:12px;font-size:11pt;">全国宅地建物取引業保証協会</td>
      </tr>
    </table>

    <!-- 経営理念 -->
    <div style="margin-bottom:30px;">
      <div style="font-size:16pt;font-weight:bold;margin-bottom:15px;border-bottom:2px solid #f5c518;padding-bottom:8px;">経営理念</div>
      <div style="font-size:18pt;font-weight:bold;margin-bottom:15px;">現状に満足せず、</div>
      <div style="font-size:18pt;font-weight:bold;margin-bottom:20px;">些細なことでも改善する努力をし続ける</div>
      <div style="font-size:10pt;line-height:1.8;color:#333;">
        弊社は、大分市の中心部に店舗を構え、独自の経営理念のもと、<br/>
        少数精鋭にて不動産に携わっております。<br/>
        多方面にわたる情報網とそれに対する柔軟な対応力で、現在まで<br/>
        多数の売買の仲介を手掛けてまいりました。売買にかかわる税金の<br/>
        ことから、管理のことまですべて相談を承っておりますのでお気軽<br/>
        にご連絡いただければと思います。
      </div>
    </div>

    <!-- ビル画像エリア（右側） -->
    <div style="position:absolute;right:20mm;top:180mm;width:80mm;height:100mm;background:#f0f0f0;border:1px solid #ddd;display:flex;align-items:center;justify-content:center;">
      <div style="text-align:center;color:#999;font-size:10pt;">
        [STビル外観写真]
      </div>
    </div>
  </div>`;
}

// ============================================================
// 販売件数・売上高ページ（3ページ目）
// ============================================================
export function generateSalesPageHtml(): string {
  return `<div style="width:210mm;height:297mm;background:#fff;padding:20mm;box-sizing:border-box;font-family:${FONT};">
    <div style="text-align:center;margin-bottom:30px;">
      <div style="font-size:20pt;font-weight:bold;border-bottom:3px solid #f5c518;display:inline-block;padding-bottom:8px;">販売件数・売上高</div>
    </div>

    <div style="font-size:11pt;line-height:1.8;margin-bottom:30px;">
      売買の仲介は2016年からスタートし、毎年販売件数・売上（販売仲介手数料）を<br/>
      順調に伸ばしています。
    </div>

    <!-- グラフエリア（簡易版） -->
    <div style="border:2px solid #ddd;padding:20px;margin-bottom:40px;height:250px;background:#f9f9f9;display:flex;align-items:flex-end;justify-content:space-around;">
      <div style="text-align:center;">
        <div style="background:#f5c518;width:60px;height:40px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2016年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#f5c518;width:60px;height:60px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2017年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#f5c518;width:60px;height:80px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2018年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#f5c518;width:60px;height:100px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2019年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#f5c518;width:60px;height:120px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2020年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#f5c518;width:60px;height:140px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2021年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#ff6b6b;width:60px;height:160px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2022年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#ff6b6b;width:60px;height:180px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2023年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#ff6b6b;width:60px;height:200px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2024年</div>
      </div>
      <div style="text-align:center;">
        <div style="background:#ff6b6b;width:60px;height:220px;margin-bottom:5px;"></div>
        <div style="font-size:9pt;">2025年</div>
      </div>
    </div>

    <div style="text-align:center;margin-bottom:30px;">
      <div style="font-size:16pt;font-weight:bold;border-bottom:3px solid #f5c518;display:inline-block;padding-bottom:8px;">販売物件数</div>
    </div>

    <div style="font-size:11pt;font-weight:bold;margin-bottom:20px;">売買物件数は大分・別府エリアでトップクラス！</div>

    <div style="font-size:10pt;margin-bottom:10px;">（土地、建物、マンションの売買仲介 /2026年1月20日athome掲載件数調べ）</div>

    <!-- ランキング表 -->
    <table style="width:100%;border-collapse:collapse;">
      <tr style="background:#f5c518;">
        <th style="border:1px solid #000;padding:10px;font-size:11pt;">会社名</th>
        <th style="border:1px solid #000;padding:10px;font-size:11pt;">件数</th>
      </tr>
      <tr style="background:#fff8dc;">
        <td style="border:1px solid #000;padding:10px;font-size:12pt;font-weight:bold;">くじら不動産</td>
        <td style="border:1px solid #000;padding:10px;text-align:center;font-size:12pt;font-weight:bold;">244</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:10px;">Y社（大分中央店）</td>
        <td style="border:1px solid #000;padding:10px;text-align:center;">180</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:10px;">B興産（本社・大分・森町店）</td>
        <td style="border:1px solid #000;padding:10px;text-align:center;">136</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:10px;">H社（大分支店）</td>
        <td style="border:1px solid #000;padding:10px;text-align:center;">105</td>
      </tr>
      <tr>
        <td style="border:1px solid #000;padding:10px;">R社</td>
        <td style="border:1px solid #000;padding:10px;text-align:center;">101</td>
      </tr>
    </table>

    <div style="margin-top:20px;text-align:center;">
      <div style="display:inline-block;background:#fff8dc;padding:15px 30px;border-radius:8px;border:2px solid #f5c518;">
        <div style="font-size:12pt;font-weight:bold;">どこよりも多くの<br/>お客様にご覧いただけます</div>
      </div>
    </div>
  </div>`;
}

// ============================================================
// 完全なHTMLドキュメント生成（印刷用）
// ============================================================
export function generateSellerBrochureHtml(): string {
  const coverPage = generateCoverPageHtml();
  const companyPage = generateCompanyPageHtml();
  const salesPage = generateSalesPageHtml();

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>不動産売却案内パンフレット - 株式会社くじら不動産</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html, body { margin: 0; padding: 0; background: #fff; font-family: ${FONT}; }
  .page { page-break-after: always; break-after: page; }
  .page:last-child { page-break-after: auto; break-after: auto; }
  @media print {
    body { margin: 0; padding: 0; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: auto; }
  }
</style>
</head>
<body>
  <div class="page">${coverPage}</div>
  <div class="page">${companyPage}</div>
  <div class="page">${salesPage}</div>
</body>
</html>`;
}
