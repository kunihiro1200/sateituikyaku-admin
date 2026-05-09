filepath = 'backend/src/routes/buyers.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = "// ===== 汎用ルート（最後に定義する必要がある） ====="

new = """// スクレイピングサーバーのヘルスチェック（Vercel Cron Job用）
// 定期的にpingして、サーバーが落ちていたら自動復旧を促す
router.get('/cron/scrape-server-ping', async (req: Request, res: Response) => {
  try {
    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';
    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000); // 25秒タイムアウト

    try {
      const pingRes = await fetch(`${scrapeApiUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      console.log(`[scrape-server-ping] status=${pingRes.status}, elapsed=${elapsed}ms`);
      return res.json({ success: true, status: pingRes.status, elapsed });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      const elapsed = Date.now() - start;
      console.error(`[scrape-server-ping] failed: ${fetchErr.message}, elapsed=${elapsed}ms`);
      return res.json({ success: false, error: fetchErr.message, elapsed });
    }
  } catch (err: any) {
    console.error('[scrape-server-ping] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ===== 汎用ルート（最後に定義する必要がある） ====="""

if old in text:
    text = text.replace(old, new)
    print('✅ 置換成功')
else:
    print('❌ 対象文字列が見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
