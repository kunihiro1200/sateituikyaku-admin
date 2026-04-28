import urllib.request
import json

# 本番バックエンドAPIを直接叩いて確認
url = "https://sateituikyaku-admin-backend.vercel.app/api/buyers/insights"

req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read())
        print(f"ステータス: 200")
        print(f"件数: {len(data)}")
        print(f"データ: {json.dumps(data, ensure_ascii=False, indent=2)}")
except urllib.error.HTTPError as e:
    print(f"HTTPエラー: {e.code}")
    print(e.read().decode())
except Exception as e:
    print(f"エラー: {e}")
