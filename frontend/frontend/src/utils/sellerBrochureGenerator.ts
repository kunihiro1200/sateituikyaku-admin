// 売主向けパンフレット生成ユーティリティ
// 内覧準備資料２と同じ方式（iframe + window.location.origin）

const FONT = '"Noto Sans JP","Hiragino Kaku Gothic ProN","Meiryo",sans-serif';

function esc(s: unknown): string {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ============================================================
// 完全なHTMLドキュメント生成（印刷用）
// 内覧準備資料２と全く同じ構造
// ============================================================
export function generateSellerBrochureHtml(): string {
  const base = window.location.origin;
  const page1Img = `${base}/ifoo-assets/brochure/page1-bg.png`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>不動産売却案内パンフレット - 株式会社くじら不動産</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html,body { margin: 0; padding: 0; background: #fff; font-family: ${FONT}; color: #000; }
  .page { width: 210mm; height: 297mm; background: #fff; overflow: hidden; display: block; page-break-after: always; break-after: page; position: relative; }
  .page:last-child { page-break-after: auto; break-after: auto; }
</style>
</head>
<body>

<!-- ページ1: 表紙（背景画像 + 会社情報上書き） -->
<div class="page">
  <img src="${page1Img}" style="width:210mm;height:297mm;display:block;object-fit:fill;" />
  <!-- 元画像の会社情報エリアを白いボックスで上書き -->
  <!-- 位置は元画像の「株式会社いふう」「〒870-0044...」の箇所に合わせる -->
  <div style="position:absolute;bottom:42mm;left:108mm;right:8mm;background:white;padding:8px 12px;">
    <div style="font-size:13pt;font-weight:bold;margin-bottom:6px;">株式会社　くじら　不動産</div>
    <div style="font-size:9pt;margin-bottom:2px;">〒810-0073</div>
    <div style="font-size:9pt;line-height:1.6;">福岡市中央区舞鶴3－1－10<br>オフィスニューガイア赤坂セレスNo.19 201号</div>
  </div>
</div>

</body>
</html>`;
}
