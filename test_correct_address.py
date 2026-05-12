import os
import requests
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv('backend/.env')

api_key = None
with open('backend/.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('GOOGLE_MAPS_API_KEY='):
            api_key = line.split('=')[1].strip()
            break

print("=== 住所のバリエーションテスト ===")
print()

# 試す住所のバリエーション
addresses = [
    "大分県大分市大字光吉光吉新町3-5-10",  # 現在の住所
    "大分県大分市光吉新町3-5-10",          # 「大字光吉」を削除
    "大分県大分市大字光吉新町3-5-10",      # 「光吉」を1つ削除
    "大分県大分市光吉3-5-10",              # 「新町」を削除
    "大分県大分市大字光吉3-5-10",          # 「新町」を削除（大字付き）
]

for i, address in enumerate(addresses, 1):
    print(f"{i}. {address}")
    
    url = f"https://maps.googleapis.com/maps/api/geocode/json"
    params = {
        'address': address,
        'key': api_key,
        'language': 'ja',
        'region': 'jp'
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        data = response.json()
        
        if data['status'] == 'OK' and data['results']:
            location = data['results'][0]['geometry']['location']
            formatted = data['results'][0]['formatted_address']
            
            print(f"   ✅ 成功")
            print(f"   取得した住所: {formatted}")
            print(f"   座標: {location['lat']}, {location['lng']}")
            print(f"   URL: https://www.google.com/maps?q={location['lat']},{location['lng']}")
        else:
            print(f"   ❌ 失敗: {data['status']}")
    except Exception as e:
        print(f"   ❌ エラー: {e}")
    
    print()
