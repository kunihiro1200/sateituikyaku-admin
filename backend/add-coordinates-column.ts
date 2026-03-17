// Supabase REST API経由でcoordinatesカラムを追加し、座標を一括登録するスクリプト
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// Supabase REST API呼び出し
async function supabaseRequest(method: string, path: string, body?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path}`);
    const isHttps = url.protocol === 'https:';
    const requester = isHttps ? https : http;

    const bodyStr = body ? JSON.stringify(body) : undefined;
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal',
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    };

    const req = (requester as any).request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// 短縮URLを展開
function expandShortenedUrl(shortenedUrl: string): Promise<string | null> {
  const followRedirects = (url: string, maxRedirects: number = 8): Promise<string | null> => {
    return new Promise((resolve) => {
      if (maxRedirects <= 0) { resolve(null); return; }
      try {
        const parsedUrl = new URL(url);
        const isHttps = parsedUrl.protocol === 'https:';
        const requester = isHttps ? https : http;
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        };
        const req = (requester as any).request(options, (res: any) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            const location = res.headers.location;
            res.resume();
            if (location) {
              const abs = location.startsWith('http') ? location : `${parsedUrl.protocol}//${parsedUrl.hostname}${location}`;
              if (abs.includes('@') || abs.includes('?q=')) { resolve(abs); }
              else { followRedirects(abs, maxRedirects - 1).then(resolve); }
            } else { resolve(null); }
          } else { res.resume(); resolve(url); }
        });
        req.on('error', () => resolve(null));
        req.setTimeout(10000, () => { req.destroy(); resolve(null); });
        req.end();
      } catch { resolve(null); }
    });
  };
  return followRedirects(shortenedUrl);
}

// URLから座標を抽出
function extractCoords(url: string): { lat: number; lng: number } | null {
  const p1 = /@(-?\d+\.\d+),(-?\d+\.\d+),/.exec(url);
  if (p1) return { lat: parseFloat(p1[1]), lng: parseFloat(p1[2]) };
  const p2 = /[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url);
  if (p2) return { lat: parseFloat(p2[1]), lng: parseFloat(p2[2]) };
  const p3 = /\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/.exec(url);
  if (p3) return { lat: parseFloat(p3[1]), lng: parseFloat(p3[2]) };
  return null;
}

async function main() {
  console.log('=== coordinatesカラム追加 + 座標一括登録 ===\n');

  // Step 1: カラム追加（Supabase SQL Editor APIを使用）
  console.log('Step 1: coordinatesカラムをSQLで追加...');
  const sqlResult = await supabaseRequest('POST', '/rest/v1/rpc/exec_sql', {
    sql: 'ALTER TABLE area_map_config ADD COLUMN IF NOT EXISTS coordinates JSONB DEFAULT NULL;'
  });
  console.log('SQL実行結果:', sqlResult.status, sqlResult.data);

  // Step 2: 全エリアを取得
  console.log('\nStep 2: エリアデータ取得...');
  const listResult = await supabaseRequest('GET', '/rest/v1/area_map_config?is_active=eq.true&google_map_url=not.is.null&select=id,area_number,google_map_url,coordinates');
  
  if (listResult.status !== 200) {
    console.error('取得失敗:', listResult.status, listResult.data);
    return;
  }

  const rows = listResult.data as any[];
  const targets = rows.filter(r => r.coordinates === null || r.coordinates === undefined);
  console.log(`処理対象: ${targets.length}件\n`);

  let success = 0;
  let failed = 0;

  for (const row of targets) {
    console.log(`\nエリア ${row.area_number}: ${row.google_map_url}`);
    
    const expandedUrl = await expandShortenedUrl(row.google_map_url);
    if (!expandedUrl) { console.log('  ❌ URL展開失敗'); failed++; continue; }
    
    const coords = extractCoords(expandedUrl);
    if (!coords) { console.log('  ❌ 座標抽出失敗'); failed++; continue; }
    
    console.log(`  座標: lat=${coords.lat}, lng=${coords.lng}`);

    // PATCH でupdate
    const updateResult = await supabaseRequest(
      'PATCH',
      `/rest/v1/area_map_config?id=eq.${row.id}`,
      { coordinates: coords }
    );

    if (updateResult.status >= 200 && updateResult.status < 300) {
      console.log('  ✅ 保存成功');
      success++;
    } else {
      console.log(`  ❌ 保存失敗: ${updateResult.status}`, updateResult.data);
      failed++;
    }

    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\n=== 完了 ===`);
  console.log(`成功: ${success}件, 失敗: ${failed}件`);
}

main().catch(console.error);
