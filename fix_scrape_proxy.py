import re

filepath = 'frontend/frontend/src/pages/OtherCompanyDistributionPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# handleScrapeの直接fetch部分をバックエンドプロキシ経由に変更
old = """    try {
      // RailwayのスクレイピングAPIサーバーに送信
      const scrapeApiUrl = import.meta.env.VITE_SCRAPE_API_URL || 'http://localhost:8765';
      const res = await fetch(`${scrapeApiUrl}/scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: propertyUrl.trim() }),
      });
      if (!res.ok) throw new Error(`スクレイピングサーバーエラー: ${res.status}`);
      const result = await res.json();
      if (!result.success) throw new Error(result.error || '取得失敗');"""

new = """    try {
      // バックエンド経由でスクレイピング（CORS回避）
      const res = await api.post('/api/tateuri/scrape', { url: propertyUrl.trim() });
      const result = res.data;
      if (!result.success) throw new Error(result.error || '取得失敗');"""

if old in text:
    text = text.replace(old, new)
    print('✅ 置換成功')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ用に前後を確認
    idx = text.find('RailwayのスクレイピングAPIサーバーに送信')
    if idx >= 0:
        print('前後のテキスト:')
        print(repr(text[idx-50:idx+200]))
    else:
        print('キーワードも見つかりません')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
