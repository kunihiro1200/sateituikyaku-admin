import urllib.request
import json

# Vercel APIでデプロイ状況確認
# .vercel/project.jsonからトークンなしで確認できる方法を試す

# まず本番URLに直接アクセスしてinsightsエンドポイントの動作確認
# 認証なしでアクセスできるか試す
urls_to_try = [
    "https://sateituikyaku-admin-backend.vercel.app/api/buyers/insights",
    "https://baikyaku-property-site3.vercel.app/api/buyers/insights",
]

for url in urls_to_try:
    print(f"\n--- {url} ---")
    req = urllib.request.Request(url)
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            data = json.loads(res.read())
            print(f"成功: {len(data)}件")
            print(data)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        print(f"HTTP {e.code}: {body[:200]}")
    except Exception as e:
        print(f"エラー: {e}")
