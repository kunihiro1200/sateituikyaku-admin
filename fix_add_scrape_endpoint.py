filepath = 'backend/src/routes/buyers.ts'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# other-company-distributionエンドポイントの後に新しいエンドポイントを追加
old = """// ===== 汎用ルート（最後に定義する必要がある） =====""" 

new = """// 他社物件新着配信用スクレイピングプロキシ（CORS回避のためバックエンド経由）
router.post('/scrape-property', authenticate, async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    const scrapeApiUrl = process.env.SCRAPE_API_URL || 'https://sateituikyaku-scrape-server-production.up.railway.app';

    // スクレイピングサーバーにリクエスト（バックエンド経由でCORSを回避）
    const scrapeRes = await fetch(`${scrapeApiUrl}/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!scrapeRes.ok) {
      const errText = await scrapeRes.text();
      console.error('[buyers/scrape-property] スクレイピングサーバーエラー:', scrapeRes.status, errText);
      return res.status(scrapeRes.status).json({ error: `スクレイピングサーバーエラー: ${scrapeRes.status}` });
    }

    const result = await scrapeRes.json();
    return res.json(result);
  } catch (err: any) {
    console.error('[buyers/scrape-property] エラー:', err.message);
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
