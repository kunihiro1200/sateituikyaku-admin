with open('backend/src/services/GeolocationService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# HEAD -> GET に変更し、より多くのリダイレクトに対応
old_expand = """  private async expandShortenedUrl(shortenedUrl: string): Promise<string | null> {
    try {
      const https = await import('https');
      const { URL } = await import('url');

      return new Promise((resolve) => {
        const parsedUrl = new URL(shortenedUrl);
        
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        };

        const req = https.request(options, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (location) {
              console.log(`Expanded URL: ${location}`);
              resolve(location);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });

        req.on('error', (error) => {
          console.error('Error expanding URL:', error);
          resolve(null);
        });

        req.setTimeout(5000, () => {
          req.destroy();
          resolve(null);
        });

        req.end();
      });
    } catch (error) {
      console.error('Error in expandShortenedUrl:', error);
      return null;
    }
  }"""

new_expand = """  private async expandShortenedUrl(shortenedUrl: string): Promise<string | null> {
    try {
      const https = await import('https');
      const http = await import('http');
      const { URL } = await import('url');

      // 最大5回のリダイレクトを追跡
      const followRedirects = (url: string, maxRedirects: number = 5): Promise<string | null> => {
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
              if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303 || res.statusCode === 307 || res.statusCode === 308) {
                const location = res.headers.location;
                // レスポンスボディを消費（メモリリーク防止）
                res.resume();
                if (location) {
                  // 相対URLを絶対URLに変換
                  const absoluteLocation = location.startsWith('http')
                    ? location
                    : `${parsedUrl.protocol}//${parsedUrl.hostname}${location}`;
                  console.log(`Redirect ${6 - maxRedirects}: ${url} -> ${absoluteLocation}`);
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
                // リダイレクトなし - 最終URLを返す
                res.resume();
                resolve(url);
              }
            });

            req.on('error', (error: any) => {
              console.error('Error expanding URL:', error);
              resolve(null);
            });

            req.setTimeout(8000, () => {
              req.destroy();
              resolve(null);
            });

            req.end();
          } catch (e) {
            console.error('Error parsing URL:', e);
            resolve(null);
          }
        });
      };

      const expanded = await followRedirects(shortenedUrl);
      if (expanded) {
        console.log(`Final expanded URL: ${expanded}`);
      }
      return expanded;
    } catch (error) {
      console.error('Error in expandShortenedUrl:', error);
      return null;
    }
  }"""

if old_expand in text:
    text = text.replace(old_expand, new_expand)
    print('Replaced expandShortenedUrl method')
else:
    print('ERROR: Could not find old method')
    # デバッグ用に一部を表示
    idx = text.find('expandShortenedUrl')
    print('Found at:', idx)
    print('Context:', text[idx:idx+100])

with open('backend/src/services/GeolocationService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
