import { Router, Request, Response } from 'express';
import https from 'https';
import http from 'http';

const router = Router();

/**
 * 短縮URLのリダイレクト先を手動追跡で取得するAPI
 * Vercel Serverless環境でも確実に動作するようネイティブhttp/httpsモジュールを使用
 */

function followRedirects(url: string, maxRedirects: number = 10): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      resolve(url);
      return;
    }

    try {
      const parsedUrl = new URL(url);
      const requester = parsedUrl.protocol === 'https:' ? https : http;

      const req = requester.get(
        url,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ja,en;q=0.9',
          },
        },
        (res) => {
          const statusCode = res.statusCode || 0;

          if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
            // レスポンスボディを消費（メモリリーク防止）
            res.resume();

            const location = res.headers.location;
            // 相対URLを絶対URLに変換
            const nextUrl = location.startsWith('http')
              ? location
              : `${parsedUrl.protocol}//${parsedUrl.hostname}${location}`;

            console.log(`  ↪️ Redirect ${statusCode}: ${url.substring(0, 80)} -> ${nextUrl.substring(0, 120)}`);

            // consent.google.com のリダイレクトが来た場合、continueパラメータから元URLを取得
            if (nextUrl.includes('consent.google.com') || nextUrl.includes('consent.youtube.com')) {
              try {
                const consentUrl = new URL(nextUrl);
                const continueUrl = consentUrl.searchParams.get('continue');
                if (continueUrl) {
                  console.log('  ⚠️ Consent redirect detected, using continue URL:', continueUrl.substring(0, 120));
                  resolve(continueUrl);
                  return;
                }
              } catch {}
            }

            // 座標が含まれるURLが見つかったらそこで終了（パフォーマンス最適化）
            if (nextUrl.includes('/@') || nextUrl.includes('?q=') || nextUrl.includes('!3d')) {
              resolve(nextUrl);
            } else {
              followRedirects(nextUrl, maxRedirects - 1).then(resolve).catch(reject);
            }
          } else if (statusCode === 200) {
            // 200レスポンスの場合、HTMLボディからmeta refreshやog:urlを探す
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
              body += chunk;
              // 最初の4KBだけ読む（パフォーマンス）
              if (body.length > 4096) {
                res.destroy();
              }
            });
            res.on('end', () => {
              // meta http-equiv="refresh" からURLを抽出
              const metaRefresh = body.match(/content=["']\d+;\s*url=([^"']+)["']/i);
              if (metaRefresh) {
                const refreshUrl = metaRefresh[1];
                console.log('  ↪️ Meta refresh found:', refreshUrl.substring(0, 120));
                if (refreshUrl.includes('/@') || refreshUrl.includes('?q=') || refreshUrl.includes('!3d')) {
                  resolve(refreshUrl);
                  return;
                }
                followRedirects(refreshUrl, maxRedirects - 1).then(resolve).catch(reject);
                return;
              }
              // 最終手段: URLそのものを返す
              resolve(url);
            });
            res.on('error', () => resolve(url));
          } else {
            res.resume();
            resolve(url);
          }
        }
      );

      req.on('error', (err) => {
        console.error('  ❌ Request error:', err.message);
        reject(err);
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
    } catch (err) {
      reject(err);
    }
  });
}

router.get('/resolve', async (req: Request, res: Response) => {
  const urlParam = req.query.url;
  
  if (!urlParam || typeof urlParam !== 'string') {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    console.log('🔗 Resolving shortened URL:', urlParam);
    
    const redirectedUrl = await followRedirects(urlParam);
    
    console.log('✅ Final URL:', redirectedUrl.substring(0, 150));
    
    res.json({
      originalUrl: urlParam,
      redirectedUrl: redirectedUrl,
    });
  } catch (error: any) {
    console.error('❌ Error resolving URL:', error.message);
    res.status(500).json({
      error: 'Failed to resolve URL',
      message: error.message,
    });
  }
});

export default router;
