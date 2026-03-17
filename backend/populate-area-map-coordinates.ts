// area_map_config テーブルの全エリアの座標をURLから抽出してDBに保存するスクリプト
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

// 短縮URLを展開する（GETリクエスト + 複数リダイレクト追跡）
function expandShortenedUrl(shortenedUrl: string): Promise<string | null> {
  const followRedirects = (url: string, maxRedirects: number = 8): Promise<string | null> => {
    return new Promise((resolve) => {
      if (maxRedirects <= 0) {
        resolve(null);
        return;
      }

      try {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const requester = isHttps ? https : http;

        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        };

        const req = (requester as any).request(options, (res: any) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            const location = res.headers.location;
            res.resume();
            if (location) {
              const absoluteLocation = location.startsWith('http')
                ? location
                : `${parsedUrl.protocol}//${parsedUrl.hostname}${location}`;
              console.log(`  リダイレクト: ${url.substring(0, 60)} -> ${absoluteLocation.substring(0, 80)}`);
              // 座標が含まれていればそこで終了
              if (absoluteLocation.includes('@') || absoluteLocation.includes('?q=')) {
                resolve(absoluteLocation);
              } else {
                followRedirects(absoluteLocation, maxRedirects - 1).then(resolve);
              }
            } else {
              resolve(null);
            }
          } else {
            res.resume();
            resolve(url);
          }
        });

        req.on('error', (error: any) => {
          console.error('  URLエラー:', error.message);
          resolve(null);
        });

        req.setTimeout(10000, () => {
          req.destroy();
          console.error('  タイムアウト');
          resolve(null);
        });

        req.end();
      } catch (e) {
        console.error('  URL解析エラー:', e);
        resolve(null);
      }
    });
  };

  return followRedirects(shortenedUrl);
}

// URLから座標を抽出
function extractCoordinatesFromUrl(url: string): { lat: number; lng: number } | null {
  // パターン1: /@lat,lng,zoom 形式
  const pattern1 = /@(-?\d+\.\d+),(-?\d+\.\d+),/;
  const match1 = url.match(pattern1);
  if (match1) {
    return { lat: parseFloat(match1[1]), lng: parseFloat(match1[2]) };
  }

  // パターン2: ?q=lat,lng 形式
  const pattern2 = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match2 = url.match(pattern2);
  if (match2) {
    return { lat: parseFloat(match2[1]), lng: parseFloat(match2[2]) };
  }

  // パターン3: /place/ 形式
  const pattern3 = /\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/;
  const match3 = url.match(pattern3);
  if (match3) {
    return { lat: parseFloat(match3[1]), lng: parseFloat(match3[2]) };
  }

  return null;
}

async function main() {
  console.log('=== area_map_config 座標一括登録 ===\n');

  const { data, error } = await supabase
    .from('area_map_config')
    .select('*')
    .eq('is_active', true)
    .not('google_map_url', 'is', null)
    .order('area_number');

  if (error) {
    console.error('DBエラー:', error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log('URLありのエリアなし');
    return;
  }

  // 座標がまだないエリアのみ処理
  const targets = data.filter(r => r.coordinates === null || r.coordinates === undefined);
  console.log(`処理対象: ${targets.length}件（全${data.length}件中）\n`);

  let success = 0;
  let failed = 0;

  for (const row of targets) {
    console.log(`\nエリア ${row.area_number}: ${row.google_map_url}`);

    try {
      // URLを展開
      const expandedUrl = await expandShortenedUrl(row.google_map_url);
      if (!expandedUrl) {
        console.log(`  ❌ URL展開失敗`);
        failed++;
        continue;
      }

      console.log(`  展開後: ${expandedUrl.substring(0, 100)}`);

      // 座標を抽出
      const coords = extractCoordinatesFromUrl(expandedUrl);
      if (!coords) {
        console.log(`  ❌ 座標抽出失敗`);
        failed++;
        continue;
      }

      console.log(`  座標: lat=${coords.lat}, lng=${coords.lng}`);

      // DBに保存
      const { error: updateError } = await supabase
        .from('area_map_config')
        .update({ coordinates: coords })
        .eq('id', row.id);

      if (updateError) {
        console.log(`  ❌ DB保存失敗: ${updateError.message}`);
        failed++;
      } else {
        console.log(`  ✅ 保存成功`);
        success++;
      }

      // レート制限対策（1秒待機）
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (err: any) {
      console.log(`  ❌ エラー: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== 完了 ===`);
  console.log(`成功: ${success}件`);
  console.log(`失敗: ${failed}件`);
}

main().catch(console.error);
