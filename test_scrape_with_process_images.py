import requests
import json

# スクレイピングサーバーに直接リクエスト
url = "https://sateituikyaku-scrape-server-production.up.railway.app/scrape"

payload = {
    "url": "https://www.athome.co.jp/kodate/1100854714/?DOWN=1&BKLISTID=001LPC&SEARCHDIV=1&sref=list_simple",
    "is_tateuri": True,
    "region": "oita",
    "process_images": True  # 画像加工を有効化
}

print("リクエスト送信中...")
print(f"URL: {url}")
print(f"Payload: {json.dumps(payload, indent=2, ensure_ascii=False)}")

try:
    response = requests.post(url, json=payload, timeout=120)
    print(f"\nステータスコード: {response.status_code}")
    print(f"レスポンス:\n{json.dumps(response.json(), indent=2, ensure_ascii=False)}")
except Exception as e:
    print(f"\nエラー: {e}")
