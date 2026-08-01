// テスト: 本番バックエンドのURL解決 + フロントエンドの座標抽出ロジック
const url = 'https://maps.app.goo.gl/pdns551aHR4seesE8';

async function test() {
  // 1. バックエンドAPIを呼ぶ
  const apiBase = 'https://sateituikyaku-admin-backend.vercel.app';
  const r = await fetch(`${apiBase}/api/url-redirect/resolve?url=${encodeURIComponent(url)}`);
  const d = await r.json();
  console.log('Status:', r.status);
  console.log('redirectedUrl:', d.redirectedUrl?.substring(0, 150));

  // 2. フロントエンドと同じ座標抽出ロジック
  const s = d.redirectedUrl || url;
  const decoded = decodeURIComponent(s);
  
  const patterns = [
    /[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\/search\/(-?\d+\.?\d*),\+?(-?\d+\.?\d*)/,
    /\/place\/[^/]*\/@(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\/place\/(-?\d+\.?\d*),(-?\d+\.?\d*)/,
    /\/@(-?\d+\.?\d*),(-?\d+\.?\d*),/,
    /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/,
    /ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/,
  ];

  console.log('\n--- Testing patterns on original URL ---');
  for (const p of patterns) {
    const m = s.match(p);
    if (m) {
      console.log('MATCH:', p.toString(), '=> lat:', m[1], 'lng:', m[2]);
    }
  }

  console.log('\n--- Testing patterns on decoded URL ---');
  for (const p of patterns) {
    const m = decoded.match(p);
    if (m) {
      console.log('MATCH:', p.toString(), '=> lat:', m[1], 'lng:', m[2]);
    }
  }
}

test().catch(console.error);
