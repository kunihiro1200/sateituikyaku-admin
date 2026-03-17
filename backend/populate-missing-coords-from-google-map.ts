// google_map_urlがあるが座標がない物件の座標をDBに保存するスクリプト
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// 短縮URLを展開
function expandShortenedUrl(shortenedUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const followRedirects = (url: string, maxRedirects: number = 5): Promise<string | null> => {
      return new Promise((res) => {
        if (maxRedirects <= 0) { res(null); return; }
        try {
          const parsedUrl = new URL(url);
          const isHttps = parsedUrl.protocol === 'https:';
          const requester = isHttps ? https : http;
          const options = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' }
          };
          const req = (requester as any).request(options, (response: any) => {
            if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
              const location = response.headers.location;
              response.resume();
              if (location) {
                const abs = location.startsWith('http') ? location : `${parsedUrl.protocol}//${parsedUrl.hostname}${location}`;
                if (abs.includes('@') || abs.includes('?q=')) { res(abs); }
                else { followRedirects(abs, maxRedirects - 1).then(res); }
              } else { res(null); }
            } else { response.resume(); res(url); }
          });
          req.on('error', () => res(null));
          req.setTimeout(8000, () => { req.destroy(); res(null); });
          req.end();
        } catch { res(null); }
      });
    };
    followRedirects(shortenedUrl).then(resolve);
  });
}

// URLから座標を抽出
function extractCoordsFromUrl(url: string): { lat: number; lng: number } | null {
  // パターン1: /@lat,lng,zoom
  const p1 = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+),/);
  if (p1) return { lat: parseFloat(p1[1]), lng: parseFloat(p1[2]) };
  // パターン2: ?q=lat,lng
  const p2 = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (p2) return { lat: parseFloat(p2[1]), lng: parseFloat(p2[2]) };
  // パターン3: /place/.../@lat,lng
  const p3 = url.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (p3) return { lat: parseFloat(p3[1]), lng: parseFloat(p3[2]) };
  // パターン4: /search/lat,+lng (スペースや+区切り)
  const p4 = url.match(/\/search\/(-?\d+\.\d+),\+?(-?\d+\.\d+)/);
  if (p4) return { lat: parseFloat(p4[1]), lng: parseFloat(p4[2]) };
  // パターン5: !3dLAT!4dLNG (data= 形式)
  const p5 = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (p5) return { lat: parseFloat(p5[1]), lng: parseFloat(p5[2]) };
  return null;
}

async function populate() {
  // google_map_urlあり・座標なしの物件を取得
  const { data, error } = await supabase
    .from('property_listings')
    .select('property_number, address, google_map_url')
    .not('google_map_url', 'is', null)
    .is('latitude', null);

  if (error || !data) { console.error(error); return; }
  console.log(`対象物件数: ${data.length}`);

  let success = 0;
  let failed = 0;

  for (const prop of data) {
    console.log(`\n処理中: ${prop.property_number} (${prop.address})`);
    console.log(`  URL: ${prop.google_map_url}`);

    const expanded = await expandShortenedUrl(prop.google_map_url);
    if (!expanded) {
      console.log(`  ❌ URL展開失敗`);
      failed++;
      continue;
    }

    const coords = extractCoordsFromUrl(expanded);
    if (!coords) {
      console.log(`  ❌ 座標抽出失敗: ${expanded}`);
      failed++;
      continue;
    }

    console.log(`  ✅ 座標: (${coords.lat}, ${coords.lng})`);

    const { error: updateError } = await supabase
      .from('property_listings')
      .update({ latitude: coords.lat, longitude: coords.lng })
      .eq('property_number', prop.property_number);

    if (updateError) {
      console.log(`  ❌ DB更新失敗: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  ✅ DB更新完了`);
      success++;
    }
  }

  console.log(`\n完了: 成功=${success}, 失敗=${failed}`);
}

populate().catch(console.error);
